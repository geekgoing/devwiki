import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";

const DEVWIKI_ASSETS_BUCKET = "devwiki-assets";
const MEMBER_TAGS = [
  { name: "MVP E2E", slugPrefix: "mvp-e2e" },
  { name: "Idempotency", slugPrefix: "idempotency" },
];
const UPDATED_TAGS = [
  { name: "Revision Probe", slugPrefix: "revision-probe" },
  { name: "Search Probe", slugPrefix: "search-probe" },
];
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

  report("warn", "MVP data E2E skipped", message);
}

function encodeAssetPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function makeTags(definitions, nonce) {
  return definitions.map(({ name, slugPrefix }) => ({
    name,
    slug: `${slugPrefix}-${nonce}`,
  }));
}

function flattenTagNames(relations = []) {
  return relations.flatMap((relation) => {
    if (!relation.tags) {
      return [];
    }

    return Array.isArray(relation.tags)
      ? relation.tags.map((tag) => tag.name)
      : [relation.tags.name];
  });
}

async function expectBlocked(label, operation) {
  const { error } = await operation();

  if (!error) {
    throw new Error(`${label} unexpectedly succeeded`);
  }

  report("pass", label, error.message);
}

async function createMagicLinkSession({
  url,
  publishableKey,
  admin,
  email,
  redirectTo,
}) {
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

  if (linkError) {
    throw new Error(`Magic link generation failed: ${linkError.message}`);
  }

  const properties = linkData?.properties ?? {};
  const tokenHash = properties.hashed_token ?? properties.hashedToken;
  const emailOtp = properties.email_otp ?? properties.emailOtp;
  const client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const verifyParams = tokenHash
    ? { email, token_hash: tokenHash, type: "email" }
    : { email, token: emailOtp, type: "email" };

  if (!tokenHash && !emailOtp) {
    throw new Error("Magic link did not return a token hash or OTP.");
  }

  const { data: authData, error: verifyError } =
    await client.auth.verifyOtp(verifyParams);

  if (verifyError || !authData.session || !authData.user) {
    throw new Error(
      `Magic link verification failed: ${
        verifyError?.message ?? "session was not returned"
      }`,
    );
  }

  return {
    client,
    session: authData.session,
    user: authData.user,
  };
}

