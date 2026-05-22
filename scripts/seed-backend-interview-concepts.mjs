import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const defaultSourcePaths = [
  "content/backend-interview-concepts.json",
  "content/backend-interview-concepts-extra.json",
].map((path) => resolve(projectRoot, path));
const importEditSummary = "백엔드 면접 개념 데이터 동기화";

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
    // CI or hosted environments can provide env vars without a local file.
  }
}

function readArgs(name) {
  const values = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
    }
  }

  return values;
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function asList(items, fallback = "정리 예정") {
  if (!items?.length) {
    return `- ${fallback}`;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function escapeMermaidLabel(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
}

function makeFlowMermaid(flow) {
  if (!flow?.length) {
    return "";
  }

  const lines = ["```mermaid", "flowchart LR"];

  flow.forEach((step, index) => {
    const nodeId = `S${index + 1}`;
    const label = step.sub ? `${step.text}<br/>${step.sub}` : step.text;
    lines.push(`  ${nodeId}["${escapeMermaidLabel(label)}"]`);
  });

  for (let index = 1; index < flow.length; index += 1) {
    lines.push(`  S${index} --> S${index + 1}`);
  }

  lines.push("```");
  return lines.join("\n");
}

function makeRelatedList(related, conceptById) {
  if (!related?.length) {
    return "- 연결 개념 없음";
  }

  return related
    .map((id) => {
      const concept = conceptById.get(id);
      const title = concept?.title ?? id;
      const slug = concept?.slug ?? slugify(id);

      return `- [${title}](/documents/${encodeURIComponent(slug)})`;
    })
    .join("\n");
}

function makeBodyMarkdown(concept, conceptById) {
  const diagram = makeFlowMermaid(concept.flow);
  const sections = [
    `# ${concept.title}`,
    `> ${concept.summary}`,
    "## 왜 이 개념이 나왔나",
    concept.problem,
    "## 어떻게 동작하나",
    asList(concept.how),
    "## 깊게 말할 포인트",
    asList(concept.deep),
    "## 구현 / 설계 체크리스트",
    asList(concept.implementation),
    "## 주의할 점 / Trade-off",
    asList(concept.tradeoffs),
  ];

  if (diagram) {
    sections.push("## 흐름으로 보기", diagram);
  }

  sections.push(
    "## 헷갈리는 비교",
    concept.compare || "정리 예정",
    "## 위험 신호",
    asList(concept.redflags),
    "## 면접 답변 예시",
    concept.answer,
    "## 실무 예시",
    concept.example,
    "## 꼬리 질문",
    asList(concept.questions),
    "## 연결 개념",
    makeRelatedList(concept.related, conceptById),
  );

  return `${sections.join("\n\n")}\n`;
}

function loadConceptFile(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));

  if (!Array.isArray(raw.concepts)) {
    throw new Error(`${path}에서 concepts 배열을 찾을 수 없습니다.`);
  }

  const concepts = raw.concepts.map((concept) => {
    const slug = slugify(concept.id);

    if (!slug) {
      throw new Error(`유효하지 않은 concept id입니다: ${concept.id}`);
    }

    return {
      ...concept,
      slug,
      tags: unique(["백엔드 면접", ...(concept.tags ?? [])]),
    };
  });

  return {
    ...raw,
    path,
    concepts,
  };
}

function loadConceptData(paths) {
  const conceptsById = new Map();

  for (const path of paths) {
    const data = loadConceptFile(path);

    for (const concept of data.concepts) {
      conceptsById.set(concept.id, concept);
    }
  }

  return {
    concepts: [...conceptsById.values()],
    paths,
  };
}

function makeDocuments(concepts) {
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));

  return concepts.map((concept) => ({
    slug: concept.slug,
    title: concept.title,
    summary: concept.summary,
    body_markdown: makeBodyMarkdown(concept, conceptById),
    status: "published",
    tags: concept.tags,
    related: concept.related ?? [],
  }));
}

