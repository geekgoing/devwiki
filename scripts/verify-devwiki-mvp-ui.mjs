import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const DEVWIKI_ASSETS_BUCKET = "devwiki-assets";
const COOKIE_CHUNK_SIZE = 3180;
const LOGIN_TIMEOUT_MS = 15_000;
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

function loadEnvFile(path) {
  try {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");

      if (!process.env[key]) {
        process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // CI can provide env vars without a local .env file.
  }
}

function report(status, label, detail = "") {
  const prefix =
    status === "pass" ? "PASS" : status === "warn" ? "WARN" : "FAIL";
  console.log(`${prefix} ${label}${detail ? ` - ${detail}` : ""}`);
}

function skipOrFail(message) {
  if (process.env.DEVWIKI_E2E_REQUIRED === "1") {
    throw new Error(message);
  }

  report("warn", "MVP UI E2E skipped", message);
}

function decodeAssetPath(path) {
  return path.split("/").map(decodeURIComponent).join("/");
}

function encodeAssetPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function getStorageKey(supabaseUrl) {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

function createCookieChunks(name, value) {
  const encodedValue = encodeURIComponent(value);

  if (encodedValue.length <= COOKIE_CHUNK_SIZE) {
    return [{ name, value }];
  }

  const chunks = [];
  let remaining = encodedValue;

  while (remaining.length > 0) {
    let encodedChunk = remaining.slice(0, COOKIE_CHUNK_SIZE);
    const lastEscapePos = encodedChunk.lastIndexOf("%");

    if (lastEscapePos > COOKIE_CHUNK_SIZE - 3) {
      encodedChunk = encodedChunk.slice(0, lastEscapePos);
    }

    let chunk = "";

    while (encodedChunk.length > 0) {
      try {
        chunk = decodeURIComponent(encodedChunk);
        break;
      } catch (error) {
        if (
          error instanceof URIError &&
          encodedChunk.at(-3) === "%" &&
          encodedChunk.length > 3
        ) {
          encodedChunk = encodedChunk.slice(0, encodedChunk.length - 3);
          continue;
        }

        throw error;
      }
    }

    chunks.push(chunk);
    remaining = remaining.slice(encodedChunk.length);
  }

  return chunks.map((chunk, index) => ({
    name: `${name}.${index}`,
    value: chunk,
  }));
}

function extractAssetPaths(markdown = "") {
  const paths = [];
  const pattern = /\/api\/assets\/([^) \n\r]+)/g;
  let match = pattern.exec(markdown);

  while (match) {
    paths.push(decodeAssetPath(match[1]));
    match = pattern.exec(markdown);
  }

  return paths;
}

function tagSlugs(nonce) {
  return [
    `ui-e2e-${nonce}`,
    `mermaid-ui-${nonce}`,
    `search-probe-${nonce}`,
    `revision-ui-${nonce}`,
  ];
}

function slugify(value, maxLength = 80) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}

function makeLongMarkdownSection() {
  return Array.from(
    { length: 30 },
    (_, index) =>
      `- 긴 문서 항목 ${index + 1}: 면접 답변을 확장해도 에디터와 미리보기가 유지됩니다.`,
  ).join("\n");
}

async function ensureActiveMember(admin, email) {
  const { data, error } = await admin
    .from("members")
    .select("email")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Member lookup failed: ${error.message}`);
  }

  if (data) {
    report("pass", "Active member available", email);
    return;
  }

  if (process.env.DEVWIKI_E2E_MANAGE_MEMBER !== "1") {
    throw new Error(
      `${email} is not an active member. Add it to members or set DEVWIKI_E2E_MANAGE_MEMBER=1 for test setup.`,
    );
  }

  const { error: upsertError } = await admin.from("members").upsert(
    {
      email,
      display_name: "DevWiki UI E2E",
      role: "editor",
      is_active: true,
    },
    { onConflict: "email" },
  );

  if (upsertError) {
    throw new Error(`Member setup failed: ${upsertError.message}`);
  }

  report("pass", "Active member created", email);
}

async function findAuthUserByEmail(admin, email) {
  const normalizedEmail = email.toLowerCase();
  const perPage = 100;
  let page = 1;

  while (page < 100) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Auth user lookup failed: ${error.message}`);
    }

    const users = data?.users ?? [];
    const user = users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail,
    );

    if (user) {
      return user;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }

  throw new Error("Auth user lookup exceeded pagination limit.");
}

