import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../app/lib/together.ts", import.meta.url), "utf8");
const model = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);

test("relationship dates use calendar days, including DST, leap days and same-day starts", () => {
  assert.equal(model.relationshipDays("2026-03-07", "2026-03-09"), 2);
  assert.equal(model.relationshipDays("2024-02-28", "2024-03-01"), 2);
  assert.equal(model.relationshipDays("2026-10-26", "2026-10-26"), 0);
  assert.equal(model.relationshipDays(null, "2026-10-26"), null);
  assert.equal(model.relationshipDays("2026-10-27", "2026-10-26"), null);
  assert.equal(model.relationshipDays("2026-02-30", "2026-10-26"), null);
  assert.equal(model.relationshipDays("not a date", "2026-10-26"), null);
});

test("local stories isolate pairs and never silently report failed persistence", () => {
  const stored = new Map();
  const storage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  const entry = { startDate: "2020-01-01", answers: [{ questionId: "a", question: "A question", text: "A small thing", savedAt: 123 }] };
  model.saveTogetherText(storage, "pair/a", entry);
  assert.deepEqual(model.readTogetherText(storage, "pair/a"), entry);
  assert.deepEqual(model.readTogetherText(storage, "pair/b"), { startDate: null, answers: [] });
  assert.throws(() => model.saveTogetherText({ setItem() { throw new Error("Quota"); } }, "pair/a", entry), /Quota/);
  assert.deepEqual(model.readTogetherText({ getItem: () => "broken" }, "pair/a"), { startDate: null, answers: [] });
});

test("Little moments excludes sent, declined and cancelled requests without modifying its source", () => {
  const requests = [{ id: "a", status: "sent", updatedAt: 5 }, { id: "b", status: "completed", updatedAt: 2 }, { id: "c", status: "completed", updatedAt: 3 }, { id: "d", status: "cancelled", updatedAt: 4 }, { id: "e", status: "unavailable", updatedAt: 6 }];
  assert.deepEqual(model.completedLittleMoments(requests).map(item => item.id), ["c", "b"]);
  assert.equal(requests[0].id, "a");
  assert.deepEqual(model.completedLittleMoments([]), []);
});

test("photo selection rejects oversized, empty and non-photo inputs", () => {
  assert.equal(model.isMemoryPhoto({ type: "image/png", size: 4000 }), true);
  assert.equal(model.isMemoryPhoto({ type: "image/heic", size: 4000 }), true);
  assert.equal(model.isMemoryPhoto({ type: "image/svg+xml", size: 4000 }), false);
  assert.equal(model.isMemoryPhoto({ type: "text/plain", size: 4000 }), false);
  assert.equal(model.isMemoryPhoto({ type: "image/png", size: 0 }), false);
  assert.equal(model.isMemoryPhoto({ type: "image/png", size: 16 * 1024 * 1024 }), false);
});
