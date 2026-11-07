import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repository = process.env.GITHUB_REPOSITORY || "ricardomartinsdesigner-pixel/Novo-sistema-de-revelacao-paracolor";
const releaseApi = `https://api.github.com/repos/${repository}/releases/latest`;
const maxArchiveBytes = 250 * 1024 * 1024;
const stateRoot = process.env.UPDATE_STATE_DIR || path.join(process.cwd(), "data", "updates");

async function currentVersion() {
  try { return (await readFile(path.join(stateRoot, "current-version"), "utf8")).trim(); }
  catch { return process.env.APP_VERSION || "1.0.2"; }
}

function version(tag) {
  const match = String(tag || "").match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? match.slice(1).map(Number) : null;
}

function isNewer(candidate, current) {
  const next = version(candidate);
  const installed = version(current);
  if (!next) return false;
  if (!installed) return true;
  for (let index = 0; index < 3; index += 1) {
    if (next[index] !== installed[index]) return next[index] > installed[index];
  }
  return false;
}

async function getLatestRelease() {
  const headers = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "Paracolor-Updater" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(releaseApi, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`GitHub respondeu HTTP ${response.status}. Verifique se a primeira versão foi publicada como Release.`);
  const release = await response.json();
  const archive = release.assets?.find((asset) => asset.name === "paracolor-output.tar.gz");
  const checksum = release.assets?.find((asset) => asset.name === "paracolor-output.tar.gz.sha256");
  if (!archive || !checksum) throw new Error("A Release não contém o pacote e o checksum esperados.");
  const installedVersion = await currentVersion();
  return {
    version: String(release.tag_name || "").replace(/^v/, ""),
    current_version: installedVersion,
    available: isNewer(release.tag_name, installedVersion),
    release_url: release.html_url,
    notes: String(release.body || "").slice(0, 3000),
    archive_url: archive.browser_download_url,
    checksum_url: checksum.browser_download_url,
  };
}

export async function checkLatestGithubUpdate() {
  return getLatestRelease();
}

export async function installGithubUpdateVersion(versionTag) {
    const release = await getLatestRelease();
    if (release.version !== versionTag || !release.available) throw new Error("A versão mudou ou já está instalada. Consulte as atualizações novamente.");

    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "paracolor-update-"));
    const archivePath = path.join(tempRoot, "paracolor-output.tar.gz");
    const stagePath = path.join(stateRoot, `stage-${release.version}-${Date.now()}`);
    try {
      await mkdir(stateRoot, { recursive: true });
      const [archiveResponse, checksumResponse] = await Promise.all([
        fetch(release.archive_url, { signal: AbortSignal.timeout(120000), headers: { "user-agent": "Paracolor-Updater" } }),
        fetch(release.checksum_url, { signal: AbortSignal.timeout(30000), headers: { "user-agent": "Paracolor-Updater" } }),
      ]);
      if (!archiveResponse.ok || !checksumResponse.ok) throw new Error("Não foi possível baixar os arquivos da Release.");
      const declaredSize = Number(archiveResponse.headers.get("content-length") || 0);
      if (declaredSize > maxArchiveBytes) throw new Error("O pacote de atualização excede o limite de segurança de 250 MB.");
      const archive = Buffer.from(await archiveResponse.arrayBuffer());
      if (archive.length > maxArchiveBytes) throw new Error("O pacote de atualização excede o limite de segurança de 250 MB.");
      const expected = (await checksumResponse.text()).trim().split(/\s+/)[0].toLowerCase();
      const actual = createHash("sha256").update(archive).digest("hex");
      if (!/^[a-f\d]{64}$/.test(expected) || actual !== expected) throw new Error("O checksum SHA-256 do pacote não confere; a instalação foi cancelada.");
      await writeFile(archivePath, archive, { mode: 0o600 });
      await mkdir(stagePath, { recursive: true });
      const entries = await new Promise((resolve, reject) => {
        const child = spawn("tar", ["-tzf", archivePath], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
        let listing = "";
        child.stdout.on("data", (chunk) => {
          listing += chunk.toString("utf8");
          if (listing.length > 4_000_000) { child.kill(); reject(new Error("O pacote contém itens demais.")); }
        });
        child.once("error", reject);
        child.once("exit", (code) => {
          if (code !== 0) return reject(new Error("Não foi possível ler o conteúdo do pacote."));
          const paths = listing.split(/\r?\n/).filter(Boolean);
          const invalid = paths.find((entry) => entry.startsWith("/") || entry.split(/[\\/]/).includes("..") || !(entry === ".output" || entry.startsWith(".output/")));
          if (invalid) return reject(new Error("O pacote contém caminhos inesperados e a instalação foi cancelada."));
          resolve(paths);
        });
      });
      if (!entries.length) throw new Error("O pacote de atualização está vazio.");
      const extracted = await new Promise((resolve, reject) => {
        const child = spawn("tar", ["-xzf", archivePath, "-C", stagePath], { stdio: "ignore", windowsHide: true });
        child.once("error", reject);
        child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Não foi possível extrair o build da Release.")));
      });
      void extracted;
      const nextOutput = path.join(stagePath, ".output");
      await readFile(path.join(nextOutput, "server", "index.mjs"));
      const projectDir = process.cwd();
      const outputDir = await realpath(path.join(projectDir, ".output"));
      const backupDir = path.join(stateRoot, `output-${(await currentVersion()) || "previous"}-${Date.now()}`);
      await mkdir(stateRoot, { recursive: true });

      if (process.platform === "win32") {
        const pendingDir = path.join(projectDir, ".output-update-pending");
        await rm(pendingDir, { recursive: true, force: true });
        await rename(nextOutput, pendingDir);
        await writeFile(path.join(stateRoot, "pending-version"), release.version, "utf8");
        const helper = path.join(projectDir, "scripts", "restart-windows-update.ps1");
        const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper, "-ProjectDir", projectDir, "-ParentPid", String(process.pid), "-BackupDir", backupDir], { detached: true, stdio: "ignore", windowsHide: true });
        child.unref();
        setTimeout(() => process.exit(0), 700);
        return { ok: true, restarting: true, version: release.version };
      }

      await rename(outputDir, backupDir);
      try {
        await rename(nextOutput, outputDir);
      } catch (error) {
        await rename(backupDir, outputDir).catch(() => {});
        throw error;
      }
      await writeFile(path.join(stateRoot, "current-version"), release.version, "utf8");
      setTimeout(() => process.exit(0), 700);
      return { ok: true, restarting: true, version: release.version };
    } finally {
      await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
      await rm(stagePath, { recursive: true, force: true }).catch(() => {});
    }
}
