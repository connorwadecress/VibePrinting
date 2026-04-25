import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectDir = path.resolve(import.meta.dirname, "..");

async function runGenerate(args: string[], env: NodeJS.ProcessEnv) {
  return execFileAsync(
    process.execPath,
    ["--import", "tsx", "src/generate.ts", ...args],
    {
      cwd: projectDir,
      env: {
        ...process.env,
        ...env,
      },
    },
  );
}

test("resume with storyboard approved uses mock stock-footage fallback and reaches a later stage without Pexels", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-printing-mock-stock-"));

  await runGenerate(["--brand=signal-drop"], {
    OUTPUT_DIR: tmp,
    TEMP_DIR: path.join(tmp, ".tmp"),
    LLM_PROVIDER: "mock",
  });

  const entries = fs.readdirSync(tmp).filter((name) => name.startsWith("run-"));
  assert.equal(entries.length, 1);
  const runDir = path.join(tmp, entries[0]!);

  for (const gate of ["script-gate", "storyboard-gate"]) {
    const gatePath = path.join(runDir, "approvals", `${gate}.json`);
    const record = JSON.parse(fs.readFileSync(gatePath, "utf8"));
    record.status = "approved";
    record.reviewer = "test";
    record.notes = "advance mock e2e";
    fs.writeFileSync(gatePath, JSON.stringify(record, null, 2));

    await runGenerate(["--brand=signal-drop", `--resume=${runDir}`], {
      OUTPUT_DIR: tmp,
      TEMP_DIR: path.join(tmp, ".tmp"),
      LLM_PROVIDER: "mock",
    });
  }

  const { stdout } = await runGenerate(["--brand=signal-drop", `--resume=${runDir}`], {
    OUTPUT_DIR: tmp,
    TEMP_DIR: path.join(tmp, ".tmp"),
    LLM_PROVIDER: "mock",
  });

  const clipsPath = path.join(runDir, "clips.json");
  assert.equal(fs.existsSync(clipsPath), true);
  const clips = JSON.parse(fs.readFileSync(clipsPath, "utf8"));
  assert.ok(Array.isArray(clips));
  assert.ok(clips.length > 0);
  assert.ok(clips.every((clip: { localPath?: string }) => clip.localPath && fs.existsSync(clip.localPath)));
  assert.doesNotMatch(stdout, /Pexel/i);
  assert.match(stdout, /stock-footage/i);
});
