import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Along ships its product shell and primary ride actions", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Come get me/);
  assert.match(page, /Location shared with her/);
  assert.match(page, /RequestsScreen/);
  assert.match(page, /DriverRidePanel/);
});

test("PWA and map provider configuration are present", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const manifest = await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8");
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.equal(JSON.parse(manifest).display, "standalone");
});