async function ensurePasswordAuthUser(admin, email, password, displayName) {
  const existingUser = await findAuthUserByEmail(admin, email);

  if (existingUser) {
    if (process.env.DEVWIKI_E2E_MANAGE_MEMBER === "1") {
      const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
      });

      if (error) {
        throw new Error(`Auth user password setup failed: ${error.message}`);
      }

      report("pass", "Password auth user updated", email);
    } else {
      report("pass", "Password auth user available", email);
    }

    return existingUser.id;
  }

  if (process.env.DEVWIKI_E2E_MANAGE_MEMBER !== "1") {
    throw new Error(
      `${email} does not exist in Supabase Auth. Create the user with a password or set DEVWIKI_E2E_MANAGE_MEMBER=1 for test setup.`,
    );
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: displayName },
  });

  if (error || !data.user) {
    throw new Error(
      `Auth user setup failed: ${error?.message ?? "user was not returned"}`,
    );
  }

  report("pass", "Password auth user created", email);
  return data.user.id;
}

async function createTemporaryPasswordMember(admin, email, password) {
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "DevWiki Login E2E" },
  });

  if (userError || !userData.user) {
    throw new Error(
      `Temporary password login user setup failed: ${
        userError?.message ?? "user was not returned"
      }`,
    );
  }

  const { error: memberError } = await admin.from("members").upsert(
    {
      email,
      display_name: "DevWiki Login E2E",
      role: "editor",
      is_active: true,
    },
    { onConflict: "email" },
  );

  if (memberError) {
    await admin.auth.admin.deleteUser(userData.user.id);
    throw new Error(
      `Temporary password login member setup failed: ${memberError.message}`,
    );
  }

  return userData.user.id;
}

async function createTemporaryPasswordUser(admin, email, password, displayName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: displayName },
  });

  if (error || !data.user) {
    throw new Error(
      `Temporary auth user setup failed: ${
        error?.message ?? "user was not returned"
      }`,
    );
  }

  return data.user.id;
}

async function createPasswordSession({ url, publishableKey, email, password }) {
  const client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !authData.session || !authData.user) {
    throw new Error(
      `Password login failed: ${
        error?.message ?? "session was not returned"
      }`,
    );
  }

  return {
    client,
    session: authData.session,
    user: authData.user,
  };
}

async function seedBrowserSession({ context, baseUrl, supabaseUrl, session }) {
  const storageKey = getStorageKey(supabaseUrl);
  const encodedSession = `base64-${Buffer.from(
    JSON.stringify(session),
  ).toString("base64url")}`;
  const chunks = createCookieChunks(storageKey, encodedSession);
  const expires = Math.floor(Date.now() / 1000) + 400 * 24 * 60 * 60;
  const base = new URL(baseUrl);

  await context.addCookies(
    chunks.map((chunk) => ({
      name: chunk.name,
      value: chunk.value,
      domain: base.hostname,
      path: "/",
      expires,
      httpOnly: false,
      secure: base.protocol === "https:",
      sameSite: "Lax",
    })),
  );
}

async function assertNonMemberBlocked({ url, publishableKey, admin }) {
  const email = `devwiki-ui-nonmember-${Date.now()}@example.com`;
  const password = `DevWiki-ui-${Date.now()}!`;
  let userId = null;

  try {
    userId = await createTemporaryPasswordUser(
      admin,
      email,
      password,
      "DevWiki UI non-member",
    );
    const authData = await createPasswordSession({
      url,
      publishableKey,
      email,
      password,
    });

    const { error } = await authData.client.from("documents").insert({
      slug: `blocked-ui-${Date.now()}`,
      title: "Blocked UI non-member document",
      body_markdown: "This insert must be blocked.",
      status: "draft",
      created_by: authData.user.id,
      updated_by: authData.user.id,
    });

    if (!error) {
      throw new Error("Non-member document insert unexpectedly succeeded.");
    }

    report("pass", "Non-member document insert blocked", error.message);
  } finally {
    if (userId) {
      const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);

      if (deleteUserError) {
        report("warn", "UI E2E non-member cleanup failed", deleteUserError.message);
      }
    }
  }
}

