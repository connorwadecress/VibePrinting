import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { workflowAssets } from "./n8n/workflows.js";

async function main(): Promise<void> {
  const outputDirectory = path.resolve(process.cwd(), "docs", "workflows");
  await mkdir(outputDirectory, { recursive: true });

  await Promise.all(
    workflowAssets.map(async (asset) => {
      const outputPath = path.join(outputDirectory, asset.fileName);
      await writeFile(outputPath, `${JSON.stringify(asset.workflow, null, 2)}\n`, "utf8");
    })
  );

  console.log(
    JSON.stringify(
      {
        exported: workflowAssets.map((asset) => asset.fileName),
        outputDirectory
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