function createAdminClient() {
  loadEnvFile(resolve(projectRoot, ".env.local"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function hasDocumentChanged(existing, document) {
  return (
    existing.title !== document.title ||
    (existing.summary ?? "") !== (document.summary ?? "") ||
    existing.body_markdown !== document.body_markdown ||
    existing.status !== document.status
  );
}

async function upsertDocument(admin, document) {
  const { data: existing, error: selectError } = await admin
    .from("documents")
    .select("id, title, summary, body_markdown, status")
    .eq("slug", document.slug)
    .maybeSingle();

  if (selectError) {
    throw new Error(`문서 조회 실패(${document.slug}): ${selectError.message}`);
  }

  if (existing) {
    if (!hasDocumentChanged(existing, document)) {
      return { id: existing.id, action: "unchanged" };
    }

    const { data, error } = await admin
      .from("documents")
      .update({
        title: document.title,
        summary: document.summary,
        body_markdown: document.body_markdown,
        status: document.status,
        edit_summary: importEditSummary,
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) {
      throw new Error(`문서 업데이트 실패(${document.slug}): ${error.message}`);
    }

    return { id: data.id, action: "updated" };
  }

  const { data, error } = await admin
    .from("documents")
    .insert({
      slug: document.slug,
      title: document.title,
      summary: document.summary,
      body_markdown: document.body_markdown,
      status: document.status,
      edit_summary: importEditSummary,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`문서 생성 실패(${document.slug}): ${error.message}`);
  }

  return { id: data.id, action: "created" };
}

async function replaceDocumentTags(admin, documentId, tagNames) {
  const rows = unique(tagNames)
    .map((name) => ({
      name,
      slug: slugify(name, 60),
    }))
    .filter((tag) => tag.slug);

  const { error: deleteError } = await admin
    .from("document_tags")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    throw new Error(`문서 태그 삭제 실패: ${deleteError.message}`);
  }

  if (!rows.length) {
    return;
  }

  const { error: upsertError } = await admin
    .from("tags")
    .upsert(rows, { onConflict: "slug" });

  if (upsertError) {
    throw new Error(`태그 저장 실패: ${upsertError.message}`);
  }

  const { data: tags, error: selectError } = await admin
    .from("tags")
    .select("id, slug")
    .in(
      "slug",
      rows.map((row) => row.slug),
    );

  if (selectError) {
    throw new Error(`태그 조회 실패: ${selectError.message}`);
  }

  const tagIds = new Map((tags ?? []).map((tag) => [tag.slug, tag.id]));
  const linkRows = rows
    .map((row) => tagIds.get(row.slug))
    .filter(Boolean)
    .map((tagId) => ({
      document_id: documentId,
      tag_id: tagId,
    }));

  if (!linkRows.length) {
    return;
  }

  const { error: insertError } = await admin
    .from("document_tags")
    .insert(linkRows);

  if (insertError) {
    throw new Error(`문서 태그 연결 실패: ${insertError.message}`);
  }
}

function isMissingTableError(error, tableName) {
  return (
    error?.code === "PGRST205" ||
    error?.message?.includes(tableName) ||
    error?.message?.includes("Could not find the table")
  );
}

async function canUseDocumentLinks(admin) {
  const { error } = await admin
    .from("document_links")
    .select("source_document_id")
    .limit(1);

  if (!error) {
    return true;
  }

  if (isMissingTableError(error, "document_links")) {
    return false;
  }

  throw new Error(`연관 문서 테이블 확인 실패: ${error.message}`);
}

async function replaceDocumentLinks(admin, documents, documentIdsBySlug) {
  if (!(await canUseDocumentLinks(admin))) {
    console.log(
      "WARN document_links 테이블이 원격에 없어 연관 문서 관계 저장은 건너뜁니다.",
    );
    return false;
  }

  const sourceIds = documents
    .map((document) => documentIdsBySlug.get(document.slug))
    .filter(Boolean);

  if (sourceIds.length) {
    const { error: deleteError } = await admin
      .from("document_links")
      .delete()
      .in("source_document_id", sourceIds);

    if (deleteError) {
      throw new Error(`연관 문서 삭제 실패: ${deleteError.message}`);
    }
  }

  const linkRows = [];

  for (const document of documents) {
    const sourceDocumentId = documentIdsBySlug.get(document.slug);

    if (!sourceDocumentId) {
      continue;
    }

    for (const targetSlug of document.related) {
      const targetDocumentId = documentIdsBySlug.get(slugify(targetSlug));

      if (!targetDocumentId || sourceDocumentId === targetDocumentId) {
        continue;
      }

      linkRows.push({
        source_document_id: sourceDocumentId,
        target_document_id: targetDocumentId,
      });
    }
  }

  if (!linkRows.length) {
    return true;
  }

  const { error: insertError } = await admin.from("document_links").insert(
    linkRows,
  );

  if (insertError) {
    throw new Error(`연관 문서 저장 실패: ${insertError.message}`);
  }

  return true;
}

async function main() {
  const explicitSources = readArgs("--source").map((path) => resolve(path));
  const sourcePaths = explicitSources.length
    ? explicitSources
    : defaultSourcePaths.filter((path) => existsSync(path));
  const dryRun = process.argv.includes("--dry-run");
  const data = loadConceptData(sourcePaths);
  const documents = makeDocuments(data.concepts);

  console.log(
    `INFO ${documents.length}개 백엔드 면접 개념 문서를 준비했습니다. source=${sourcePaths.length}개`,
  );

  if (dryRun) {
    console.log(`INFO dry-run: ${documents.map((doc) => doc.slug).join(", ")}`);
    return;
  }

  const admin = createAdminClient();
  const documentIdsBySlug = new Map();
  const actionCounts = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };

  for (const document of documents) {
    const result = await upsertDocument(admin, document);
    actionCounts[result.action] += 1;
    documentIdsBySlug.set(document.slug, result.id);
    await replaceDocumentTags(admin, result.id, document.tags);
  }

  const linksSaved = await replaceDocumentLinks(
    admin,
    documents,
    documentIdsBySlug,
  );

  console.log(
    [
      `PASS 문서 생성 ${actionCounts.created}개`,
      `업데이트 ${actionCounts.updated}개`,
      `변경 없음 ${actionCounts.unchanged}개`,
      `연관 문서 ${linksSaved ? "저장" : "건너뜀"}`,
    ].join(" / "),
  );
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
