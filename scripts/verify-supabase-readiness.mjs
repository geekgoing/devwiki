import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const requiredImageTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

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

async function expectBlocked(label, operation) {
  const result = await operation();

  if (!result.error) {
    throw new Error(`${label} unexpectedly succeeded`);
  }

  report("pass", label, result.error.message);
}

async function main() {
  loadEnvFile(".env.local");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.",
    );
  }

  report("pass", "Supabase public env configured", new URL(url).host);

  const anon = createClient(url, publishableKey, {
    auth: { persistSession: false },
  });

  await expectBlocked("Anonymous document insert blocked", () =>
    anon.from("documents").insert({
      slug: `anon-probe-${Date.now()}`,
      title: "Anon Probe",
      body_markdown: "This should be blocked by RLS.",
      status: "draft",
    }),
  );

  await expectBlocked("Anonymous asset upload blocked", () =>
    anon.storage
      .from("devwiki-assets")
      .upload(
        `anon-probe-${Date.now()}.png`,
        new Blob([Buffer.from("blocked")], { type: "image/png" }),
        { contentType: "image/png", upsert: false },
      ),
  );

  if (!serviceRoleKey) {
    report(
      "warn",
      "Service role checks skipped",
      "set SUPABASE_SERVICE_ROLE_KEY to verify members, bucket config, and revision trigger",
    );
    return;
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { count: memberCount, error: memberError } = await admin
    .from("study_members")
    .select("email", { count: "exact", head: true })
    .eq("is_active", true);

  if (memberError) {
    throw new Error(`Study member check failed: ${memberError.message}`);
  }

  if (!memberCount) {
    throw new Error("No active study_members rows found.");
  }

  report("pass", "Active study members found", `${memberCount}`);

  const { data: bucket, error: bucketError } =
    await admin.storage.getBucket("devwiki-assets");

  if (bucketError || !bucket) {
    throw new Error(
      `devwiki-assets bucket check failed: ${
        bucketError?.message ?? "bucket not found"
      }`,
    );
  }

  if (bucket.public) {
    throw new Error("devwiki-assets bucket must be private.");
  }

  const missingTypes = requiredImageTypes.filter(
    (mime) => !bucket.allowed_mime_types?.includes(mime),
  );

  if (missingTypes.length) {
    throw new Error(`Missing image MIME types: ${missingTypes.join(", ")}`);
  }

  report("pass", "Storage bucket config valid", "devwiki-assets");

  const probeSlug = `readiness-revision-${Date.now()}`;
  const { data: document, error: documentError } = await admin
    .from("documents")
    .insert({
      slug: probeSlug,
      title: "Readiness Revision Probe",
      body_markdown: "Initial body",
      status: "draft",
      edit_summary: "readiness insert",
    })
    .select("id")
    .single();

  if (documentError || !document) {
    throw new Error(
      `Revision probe insert failed: ${
        documentError?.message ?? "document not returned"
      }`,
    );
  }

  try {
    const { error: updateError } = await admin
      .from("documents")
      .update({ edit_summary: "readiness update only" })
      .eq("id", document.id);

    if (updateError) {
      throw new Error(`Revision probe update failed: ${updateError.message}`);
    }

    const { count: revisionCount, error: revisionError } = await admin
      .from("document_revisions")
      .select("id", { count: "exact", head: true })
      .eq("document_id", document.id);

    if (revisionError) {
      throw new Error(`Revision probe query failed: ${revisionError.message}`);
    }

    if ((revisionCount ?? 0) < 2) {
      throw new Error(
        "Revision trigger migration is not applied: update-only edit did not create a revision.",
      );
    }

    report("pass", "Revision trigger migration applied", `${revisionCount}`);
  } finally {
    const { error: deleteError } = await admin
      .from("documents")
      .delete()
      .eq("id", document.id);

    if (deleteError) {
      report("warn", "Revision probe cleanup failed", deleteError.message);
    }
  }
}

main().catch((error) => {
  report("fail", "Supabase readiness", error.message);
  process.exitCode = 1;
});