async function assertNonMemberBrowserGate({
  browser,
  baseUrl,
  supabaseUrl,
  url,
  publishableKey,
  admin,
  slug,
}) {
  const email = `devwiki-ui-gate-${Date.now()}@example.com`;
  const password = `DevWiki-ui-gate-${Date.now()}!`;
  let userId = null;
  const context = await browser.newContext();

  try {
    userId = await createTemporaryPasswordUser(
      admin,
      email,
      password,
      "DevWiki UI gated non-member",
    );
    const nonMemberSession = await createPasswordSession({
      url,
      publishableKey,
      email,
      password,
    });
    await seedBrowserSession({
      context,
      baseUrl,
      supabaseUrl,
      session: nonMemberSession.session,
    });

    const page = await context.newPage();
    const memberGate = page.getByText("멤버 등록이 필요합니다");

    await page.goto(baseUrl);
    await expect(memberGate).toBeVisible();
    await page.goto(`${baseUrl}/documents/new`);
    await expect(memberGate).toBeVisible();
    await expect(page.locator('[data-testid="document-editor"]')).toHaveCount(0);
    await page.goto(`${baseUrl}/documents/${slug}`);
    await expect(memberGate).toBeVisible();
    await page.goto(`${baseUrl}/documents/${slug}/edit`);
    await expect(memberGate).toBeVisible();
    await expect(page.locator('[data-testid="document-editor"]')).toHaveCount(0);

    report("pass", "Non-member browser routes gated", email);
  } finally {
    await context.close();

    if (userId) {
      const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);

      if (deleteUserError) {
        report(
          "warn",
          "UI E2E non-member browser cleanup failed",
          deleteUserError.message,
        );
      }
    }
  }
}

async function fillMarkdownEditor(page, markdown, marker) {
  const editor = page.locator(".cm-content").first();
  await editor.waitFor({ state: "visible", timeout: 15_000 });

  try {
    await editor.fill(markdown);
  } catch {
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText(markdown);
  }

  await page.waitForFunction(
    (expected) =>
      document
        .querySelector('input[name="body_markdown"]')
        ?.value.includes(expected),
    marker,
  );
}

