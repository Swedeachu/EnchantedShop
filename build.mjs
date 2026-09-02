import * as esbuild from "esbuild";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const isWatch = process.argv.includes("--watch");
const isProd = process.argv.includes("--production");

const PACK_DIR = path.resolve("packs/EnchantedShop_BP");
const OUT_FILE = path.join(PACK_DIR, "scripts/main.js");

/** @type {import("esbuild").BuildOptions} */
const buildOptions = {
  entryPoints: ["src/main.ts"],
  outfile: OUT_FILE,
  bundle: true,
  format: "esm",
  target: "es2020",
  platform: "neutral",
  sourcemap: isProd ? false : "inline",
  minify: isProd,
  legalComments: "none",
  // These modules are provided by the Minecraft runtime at load time and
  // must never be bundled into the output - only imported by specifier.
  external: [
    "@minecraft/server",
    "@minecraft/server-ui"
  ],
  logLevel: "info"
};

const outDir = path.dirname(OUT_FILE);
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("[build] watching for changes... (Ctrl+C to stop)");
} else {
  const result = await esbuild.build(buildOptions);
  if (result.errors.length === 0) {
    console.log(`[build] wrote ${OUT_FILE}`);
  }
}
