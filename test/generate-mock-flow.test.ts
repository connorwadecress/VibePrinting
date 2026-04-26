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

test("generate with mock provider halts at script approval and writes review artifacts", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-printing-mock-"));

  const { stdout } = await runGenerate(["--brand=signal-drop"], {
    OUTPUT_DIR: tmp,
    TEMP_DIR: path.join(tmp, ".tmp"),
    LLM_PROVIDER: "mock",
  });

  const entries = fs.readdirSync(tmp).filter((name) => name.startsWith("run-"));
  assert.equal(entries.length, 1);

  const runDir = path.join(tmp, entries[0]!);
  const approvalPath = path.join(runDir, "approvals", "script-gate.json");
  const holdPath = path.join(runDir, "HOLD.md");
  const scriptPath = path.join(runDir, "script.json");

  assert.equal(fs.existsSync(scriptPath), true);
  assert.equal(fs.existsSync(approvalPath), true);
  assert.equal(fs.existsSync(holdPath), true);
  assert.match(stdout, /Pipeline halted for review/i);
  assert.match(stdout, /script-gate\.json/i);

  const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
  assert.equal(approval.status, "pending");
  assert.equal(approval.artifactPath, "script.json");
});

test("resume with script approved reaches storyboard gate and writes storyboard artifacts", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-printing-mock-resume-"));

  await runGenerate(["--brand=signal-drop"], {
    OUTPUT_DIR: tmp,
    TEMP_DIR: path.join(tmp, ".tmp"),
    LLM_PROVIDER: "mock",
  });

  const entries = fs.readdirSync(tmp).filter((name) => name.startsWith("run-"));
  assert.equal(entries.length, 1);
  const runDir = path.join(tmp, entries[0]!);

  const scriptApprovalPath = path.join(runDir, "approvals", "script-gate.json");
  const scriptApproval = JSON.parse(fs.readFileSync(scriptApprovalPath, "utf8"));
  scriptApproval.status = "approved";
  scriptApproval.reviewer = "test";
  scriptApproval.notes = "ship the storyboard draft";
  fs.writeFileSync(scriptApprovalPath, JSON.stringify(scriptApproval, null, 2));

  const { stdout } = await runGenerate(["--brand=signal-drop", `--resume=${runDir}`], {
    OUTPUT_DIR: tmp,
    TEMP_DIR: path.join(tmp, ".tmp"),
    LLM_PROVIDER: "mock",
  });

  const storyboardPath = path.join(runDir, "storyboard.json");
  const storyboardDeckPath = path.join(runDir, "storyboard-deck.html");
  const storyboardApprovalPath = path.join(runDir, "approvals", "storyboard-gate.json");
  const framesDir = path.join(runDir, "storyboard-frames");
  const manifestPath = path.join(runDir, "assets", "asset-manifest.json");

  assert.equal(fs.existsSync(storyboardPath), true);
  assert.equal(fs.existsSync(storyboardDeckPath), true);
  assert.equal(fs.existsSync(storyboardApprovalPath), true);
  assert.equal(fs.existsSync(manifestPath), true);
  assert.equal(fs.existsSync(framesDir), true);
  // Frames may be .svg (wireframe fallback when no PEXELS_API_KEY) or .jpg
  // (real Pexels preview when a key is configured). Assert that we got at
  // least one frame in either format.
  const frameFiles = fs.readdirSync(framesDir);
  assert.ok(frameFiles.some((name) => /\.(svg|jpe?g|png)$/i.test(name)));
  assert.match(stdout, /Pipeline halted for review/i);
  assert.match(stdout, /storyboard-gate\.json/i);

  const storyboard = JSON.parse(fs.readFileSync(storyboardPath, "utf8"));
  assert.ok(Array.isArray(storyboard.scenes));
  assert.ok(storyboard.scenes.length > 0);
});
