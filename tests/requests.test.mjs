import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../app/lib/requests.ts", import.meta.url), "utf8");
const model = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const sent = { id: "a", category: "coffee", note: "Cold coffee please", direction: "outgoing", status: "sending", createdAt: 1000, updatedAt: 1000 };

test("Tour delivery progresses only outgoing requests, preserving cancelled and incoming requests", () => {
  const cancelled = { ...sent, id: "b", status: "cancelled" };
  const incoming = { ...sent, id: "c", direction: "incoming", status: "sent" };
  const first = model.advanceTourRequests([sent, cancelled, incoming], 1700);
  assert.equal(first[0].status, "sent");
  const next = model.advanceTourRequests(first, 4000);
  assert.equal(next[0].status, "acknowledged");
  assert.equal(next[1].status, "cancelled");
  assert.equal(next[2].status, "sent");
  assert.strictEqual(model.advanceTourRequests(next, 5000), next);
});

test("request validation discards corrupt history and accepts all neutral care choices", () => {
  assert.equal(model.isAlongRequest(sent), true);
  for (const value of [null, {}, { ...sent, category: "medicine" }, { ...sent, status: "rejected" }, { ...sent, createdAt: NaN }, { ...sent, note: "x".repeat(281) }]) assert.equal(model.isAlongRequest(value), false);
  for (const care of model.careOptions) assert.equal(model.isAlongRequest({ ...sent, category: "care", care }), true);
  assert.equal(model.isActiveRequest({ ...sent, status: "completed" }), false);
});

test("Tour recovery reads only its requested namespace and tolerates corrupt or disabled storage", () => {
  const accessed = [];
  globalThis.localStorage = { getItem(key) { accessed.push(key); return JSON.stringify([sent, { category: "bad" }]); } };
  assert.deepEqual(model.readTourRequests("along.requests.tour.v1"), [sent]);
  assert.deepEqual(accessed, ["along.requests.tour.v1"]);
  globalThis.localStorage = { getItem() { throw new Error("Unavailable"); } };
  assert.deepEqual(model.readTourRequests("along.requests.tour.v1"), []);
  delete globalThis.localStorage;
});
