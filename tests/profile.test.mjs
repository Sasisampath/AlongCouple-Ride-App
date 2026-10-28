import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../app/lib/profile.ts", import.meta.url), "utf8");
const model = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
test("profile edits reuse setup storage and preserve completion and unrelated choices", () => {
  const saved = storage();
  saved.setItem("along.setup.v1", JSON.stringify({ role: "rider", avatar: "/setup/avatar-2.webp", complete: true, extra: "keep" }));
  model.persistProfilePatch(saved, { role: "driver" }, { role: "rider", avatar: "/setup/avatar-2.webp" });
  assert.deepEqual(JSON.parse(saved.getItem("along.setup.v1")), { role: "driver", avatar: "/setup/avatar-2.webp", complete: true, extra: "keep" });
  model.persistProfilePatch(saved, { name: "  My name  " }, { role: "driver", avatar: "/setup/avatar-2.webp" });
  assert.equal(saved.getItem("along.profile.name"), "My name");
  assert.equal(model.roleLabel("driver"), "Rider");
  assert.equal(model.roleLabel("rider"), "Pillion");
});
test("profile values reject unknown roles, remote avatar URLs and overlong names", () => {
  for (const patch of [{ role: "admin" }, { avatar: "https://example.com/avatar.png" }, { name: "x".repeat(41) }]) assert.equal(model.validProfilePatch(patch), false);
  for (const avatar of model.profileAvatars) assert.equal(model.validProfilePatch({ avatar }), true);
  assert.equal(model.validProfilePatch({ name: "" }), true);
});
test("demo edits cannot overwrite production preferences", () => {
  const saved = storage();
  saved.setItem("along.profile.name", "Real name");
  saved.setItem("along.setup.v1", JSON.stringify({ role: "rider", complete: true }));
  model.persistProfilePatch(saved, { name: "Tour", avatar: "/setup/avatar-8.webp", role: "driver" }, { role: "rider", avatar: null }, true);
  assert.equal(saved.getItem("along.profile.name"), "Real name");
  assert.equal(JSON.parse(saved.getItem("along.setup.v1")).role, "rider");
  assert.equal(model.readDemoProfileAvatar(saved), "/setup/avatar-8.webp");
});
test("blocked storage propagates a failure and permission labels never imply access", () => {
  const saved = { getItem: () => null, setItem() { throw new Error("Storage unavailable"); } };
  assert.throws(() => model.persistProfilePatch(saved, { avatar: "/setup/avatar-1.webp" }, { role: "rider", avatar: null }), /Storage unavailable/);
  assert.equal(model.locationPermissionLabel("prompt"), "Not enabled");
  assert.equal(model.notificationPermissionLabel("unsupported"), "Unavailable here");
  assert.equal(model.notificationPermissionLabel("denied"), "Not allowed");
});
