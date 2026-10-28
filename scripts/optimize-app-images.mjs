// One-time migration: node scripts/optimize-app-images.mjs [--remove-originals]
// Uses the Sharp tooling already present in this checkout; no runtime dependency.
import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = `${root}public/`;
const groups = ["brand", "onboarding", "setup", "requests", "together", "profile"];
const unused = new Set([
  "onboarding/onboarding-01-five-minutes.png", "onboarding/onboarding-02-live-journey.png",
  "onboarding/onboarding-03-little-requests.png", "onboarding/onboarding-04-together.png",
]);
const sourceFiles = (await readdir(publicDir, { recursive: true })).filter(path => path.endsWith(".png"));
const retained = sourceFiles.filter(path => !groups.some(group => path.startsWith(`${group}/`)));
const manifestPath = `${root}app/lib/image-assets.json`;
let manifest = {};
try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); } catch { /* First conversion. */ }
const maximum = path => path.startsWith("onboarding/") || path === "setup/role-hero.png" ? 768
  : path.includes("app-icon") || path.includes("map-icon") ? 256
  : path === "brand/along-logo-white.png" ? 768 : 512;

for (const path of sourceFiles.filter(path => groups.some(group => path.startsWith(`${group}/`)) && !unused.has(path)).sort()) {
  const original = `${publicDir}${path}`;
  const target = path.replace(/\.png$/, ".webp");
  const metadata = await sharp(original).metadata();
  const sourceSize = (await stat(original)).size;
  await sharp(original).resize({ width: maximum(path), height: maximum(path), fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84, alphaQuality: 100, effort: 6, smartSubsample: true }).toFile(`${publicDir}${target}`);
  const optimized = await sharp(`${publicDir}${target}`).metadata();
  if (metadata.hasAlpha && !optimized.hasAlpha) throw new Error(`Alpha lost: ${path}`);
  if (optimized.width > metadata.width || optimized.height > metadata.height) throw new Error(`Upscaled: ${path}`);
  manifest[`/${target}`] = { width: optimized.width, height: optimized.height, bytes: (await stat(`${publicDir}${target}`)).size, originalBytes: sourceSize, alpha: metadata.hasAlpha, originalSha256: createHash("sha256").update(await readFile(original)).digest("hex") };
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(`${publicDir}image-precache.json`, `${JSON.stringify(Object.keys(manifest))}\n`);

if (process.argv.includes("--remove-originals")) {
  for (const path of sourceFiles.filter(path => groups.some(group => path.startsWith(`${group}/`)))) {
    if (!unused.has(path) && !manifest[`/${path.replace(/\.png$/, ".webp")}`]) throw new Error(`Missing output: ${path}`);
    await unlink(`${publicDir}${path}`);
  }
}
const optimizedBytes = Object.values(manifest).reduce((sum, item) => sum + item.bytes, 0);
const retainedBytes = (await Promise.all(retained.map(path => stat(`${publicDir}${path}`)))).reduce((sum, item) => sum + item.size, 0);
console.log(JSON.stringify({ optimized: Object.keys(manifest).length, convertedOriginalBytes: Object.values(manifest).reduce((sum, item) => sum + item.originalBytes, 0), optimizedBytes, retainedPngBytes: retainedBytes, newTotalBytes: optimizedBytes + retainedBytes }, null, 2));
