import { cp, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Installs a build staged elsewhere (often on a Docker volume) without using
 * cross-device rename. The saved copy lives in persistent update storage;
 * candidate and rollback directories stay beside the live .output for atomic
 * renames on the same filesystem.
 */
export async function installStagedOutput(stagedOutput, liveOutput, persistentBackup) {
  const projectDir = path.dirname(liveOutput);
  const suffix = randomUUID();
  const candidate = path.join(projectDir, `.output-install-${suffix}`);
  const rollback = path.join(projectDir, `.output-rollback-${suffix}`);
  let oldOutputMoved = false;

  try {
    await mkdir(path.dirname(persistentBackup), { recursive: true });
    await cp(liveOutput, persistentBackup, { recursive: true, errorOnExist: true, force: false });
    await cp(stagedOutput, candidate, { recursive: true, errorOnExist: true, force: false });
    await rename(liveOutput, rollback);
    oldOutputMoved = true;
    try {
      await rename(candidate, liveOutput);
    } catch (error) {
      await rename(rollback, liveOutput);
      oldOutputMoved = false;
      throw error;
    }
    oldOutputMoved = false;
    await rm(rollback, { recursive: true, force: true }).catch(() => {});
    return persistentBackup;
  } catch (error) {
    if (oldOutputMoved) await rename(rollback, liveOutput).catch(() => {});
    throw error;
  } finally {
    await rm(candidate, { recursive: true, force: true }).catch(() => {});
  }
}
