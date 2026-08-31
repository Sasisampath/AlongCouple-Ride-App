import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const output = new URL("../.vercel/output/", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, output), "utf8"));

test("Vercel routes the home page to a real server function", async () => {
  const config = await readJson("config.json");
  assert.equal(config.version, 3);
  const filesystemIndex = config.routes.findIndex((route) => route.handle === "filesystem");
  const serverIndex = config.routes.findIndex((route) => route.src === "/(.*)" && route.dest === "/__server");
  assert.ok(filesystemIndex >= 0 && serverIndex > filesystemIndex);
  const server = await readJson("functions/__server.func/.vc-config.json");
  assert.match(server.runtime, /^nodejs(?:22|24)\.x$/);
  await access(new URL(`functions/__server.func/${server.handler}`, output));
});

test("the production server renders Along and references existing assets", async () => {
  const { default: app } = await import(new URL("functions/__server.func/index.mjs", output));
  const response = await app.fetch(new Request("https://along.test/"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /<title>Along/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /app-shell/);
  const assets = [...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"?]+)"/g)].map((match) => match[1]);
  assert.ok(assets.some((path) => path.endsWith(".css")), "The page must load its stylesheet");
  assert.ok(assets.some((path) => path.endsWith(".js")), "The page must load its interactive client");
  for (const path of new Set(assets)) await access(new URL(`static${path}`, output));
});

test("the production server supports React Server Component requests", async () => {
  const { default: app } = await import(new URL("functions/__server.func/index.mjs", output));
  const response = await app.fetch(new Request("https://along.test/?_rsc", { headers: { RSC: "1" } }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/x-component/);
  assert.ok((await response.text()).length > 0);
});

test("Vercel includes the map worker, canonical avatar, and PWA assets", async () => {
  for (const name of ["sasi-profile.png", "manifest.webmanifest", "favicon.svg", "og.png"]) {
    const original = await readFile(new URL(`../public/${name}`, import.meta.url));
    const deployed = await readFile(new URL(`static/${name}`, output));
    assert.deepEqual(deployed, original, `${name} must be copied without changes`);
  }
  const files = await readdir(new URL("static/_next/static/", output));
  assert.ok(files.some((file) => /^maplibre-gl-worker-.*\.js$/.test(file)));
});

test("unknown URLs return an application 404, not a broken server", async () => {
  const { default: app } = await import(new URL("functions/__server.func/index.mjs", output));
  const response = await app.fetch(new Request("https://along.test/does-not-exist"));
  assert.equal(response.status, 404);
  await response.text();
});
