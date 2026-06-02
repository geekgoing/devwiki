import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const RELEASE_DIR = path.join("docs", "releases");

function parseArgs(argv) {
  const args = {
    date: new Date().toISOString().slice(0, 10),
    notesFile: null,
    version: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--version") {
      args.version = next;
      index += 1;
      continue;
    }

    if (arg === "--notes-file") {
      args.notesFile = next;
      index += 1;
      continue;
    }

    if (arg === "--date") {
      args.date = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.version) {
    throw new Error("Missing --version");
  }

  return args;
}

function normalizeVersion(value) {
  const trimmed = value.trim();
  const version = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid semver version: ${value}`);
  }

  return {
    tag: `v${version}`,
    version,
  };
}

function buildReleaseDoc({ date, notes, tag }) {
  const releaseNotes = notes.trim() || "No release notes were generated.";

  return `# DevWiki ${tag} Release Notes

Release date: ${date}

## GitHub Release Notes

${releaseNotes}
`;
}

async function readReleaseNotes(notesFile) {
  if (!notesFile) {
    return "";
  }

  return readFile(notesFile, "utf8");
}

function updateReadmeReleaseLink(readme, tag) {
  const section = `## Release notes

- [${tag}](docs/releases/${tag}.md): latest release notes
`;

  if (readme.includes("## Release notes")) {
    return readme.replace(
      /## Release notes\n\n(?:- .+\n?)+/,
      section,
    );
  }

  const marker = "## Member management";

  if (!readme.includes(marker)) {
    return `${readme.trimEnd()}\n\n${section}`;
  }

  return readme.replace(marker, `${section}\n${marker}`);
}

async function renameLatestReleaseDocIfNeeded(targetPath, targetTag) {
  let entries = [];

  try {
    entries = await readdir(RELEASE_DIR);
  } catch {
    return;
  }

  if (entries.includes(`${targetTag}.md`)) {
    return;
  }

  const releaseDocs = entries
    .filter((entry) => /^v\d+\.\d+\.\d+\.md$/.test(entry))
    .sort((left, right) =>
      right.localeCompare(left, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

  if (releaseDocs.length !== 1) {
    return;
  }

  await rename(
    path.join(RELEASE_DIR, releaseDocs[0]),
    targetPath,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { tag } = normalizeVersion(args.version);
  const notes = await readReleaseNotes(args.notesFile);
  const releasePath = path.join(RELEASE_DIR, `${tag}.md`);

  await mkdir(RELEASE_DIR, { recursive: true });
  await renameLatestReleaseDocIfNeeded(releasePath, tag);
  await writeFile(
    releasePath,
    buildReleaseDoc({
      date: args.date,
      notes,
      tag,
    }),
  );

  const readme = await readFile("README.md", "utf8");
  await writeFile("README.md", updateReadmeReleaseLink(readme, tag));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