async function assertActiveMember(admin, email) {
  const { data, error } = await admin
    .from("study_members")
    .select("email")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Study member lookup failed: ${error.message}`);
  }

  if (!data) {
    if (process.env.DEVWIKI_E2E_MANAGE_MEMBER !== "1") {
      throw new Error(
        `${email} is not an active study member. Add it to study_members or set DEVWIKI_E2E_MANAGE_MEMBER=1 for test setup.`,
      );
    }

    const { error: upsertError } = await admin.from("study_members").upsert(
      {
        email,
        display_name: "DevWiki E2E",
        role: "editor",
        is_active: true,
      },
      { onConflict: "email" },
    );

    if (upsertError) {
      throw new Error(`Study member setup failed: ${upsertError.message}`);
    }
  }

  report("pass", "Active study member available", email);
}

async function replaceDocumentTags(client, documentId, tags) {
  const { error: deleteError } = await client
    .from("document_tags")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    throw new Error(`Tag relation cleanup failed: ${deleteError.message}`);
  }

  const { data: tagRows, error: tagError } = await client
    .from("tags")
    .upsert(tags, { onConflict: "slug" })
    .select("id, name, slug");

  if (tagError) {
    throw new Error(`Tag upsert failed: ${tagError.message}`);
  }

  const { error: relationError } = await client.from("document_tags").insert(
    (tagRows ?? []).map((tag) => ({
      document_id: documentId,
      tag_id: tag.id,
    })),
  );

  if (relationError) {
    throw new Error(`Tag relation insert failed: ${relationError.message}`);
  }
}

async function main() {
  loadEnvFile(".env.local");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const memberEmail = process.env.DEVWIKI_E2E_EMAIL?.trim().toLowerCase();

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.",
    );
  }

  if (!serviceRoleKey || !memberEmail) {
    skipOrFail(
      "set SUPABASE_SERVICE_ROLE_KEY and DEVWIKI_E2E_EMAIL to run authenticated MVP data checks",
    );
    return;
  }

  const redirectTo =
    process.env.DEVWIKI_E2E_REDIRECT_TO ?? "http://localhost:3000/auth/callback";
  const nonce = Date.now();
  const slug = `mvp-e2e-${nonce}`;
  const title = `멱등성 테스트 ${nonce}`;
  const updatedTitle = `${title} 수정`;
  const assetPath = `mvp-e2e/${slug}/diagram.png`;
  const imageMarkdown = `![idempotency diagram](/api/assets/${encodeAssetPath(
    assetPath,
  )})`;
  const longMarkdownSection = Array.from(
    { length: 30 },
    (_, index) =>
      `- 긴 문서 항목 ${index + 1}: 면접 답변을 확장해도 Markdown 원문이 유지됩니다.`,
  ).join("\n");
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
sequenceDiagram
  participant Client
  participant API
  participant DB
  Client->>API: POST /payments with Idempotency-Key
  API->>DB: Find processed key
  DB-->>API: Existing result
  API-->>Client: Same response
\`\`\`

${imageMarkdown}
`;
  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let documentId = null;
  let nonMemberUserId = null;

  try {
    await assertActiveMember(admin, memberEmail);

    const memberSession = await createMagicLinkSession({
      url,
      publishableKey,
      admin,
      email: memberEmail,
      redirectTo,
    });
    report("pass", "Magic link member session created", memberEmail);

    const nonMemberEmail = `devwiki-nonmember-${nonce}@example.com`;
    const nonMemberSession = await createMagicLinkSession({
      url,
      publishableKey,
      admin,
      email: nonMemberEmail,
      redirectTo,
    });
    nonMemberUserId = nonMemberSession.user.id;

    await expectBlocked("Non-member document insert blocked", () =>
      nonMemberSession.client.from("documents").insert({
        slug: `blocked-${slug}`,
        title: "Blocked non-member document",
        body_markdown: "This insert must be blocked.",
        status: "draft",
        created_by: nonMemberSession.user.id,
        updated_by: nonMemberSession.user.id,
      }),
    );

    await expectBlocked("Non-member asset upload blocked", () =>
      nonMemberSession.client.storage
        .from(DEVWIKI_ASSETS_BUCKET)
        .upload(
          `mvp-e2e/blocked-${slug}.png`,
          new Blob([tinyPng], { type: "image/png" }),
          { contentType: "image/png", upsert: false },
        ),
    );

    const { error: uploadError } = await memberSession.client.storage
      .from(DEVWIKI_ASSETS_BUCKET)
      .upload(assetPath, new Blob([tinyPng], { type: "image/png" }), {
        cacheControl: "3600",
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Member image upload failed: ${uploadError.message}`);
    }

    report("pass", "Member image upload succeeded", assetPath);

    await expectBlocked("Invalid image MIME blocked", () =>
      memberSession.client.storage
        .from(DEVWIKI_ASSETS_BUCKET)
        .upload(
          `mvp-e2e/${slug}/invalid.txt`,
          new Blob(["not an image"], { type: "text/plain" }),
          { contentType: "text/plain", upsert: false },
        ),
    );

    const { data: document, error: documentError } = await memberSession.client
      .from("documents")
      .insert({
        slug,
        title,
        summary: "MVP 데이터 E2E 생성 검증",
        body_markdown: baseMarkdown,
        status: "draft",
        created_by: memberSession.user.id,
        updated_by: memberSession.user.id,
        edit_summary: "mvp e2e create",
      })
      .select("id, slug")
      .single();

    if (documentError || !document) {
      throw new Error(
        `Member document insert failed: ${
          documentError?.message ?? "document was not returned"
        }`,
      );
    }

    documentId = document.id;
    report("pass", "Member document insert succeeded", slug);

    await replaceDocumentTags(
      memberSession.client,
      documentId,
      makeTags(MEMBER_TAGS, nonce),
    );
    report("pass", "Initial document tags connected");

    const updatedMarkdown = `${baseMarkdown}

## 수정 확인

문서 수정 시 본문과 태그가 함께 갱신되어야 합니다.
`;

    const { error: updateError } = await memberSession.client
      .from("documents")
      .update({
        title: updatedTitle,
        summary: "MVP 데이터 E2E 수정 검증",
        body_markdown: updatedMarkdown,
        status: "published",
        updated_by: memberSession.user.id,
        edit_summary: "mvp e2e update",
      })
      .eq("id", documentId);

    if (updateError) {
      throw new Error(`Member document update failed: ${updateError.message}`);
    }

    await replaceDocumentTags(
      memberSession.client,
      documentId,
      makeTags(UPDATED_TAGS, nonce),
    );
    report("pass", "Document update and tag refresh succeeded");

    const { error: summaryOnlyError } = await memberSession.client
      .from("documents")
      .update({
        edit_summary: "mvp e2e edit-summary-only revision",
        updated_by: memberSession.user.id,
      })
      .eq("id", documentId);

    if (summaryOnlyError) {
      throw new Error(
        `Edit-summary-only update failed: ${summaryOnlyError.message}`,
      );
    }

    const { data: revisions, error: revisionError } = await memberSession.client
      .from("document_revisions")
      .select("id, title, summary, body_markdown, edit_summary, edited_by, created_at")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false });

    if (revisionError) {
      throw new Error(`Revision lookup failed: ${revisionError.message}`);
    }

    if (!revisions || revisions.length < 3) {
      throw new Error(
        "Expected at least 3 revisions: create, content update, and edit-summary-only update.",
      );
    }

    if (
      revisions.some(
        (revision) =>
          !revision.title ||
          !revision.body_markdown ||
          !revision.edit_summary ||
          revision.edited_by !== memberSession.user.id,
      )
    ) {
      throw new Error("Revision snapshot fields are incomplete.");
    }

    report("pass", "Revision snapshots captured", `${revisions.length}`);

    const { data: detail, error: detailError } = await memberSession.client
      .from("documents")
      .select(
        "id, slug, title, summary, body_markdown, status, document_tags(tags(name, slug))",
      )
      .eq("id", documentId)
      .single();

    if (detailError || !detail) {
      throw new Error(
        `Document detail lookup failed: ${
          detailError?.message ?? "document was not returned"
        }`,
      );
    }

    const tagNames = flattenTagNames(detail.document_tags);

    for (const requiredText of [
      "- 같은 key는 같은 결과를 반환해야 합니다.",
      "긴 문서 항목 30",
      "[Supabase Auth](https://supabase.com/docs/guides/auth)",
      "| 항목 | 설명 |",
      "```ts",
      "```mermaid",
      "sequenceDiagram",
      imageMarkdown,
    ]) {
      if (!detail.body_markdown.includes(requiredText)) {
        throw new Error(`Markdown body is missing: ${requiredText}`);
      }
    }

    if (
      detail.title !== updatedTitle ||
      detail.status !== "published" ||
      !tagNames.includes("Revision Probe") ||
      !tagNames.includes("Search Probe")
    ) {
      throw new Error("Document detail does not reflect updated title/status/tags.");
    }

    report("pass", "Markdown body and updated tags persisted");

    const { data: listRows, error: listError } = await memberSession.client
      .from("documents")
      .select(
        "id, slug, title, summary, status, updated_at, document_tags(tags(name, slug))",
      )
      .order("updated_at", { ascending: false })
      .limit(100);

    if (listError) {
      throw new Error(`Document list lookup failed: ${listError.message}`);
    }

    const matchingListRow = (listRows ?? []).find((row) => row.slug === slug);
    const searchableText = [
      matchingListRow?.title,
      matchingListRow?.summary,
      ...flattenTagNames(matchingListRow?.document_tags),
    ]
      .join(" ")
      .toLowerCase();

    if (
      !matchingListRow ||
      !searchableText.includes("멱등성") ||
      !searchableText.includes("revision probe")
    ) {
      throw new Error("Document list/search payload is incomplete.");
    }

    report("pass", "Document list includes searchable title, summary, and tags");

    const { data: signedUrl, error: signedUrlError } =
      await memberSession.client.storage
        .from(DEVWIKI_ASSETS_BUCKET)
        .createSignedUrl(assetPath, 60);

    if (signedUrlError || !signedUrl?.signedUrl) {
      throw new Error(
        `Uploaded image signed URL failed: ${
          signedUrlError?.message ?? "signed URL was not returned"
        }`,
      );
    }

    report("pass", "Uploaded image is readable through signed URL");
  } finally {
    if (documentId) {
      const { error } = await admin.from("documents").delete().eq("id", documentId);

      if (error) {
        report("warn", "E2E document cleanup failed", error.message);
      }
    }

    const { error: assetCleanupError } = await admin.storage
      .from(DEVWIKI_ASSETS_BUCKET)
      .remove([assetPath]);

    if (assetCleanupError) {
      report("warn", "E2E asset cleanup failed", assetCleanupError.message);
    }

    const tagSlugs = [
      ...makeTags(MEMBER_TAGS, nonce),
      ...makeTags(UPDATED_TAGS, nonce),
    ].map((tag) => tag.slug);
    const { error: tagCleanupError } = await admin
      .from("tags")
      .delete()
      .in("slug", tagSlugs);

    if (tagCleanupError) {
      report("warn", "E2E tag cleanup failed", tagCleanupError.message);
    }

    if (nonMemberUserId) {
      const { error: deleteUserError } =
        await admin.auth.admin.deleteUser(nonMemberUserId);

      if (deleteUserError) {
        report("warn", "E2E non-member cleanup failed", deleteUserError.message);
      }
    }
  }
}

main().catch((error) => {
  report("fail", "MVP data E2E", error.message);
  process.exitCode = 1;
});
