import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installStagedOutput } from "../src/lib/update-output.server.js";

test("instala o build copiado e mantém backup persistente do build anterior", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "paracolor-output-update-"));
  const project = path.join(root, "project");
  const volume = path.join(root, "persistent-volume");
  const live = path.join(project, ".output");
  const staged = path.join(volume, "stage", ".output");
  const backup = path.join(volume, "updates", "output-previous");
  try {
    await mkdir(path.join(live, "server"), { recursive: true });
    await mkdir(path.join(staged, "server"), { recursive: true });
    await writeFile(path.join(live, "server", "version.txt"), "old");
    await writeFile(path.join(staged, "server", "version.txt"), "new");

    await installStagedOutput(staged, live, backup);

    assert.equal(await readFile(path.join(live, "server", "version.txt"), "utf8"), "new");
    assert.equal(await readFile(path.join(backup, "server", "version.txt"), "utf8"), "old");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("preserva o build atual quando a cópia do pacote falha", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "paracolor-output-update-fail-"));
  const project = path.join(root, "project");
  const live = path.join(project, ".output");
  const missingStaged = path.join(root, "missing", ".output");
  const backup = path.join(root, "updates", "output-previous");
  try {
    await mkdir(path.join(live, "server"), { recursive: true });
    await writeFile(path.join(live, "server", "version.txt"), "old");
    await assert.rejects(installStagedOutput(missingStaged, live, backup));
    assert.equal(await readFile(path.join(live, "server", "version.txt"), "utf8"), "old");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
