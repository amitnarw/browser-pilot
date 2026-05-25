import { build } from "esbuild";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const DIST_DIR = "dist";

function getEntryPoints(dir) {
  const entries = [];
  for (const item of readdirSync(dir)) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      entries.push(...getEntryPoints(fullPath));
    } else if (item.endsWith(".js") && !item.endsWith(".min.js") && !item.endsWith(".map")) {
      entries.push(fullPath);
    }
  }
  return entries;
}

async function bundle() {
  const entryPoints = getEntryPoints(DIST_DIR);
  console.log(`Bundling ${entryPoints.length} files...`);

  for (const entry of entryPoints) {
    const outFile = entry.replace(/\.js$/, ".min.js");
    const relPath = relative(process.cwd(), entry);
    console.log(`  ${relPath} -> ${relative(process.cwd(), outFile)}`);

    await build({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      treeShaking: true,
      platform: "node",
      target: "node18",
      format: "esm",
      outfile: outFile,
      sourcemap: false,
      legalComments: "none",
      // Don't bundle node_modules — keep them external
      external: [
        "@modelcontextprotocol/sdk",
        "chrome-devtools-mcp",
        "express",
        "ws",
        "zod",
        "cors",
        "eventsource-parser",
      ],
    });
  }

  console.log("Done.");
}

bundle().catch((err) => {
  console.error("Bundle failed:", err);
  process.exit(1);
});
