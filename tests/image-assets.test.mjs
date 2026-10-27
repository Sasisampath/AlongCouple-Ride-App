import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import { stripTypeScriptTypes } from "node:module";

const manifest = JSON.parse(await readFile(new URL("../app/lib/image-assets.json", import.meta.url), "utf8"));
test("saved PNG avatar paths migrate without rewriting user photos or missing sources", async () => {
  const source = (await readFile(new URL("../app/lib/image-loading.ts", import.meta.url), "utf8")).replace('import manifest from "./image-assets.json";', `const manifest = ${JSON.stringify(manifest)};`);
  const loader = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
  assert.equal(loader.optimizedImage("/setup/avatar-3.png"), "/setup/avatar-3.webp");
  assert.equal(loader.optimizedImage("/setup/avatar-3.webp"), "/setup/avatar-3.webp");
  assert.equal(loader.optimizedImage("https://example.com/avatar.png"), "https://example.com/avatar.png");
  assert.equal(loader.optimizedImage("blob:memory-photo"), "blob:memory-photo");
  assert.equal(loader.optimizedImage("/sasi-profile.png"), "/sasi-profile.png");
});
test("optimized assets preserve alpha and mobile resolution budgets", async () => {
  for (const [path, entry] of Object.entries(manifest)) {
    const bytes = await readFile(new URL(`../public${path}`, import.meta.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "webp", path);
    assert.equal(metadata.width, entry.width, path);
    assert.equal(metadata.height, entry.height, path);
    assert.equal(metadata.hasAlpha, entry.alpha, path);
    assert.equal(bytes.length, entry.bytes, path);
    assert.ok(bytes.length < entry.originalBytes, path);
    const limit = path.startsWith("/onboarding/") || path === "/setup/role-hero.webp" || path === "/brand/along-logo-white.webp" ? 768
      : path.includes("app-icon") || path.includes("map-icon") ? 256 : 512;
    assert.ok(Math.max(metadata.width, metadata.height) <= limit, path);
    if (entry.alpha) {
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let transparent = false, visible = false;
      for (let index = info.channels - 1; index < data.length; index += info.channels) {
        transparent ||= data[index] === 0;
        visible ||= data[index] > 0;
      }
      assert.ok(transparent && visible, `Alpha is real, not flattened: ${path}`);
    }
  }
});
test("precache includes every optimized UI image and excludes private data", async () => {
  const precache = JSON.parse(await readFile(new URL("../public/image-precache.json", import.meta.url), "utf8"));
  assert.deepEqual(precache, Object.keys(manifest));
  assert.ok(precache.every(path => /^\/(brand|onboarding|setup|requests|together)\/[\w-]+\.webp$/.test(path)));
});
test("PNG illustration duplicates are absent from the deployable public directories", async () => {
  const files = await readdir(new URL("../public", import.meta.url), { recursive: true });
  assert.deepEqual(files.filter(path => /^(brand|onboarding|setup|requests|together)\/.*\.png$/.test(path)), []);
});
