import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const DEVWIKI_ASSETS_BUCKET = "devwiki-assets";
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

async function ensureActiveMember(admin, email) {
  const { data, error } = await admin
    .from("study_members")
    .select("email")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Study member lookup failed: ${error.message}`);
  }

  if (data) {
    report("pass", "Active study member available", email);
    return;
  }

  if (process.env.DEVWIKI_E2E_MANAGE_MEMBER !== "1") {
    throw new Error(
      `${email} is not an active study member. Add it to study_members or set DEVWIKI_E2E_MANAGE_MEMBER=1 for test setup.`,
    );
  }

  const { error: upsertError } = await admin.from("study_members").upsert(
    {
      email,
      display_name: "DevWiki UI E2E",
      role: "editor",
      is_active: true,
    },
    { onConflict: "email" },
  );

  if (upsertError) {
    throw new Error(`Study member setup failed: ${upsertError.message}`);
  }

  report("pass", "Active study member created", email);
}

async function generateActionLink({ admin, email, redirectTo }) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error) {
    throw new Error(`Magic link generation failed: ${error.message}`);
  }

  const properties = data?.properties ?? {};
  const actionLink = properties.action_link ?? properties.actionLink;

  if (!actionLink) {
    throw new Error("Magic link did not return an action link.");
  }

  return actionLink;
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

async function main() {
  loadEnvFile(".env.local");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const memberEmail = process.env.DEVWIKI_E2E_EMAIL?.trim().toLowerCase();
  const baseUrl = process.env.DEVWIKI_E2E_BASE_URL ?? "http://localhost:3000";

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  if (!serviceRoleKey || !memberEmail) {
    skipOrFail(
      "set SUPABASE_SERVICE_ROLE_KEY and DEVWIKI_E2E_EMAIL to run browser MVP checks",
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
  const searchTag = `Search Probe ${nonce}`;
  const createSummary = "UI E2E 생성 검증";
  const updateSummary = "UI E2E 수정 검증";
  const createTags = `UI E2E ${nonce}, Mermaid UI ${nonce}, ${searchTag}`;
  const updateTags = `Revision UI ${nonce}, ${searchTag}`;
  const baseMarkdown = `# ${title}

## 핵심 정의

멱등성은 같은 요청을 여러 번 처리해도 결과 상태가 한 번 처리한 것과 같게 유지되는 성질입니다.

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
`;
  const assetPaths = new Set();
  let browser;

  await ensureActiveMember(admin, memberEmail);

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

  const actionLink = await generateActionLink({
    admin,
    email: memberEmail,
    redirectTo: `${baseUrl}/auth/callback`,
  });
  report("pass", "Magic link action link generated", memberEmail);

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
    await page.goto(actionLink);
    await page.waitForURL(
      (currentUrl) => currentUrl.origin === new URL(baseUrl).origin,
      { timeout: 30_000 },
    );
    await expect(page.getByText("백엔드 면접 개념 사전")).toBeVisible();
    await expect(page.getByRole("link", { name: /새 문서/ })).toBeVisible();
    report("pass", "Magic link browser session established");

    await page.goto(`${baseUrl}/documents/new`);
    await expect(page.locator('[data-testid="document-editor"]')).toBeVisible();
    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="slug"]').fill(slug);
    await page.locator('input[name="summary"]').fill(createSummary);
    await page.locator('input[name="tags"]').fill(createTags);
    await page.locator('input[name="edit_summary"]').fill("mvp ui create");
    await page.locator('select[name="status"]').selectOption("draft");
    await fillMarkdownEditor(page, baseMarkdown, "retry-safe-command");

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

    await page.getByRole("button", { name: "미리보기" }).click();
    await expect(
      page.locator('[data-testid="markdown-content"] h1', { hasText: title }),
    ).toBeVisible();
    await expect(page.locator('[data-testid="markdown-content"] table')).toBeVisible();
    await expect(page.locator('[data-testid="markdown-content"] pre')).toBeVisible();
    await expect(page.locator('[data-testid="mermaid-block"] svg')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="markdown-content"] img')).toBeVisible();
    await assertImagesLoaded(page);
    report("pass", "Editor Markdown, Mermaid, and image preview rendered");

    await Promise.all([
      page.waitForURL(`${baseUrl}/documents/${slug}`),
      page.getByRole("button", { name: "저장" }).click(),
    ]);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText(createSummary)).toBeVisible();
    await expect(page.locator('[data-testid="markdown-content"] table')).toBeVisible();
    await expect(page.locator('[data-testid="mermaid-block"] svg')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="markdown-content"] img')).toBeVisible();
    await assertImagesLoaded(page);
    report("pass", "Document detail rendered Markdown, Mermaid, and image");

    await page.getByRole("link", { name: /수정/ }).click();
    await expect(page.locator('[data-testid="document-editor"]')).toBeVisible();
    const updatedMarkdown = `${bodyWithImage}

## 수정 확인

문서 수정 시 본문, 상태, 태그, 변경 이력이 함께 갱신되어야 합니다.
`;
    await page.locator('input[name="summary"]').fill(updateSummary);
    await page.locator('input[name="tags"]').fill(updateTags);
    await page.locator('input[name="edit_summary"]').fill("mvp ui update");
    await page.locator('select[name="status"]').selectOption("published");
    await fillMarkdownEditor(page, updatedMarkdown, "수정 확인");

    await Promise.all([
      page.waitForURL(`${baseUrl}/documents/${slug}`),
      page.getByRole("button", { name: "저장" }).click(),
    ]);
    await expect(page.getByText(updateSummary)).toBeVisible();
    await expect(page.getByText(`Revision UI ${nonce}`)).toBeVisible();
    await expect(page.locator('[data-testid="revision-history"]')).toContainText(
      "mvp ui update",
    );
    await expect(page.locator('[data-testid="revision-history"]')).toContainText(
      "mvp ui create",
    );
    report("pass", "Document edit and revision history rendered");

    await page.goto(`${baseUrl}/?q=${encodeURIComponent(searchTag)}`);
    await expect(
      page.locator('[data-testid="document-card"]').filter({ hasText: title }),
    ).toBeVisible();
    await page.goto(`${baseUrl}/?q=${encodeURIComponent(`no-result-${nonce}`)}`);
    await expect(page.getByText("검색 결과가 없습니다")).toBeVisible();
    report("pass", "Tag search and empty search state verified");

    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.waitForURL(`${baseUrl}/login`);
    await page.goto(`${baseUrl}/documents/new`);
    await page.waitForURL(`${baseUrl}/login`);
    await page.goto(`${baseUrl}/documents/${slug}/edit`);
    await page.waitForURL(`${baseUrl}/login`);
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

    report("pass", "Logout gates document routes and upload API");
  } finally {
    await context.close();
    await browser.close();

    const { data: documents, error: documentLookupError } = await admin
      .from("documents")
      .select("id, body_markdown")
      .eq("slug", slug);

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
  }
}

main().catch((error) => {
  report("fail", "MVP UI E2E", error.message);
  process.exitCode = 1;
});
