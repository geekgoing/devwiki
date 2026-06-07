import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { syncReleaseDocs } from "./sync-release-docs.mjs";

const tempDirs = [];

async function makeFixture() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "devwiki-release-docs-"));
  tempDirs.push(cwd);

  await mkdir(path.join(cwd, "docs", "releases"), { recursive: true });
  await writeFile(
    path.join(cwd, "README.md"),
    `# DevWiki

## Release notes

- [v0.9.0](docs/releases/v0.9.0.md): latest release notes

## Member management
`,
  );
  await writeFile(
    path.join(cwd, "docs", "releases", "v0.9.0.md"),
    "# DevWiki v0.9.0 Release Notes\n",
  );
  await writeFile(
    path.join(cwd, "release-notes.md"),
    "## [0.10.0](https://github.com/geekgoing/devwiki/compare/v0.9.0...v0.10.0)\n",
  );

  return cwd;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("syncReleaseDocs", () => {
  it("adds the new release doc without deleting older release docs", async () => {
    const cwd = await makeFixture();

    await syncReleaseDocs({
      cwd,
      date: "2026-06-02",
      notesFile: path.join(cwd, "release-notes.md"),
      version: "v0.10.0",
    });

    await expect(readFile(path.join(cwd, "docs", "releases", "v0.9.0.md"), "utf8"))
      .resolves.toContain("v0.9.0");
    await expect(readFile(path.join(cwd, "docs", "releases", "v0.10.0.md"), "utf8"))
      .resolves.toContain("0.10.0");
    await expect(readFile(path.join(cwd, "README.md"), "utf8"))
      .resolves.toContain("[v0.10.0](docs/releases/v0.10.0.md)");
  });
});
