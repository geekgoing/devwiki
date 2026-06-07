import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RELEASE_DIR = path.join("docs", "releases");

export function parseArgs(argv) {
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

export function normalizeVersion(value) {
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

export function buildReleaseDoc({ date, notes, tag }) {
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

export function updateReadmeReleaseLink(readme, tag) {
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

export async function syncReleaseDocs({ cwd = process.cwd(), date, notesFile, version }) {
  const { tag } = normalizeVersion(version);
  const notes = await readReleaseNotes(notesFile);
  const releasePath = path.join(cwd, RELEASE_DIR, `${tag}.md`);

  await mkdir(path.join(cwd, RELEASE_DIR), { recursive: true });
  await writeFile(
    releasePath,
    buildReleaseDoc({
      date,
      notes,
      tag,
    }),
  );

  const readmePath = path.join(cwd, "README.md");
  const readme = await readFile(readmePath, "utf8");
  await writeFile(readmePath, updateReadmeReleaseLink(readme, tag));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  await syncReleaseDocs({
    date: args.date,
    notesFile: args.notesFile,
    version: args.version,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