async function assertImagesLoaded(page) {
  await page.waitForFunction(() =>
    [...document.images].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
}

async function assertMermaidDiagramCount(page, count) {
  await expect(page.locator('[data-testid="mermaid-block"] svg')).toHaveCount(
    count,
    { timeout: 15_000 },
  );
}

async function assertPasswordLogin(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/login`);
  await expect(
    page.getByRole("heading", { name: "이메일과 비밀번호로 로그인" }),
  ).toBeVisible();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "로그인" }).click();

  const expectedOrigin = new URL(baseUrl).origin;
  await page.waitForURL(
    (nextUrl) =>
      nextUrl.origin === expectedOrigin &&
      (nextUrl.pathname === "/" ||
        (nextUrl.pathname === "/login" && nextUrl.searchParams.has("error"))),
    { timeout: LOGIN_TIMEOUT_MS },
  );

  const currentUrl = new URL(page.url());

  if (currentUrl.pathname === "/login") {
    throw new Error(
      `Password login was rejected: ${currentUrl.searchParams.get("error")}`,
    );
  }

  await expect(page.getByText("백엔드 면접 개념 사전")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "새 문서", exact: true }),
  ).toBeVisible();
  report("pass", "Registered member can login with password", email);
}

async function assertMermaidErrorPreview(page, markdown) {
  const invalidMarkdown = `${markdown}

## Mermaid 오류 검증

\`\`\`mermaid
flowchart LR
  Broken -->
\`\`\`
`;

  await fillMarkdownEditor(page, invalidMarkdown, "Mermaid 오류 검증");
  await page.getByRole("button", { name: "미리보기" }).click();
  await expect(page.locator('[data-testid="mermaid-error"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('[data-testid="markdown-content"] h1')).toBeVisible();
  await page.getByRole("button", { name: "분할" }).click();
  report("pass", "Mermaid syntax error preview rendered");
}

async function createDocumentWithAutoSlug({
  page,
  baseUrl,
  title,
  expectedSlug,
  expectedInputSlug = expectedSlug,
  summary,
  cleanupSlugs,
}) {
  cleanupSlugs.add(expectedSlug);
  await page.goto(`${baseUrl}/documents/new`);
  await expect(page.locator('[data-testid="document-editor"]')).toBeVisible();
  await page.locator('input[name="title"]').fill(title);
  await expect(page.locator('input[name="slug"]')).toHaveValue(expectedInputSlug);
  await page.locator('input[name="slug"]').fill("");
  await page.locator('input[name="summary"]').fill(summary);
  await page.locator('input[name="edit_summary"]').fill("mvp ui auto slug");
  await fillMarkdownEditor(
    page,
    `# ${title}\n\n자동 slug 생성과 중복 회피를 검증합니다.`,
    "자동 slug 생성",
  );

  await Promise.all([
    page.waitForURL(
      (nextUrl) =>
        decodeURIComponent(nextUrl.pathname) !== "/documents/new" &&
        decodeURIComponent(nextUrl.pathname).startsWith("/documents/"),
    ),
    page.getByRole("button", { name: "저장" }).click(),
  ]);

  const actualSlug = decodeURIComponent(
    new URL(page.url()).pathname.split("/").pop() ?? "",
  );
  cleanupSlugs.add(actualSlug);

  if (actualSlug !== expectedSlug) {
    throw new Error(`Expected auto slug ${expectedSlug}, got ${actualSlug}`);
  }

  await expect(page.getByTestId("document-title")).toHaveText(title);
}

async function main() {
  loadEnvFile(".env.local");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const memberEmail = process.env.DEVWIKI_E2E_EMAIL?.trim().toLowerCase();
  const memberPassword = process.env.DEVWIKI_E2E_PASSWORD;
  const baseUrl = process.env.DEVWIKI_E2E_BASE_URL ?? "http://localhost:3000";

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.",
    );
  }

  if (!serviceRoleKey || !memberEmail || !memberPassword) {
    skipOrFail(
      "set SUPABASE_SERVICE_ROLE_KEY, DEVWIKI_E2E_EMAIL, and DEVWIKI_E2E_PASSWORD to run browser MVP checks",
    );
    return;
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const nonce = Date.now();
  const slug = `ui-e2e-${nonce}`;
  const title = `멱등성 UI 테스트 ${nonce}`;
  const updatedTitle = `${title} 수정`;
  const searchTag = `Search Probe ${nonce}`;
  const createSummary = "UI E2E 생성 검증";
  const updateSummary = "UI E2E 수정 검증";
  const createTags = `UI E2E ${nonce}, Mermaid UI ${nonce}, ${searchTag}`;
  const updateTags = `Revision UI ${nonce}, ${searchTag}`;
  const passwordLoginEmail = `devwiki-login-${nonce}@example.com`;
  const passwordLoginPassword = `DevWiki-login-${nonce}!`;
  const longMarkdownSection = makeLongMarkdownSection();
  const baseMarkdown = `# ${title}

## 핵심 정의

멱등성은 같은 요청을 여러 번 처리해도 결과 상태가 한 번 처리한 것과 같게 유지되는 성질입니다.

- 같은 key는 같은 결과를 반환해야 합니다.
- 재시도 가능한 작업은 부작용을 중복 적용하지 않습니다.

참고: [Supabase Auth](https://supabase.com/docs/guides/auth)

## 긴 문서 검증

${longMarkdownSection}

| 항목 | 설명 |
| --- | --- |
| HTTP | PUT, DELETE는 멱등하게 설계할 수 있습니다. |
| 재시도 | 네트워크 오류 이후 안전한 재처리를 돕습니다. |

\`\`\`ts
const requestId = "retry-safe-command";
\`\`\`

\`\`\`mermaid
flowchart LR
  Client[Client] --> API[API]
  API --> Store[(Processed Keys)]
  Store --> API
  API --> Client
\`\`\`

\`\`\`mermaid
sequenceDiagram
  participant Client
  participant API
  participant DB
  Client->>API: POST /payments with Idempotency-Key
  API->>DB: Find processed key
  DB-->>API: Existing result
  API-->>Client: Same response
\`\`\`
`;
  const assetPaths = new Set();
  const documentSlugs = new Set([slug]);
  let passwordLoginUserId = null;
  let browser;

  await ensureActiveMember(admin, memberEmail);
  await ensurePasswordAuthUser(
    admin,
    memberEmail,
    memberPassword,
    "DevWiki UI E2E",
  );

  try {
    const health = await fetch(baseUrl, { redirect: "manual" });

    if (!health.ok && (health.status < 300 || health.status >= 400)) {
      throw new Error(`Unexpected app response: ${health.status}`);
    }
  } catch (error) {
    throw new Error(
      `Dev server is not reachable at ${baseUrl}: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  await assertNonMemberBlocked({
    url,
    publishableKey,
    admin,
  });

  const memberSession = await createPasswordSession({
    url,
    publishableKey,
    email: memberEmail,
    password: memberPassword,
  });
  report("pass", "Password member session created", memberEmail);

  try {
    browser = await chromium.launch({
      headless: process.env.DEVWIKI_E2E_HEADFUL !== "1",
    });
  } catch (error) {
    throw new Error(
      `Chromium launch failed. Run 'npx playwright install chromium' first. ${
        error instanceof Error ? error.message : ""
      }`,
    );
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    passwordLoginUserId = await createTemporaryPasswordMember(
      admin,
      passwordLoginEmail,
      passwordLoginPassword,
    );
    await assertPasswordLogin(
      page,
      baseUrl,
      passwordLoginEmail,
      passwordLoginPassword,
    );
    await context.clearCookies();
    await seedBrowserSession({
      context,
      baseUrl,
      supabaseUrl: url,
      session: memberSession.session,
    });
    await page.goto(baseUrl);
    await expect(page.getByText("백엔드 면접 개념 사전")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "새 문서", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Supabase 연결 전 미리보기 모드입니다."),
    ).toHaveCount(0);
    report("pass", "Password browser session established");

    await page.goto(`${baseUrl}/documents/new`);
    await expect(page.locator('[data-testid="document-editor"]')).toBeVisible();
    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="slug"]').fill(slug);
    await page.locator('input[name="summary"]').fill(createSummary);
    await page.locator('input[name="tags"]').fill(createTags);
    await page.locator('input[name="edit_summary"]').fill("mvp ui create");
    await page.locator('select[name="status"]').selectOption("draft");
    await fillMarkdownEditor(page, baseMarkdown, "retry-safe-command");
    await assertMermaidErrorPreview(page, baseMarkdown);
    await fillMarkdownEditor(page, baseMarkdown, "retry-safe-command");
    await page.getByRole("button", { name: "편집" }).click();
    await expect(page.locator(".cm-content").first()).toBeVisible();
    await page.getByRole("button", { name: "분할" }).click();
    await expect(page.locator('[data-testid="markdown-content"]')).toBeVisible();

    await page.locator('[data-testid="image-input"]').setInputFiles({
      name: "diagram.png",
      mimeType: "image/png",
      buffer: tinyPng,
    });
    await expect(page.getByText("이미지를 Markdown에 삽입했습니다.")).toBeVisible(
      { timeout: 15_000 },
    );

    const bodyWithImage = await page
      .locator('input[name="body_markdown"]')
      .inputValue();
    extractAssetPaths(bodyWithImage).forEach((path) => assetPaths.add(path));

    if (!bodyWithImage.includes("/api/assets/")) {
      throw new Error("Image upload did not insert Markdown image syntax.");
    }

    const invalidUploadResponse = await page.request.post(
      `${baseUrl}/api/assets/upload`,
      {
        multipart: {
          file: {
            name: "invalid.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("not an image"),
          },
        },
      },
    );

    if (invalidUploadResponse.status() !== 415) {
      throw new Error(
        `Invalid image MIME should return 415, got ${invalidUploadResponse.status()}`,
      );
    }

    report("pass", "Authenticated upload API rejects invalid MIME type");

    await page.getByRole("button", { name: "미리보기" }).click();
    await expect(
      page.locator('[data-testid="markdown-content"] h1', { hasText: title }),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="markdown-content"] li', {
        hasText: "같은 key는 같은 결과를 반환해야 합니다.",
      }),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="markdown-content"] li', {
        hasText: "긴 문서 항목 30",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Supabase Auth" }),
    ).toHaveAttribute("href", /^https:\/\/supabase\.com\/docs\/guides\/auth\/?$/);
    await expect(page.locator('[data-testid="markdown-content"] table')).toBeVisible();
    await expect(page.locator('[data-testid="markdown-content"] pre')).toBeVisible();
    await assertMermaidDiagramCount(page, 2);
    await expect(page.locator('[data-testid="markdown-content"] img')).toBeVisible();
    await assertImagesLoaded(page);
    report("pass", "Editor Markdown, Mermaid, and image preview rendered");

    await Promise.all([
      page.waitForURL(`${baseUrl}/documents/${slug}`),
      page.getByRole("button", { name: "저장" }).click(),
    ]);
    await expect(page.getByTestId("document-title")).toHaveText(title);
    await expect(page.getByTestId("document-summary")).toHaveText(createSummary);
    await expect(
      page.locator('[data-testid="markdown-content"] li', {
        hasText: "같은 key는 같은 결과를 반환해야 합니다.",
      }),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="markdown-content"] li', {
        hasText: "긴 문서 항목 30",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Supabase Auth" }),
    ).toHaveAttribute("href", /^https:\/\/supabase\.com\/docs\/guides\/auth\/?$/);
    await expect(page.locator('[data-testid="markdown-content"] table')).toBeVisible();
    await assertMermaidDiagramCount(page, 2);
    await expect(page.locator('[data-testid="markdown-content"] img')).toBeVisible();
    await assertImagesLoaded(page);
    report("pass", "Document detail rendered Markdown, Mermaid, and image");

    await assertNonMemberBrowserGate({
      browser,
      baseUrl,
      supabaseUrl: url,
      url,
      publishableKey,
      admin,
      slug,
    });

    await page.getByRole("link", { name: "수정", exact: true }).click();
    await expect(page.locator('[data-testid="document-editor"]')).toBeVisible();
    const updatedMarkdown = `${bodyWithImage}

## 수정 확인

문서 수정 시 본문, 상태, 태그, 변경 이력이 함께 갱신되어야 합니다.
`;
    await page.locator('input[name="summary"]').fill(updateSummary);
    await page.locator('input[name="title"]').fill(updatedTitle);
    await page.locator('input[name="tags"]').fill(updateTags);
    await page.locator('input[name="edit_summary"]').fill("mvp ui update");
    await page.locator('select[name="status"]').selectOption("published");
    await fillMarkdownEditor(page, updatedMarkdown, "수정 확인");

    await Promise.all([
      page.waitForURL(`${baseUrl}/documents/${slug}`),
      page.getByRole("button", { name: "저장" }).click(),
    ]);
    await expect(page.getByTestId("document-title")).toHaveText(updatedTitle);
    await expect(page.getByTestId("document-summary")).toHaveText(updateSummary);
    await expect(page.getByText(`Revision UI ${nonce}`)).toBeVisible();
    await expect(page.locator('[data-testid="revision-history"]')).toContainText(
      "mvp ui update",
    );
    await expect(page.locator('[data-testid="revision-history"]')).toContainText(
      "mvp ui create",
    );
    report("pass", "Document edit and revision history rendered");

    const autoSlugTitle = `자동 슬러그 테스트 ${nonce}`;
    const autoSlug = slugify(autoSlugTitle);

    await createDocumentWithAutoSlug({
      page,
      baseUrl,
      title: autoSlugTitle,
      expectedSlug: autoSlug,
      summary: "자동 slug 생성 검증",
      cleanupSlugs: documentSlugs,
    });
    await createDocumentWithAutoSlug({
      page,
      baseUrl,
      title: autoSlugTitle,
      expectedSlug: `${autoSlug}-2`,
      expectedInputSlug: autoSlug,
      summary: "중복 slug 회피 검증",
      cleanupSlugs: documentSlugs,
    });
    report("pass", "Auto slug generation and duplicate slug avoidance verified");

    await page.goto(`${baseUrl}/?q=${encodeURIComponent(searchTag)}`);
    await expect(
      page.getByText("Supabase 연결 전 미리보기 모드입니다."),
    ).toHaveCount(0);
    const resultCard = page
      .locator('[data-testid="document-card"]')
      .filter({ hasText: updatedTitle });
    await expect(
      resultCard,
    ).toBeVisible();
    await expect(resultCard).toContainText(updateSummary);
    await expect(resultCard).toContainText("공개");
    await expect(resultCard).toContainText(`Revision UI ${nonce}`);
    await expect(resultCard.locator("time")).toBeVisible();
    await page.goto(`${baseUrl}/?q=${encodeURIComponent(`no-result-${nonce}`)}`);
    await expect(page.getByText("검색 결과가 없습니다")).toBeVisible();
    report("pass", "Tag search and empty search state verified");

    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.waitForURL(`${baseUrl}/login`);
    await page.goto(`${baseUrl}/documents/new`);
    await page.waitForURL(`${baseUrl}/login`);
    await page.goto(`${baseUrl}/documents/${slug}/edit`);
    await page.waitForURL(`${baseUrl}/login`);

    const firstAssetPath = [...assetPaths][0];

    if (!firstAssetPath) {
      throw new Error("No uploaded asset path was captured for access checks.");
    }

    const assetResponse = await page.request.get(
      `${baseUrl}/api/assets/${encodeAssetPath(firstAssetPath)}`,
    );

    if (assetResponse.status() !== 401) {
      throw new Error(
        `Anonymous asset read should return 401, got ${assetResponse.status()}`,
      );
    }

    const uploadResponse = await page.request.post(`${baseUrl}/api/assets/upload`, {
      multipart: {
        file: {
          name: "blocked.png",
          mimeType: "image/png",
          buffer: tinyPng,
        },
      },
    });

    if (uploadResponse.status() !== 401) {
      throw new Error(
        `Anonymous upload should return 401, got ${uploadResponse.status()}`,
      );
    }

    report("pass", "Logout gates document routes and asset APIs");
  } finally {
    await context.close();
    await browser.close();

    const { data: documents, error: documentLookupError } = await admin
      .from("documents")
      .select("id, body_markdown")
      .in("slug", [...documentSlugs]);

    if (documentLookupError) {
      report(
        "warn",
        "UI E2E document lookup cleanup failed",
        documentLookupError.message,
      );
    }

    for (const document of documents ?? []) {
      extractAssetPaths(document.body_markdown).forEach((path) =>
        assetPaths.add(path),
      );

      const { error: deleteError } = await admin
        .from("documents")
        .delete()
        .eq("id", document.id);

      if (deleteError) {
        report("warn", "UI E2E document cleanup failed", deleteError.message);
      }
    }

    if (assetPaths.size) {
      const { error: assetCleanupError } = await admin.storage
        .from(DEVWIKI_ASSETS_BUCKET)
        .remove([...assetPaths]);

      if (assetCleanupError) {
        report("warn", "UI E2E asset cleanup failed", assetCleanupError.message);
      }
    }

    const { error: tagCleanupError } = await admin
      .from("tags")
      .delete()
      .in("slug", tagSlugs(nonce));

    if (tagCleanupError) {
      report("warn", "UI E2E tag cleanup failed", tagCleanupError.message);
    }

    const { error: memberCleanupError } = await admin
      .from("members")
      .delete()
      .eq("email", passwordLoginEmail);

    if (memberCleanupError) {
      report(
        "warn",
        "UI E2E password login member cleanup failed",
        memberCleanupError.message,
      );
    }

    if (passwordLoginUserId) {
      const { error: userCleanupError } =
        await admin.auth.admin.deleteUser(passwordLoginUserId);

      if (userCleanupError) {
        report(
          "warn",
          "UI E2E password login user cleanup failed",
          userCleanupError.message,
        );
      }
    }
  }
}

main().catch((error) => {
  report("fail", "MVP UI E2E", error.message);
  process.exitCode = 1;
});
