import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

// Exercise the production storage functions without a browser or a second
// transpiler. Node >=22.13 is already required by the project.
const source = await readFile(new URL("../app/lib/intro.ts", import.meta.url), "utf8");
const intro = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const splashSource = await readFile(new URL("../app/lib/splash.ts", import.meta.url), "utf8");
const { splashTiming, wordmarkStrokes } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(splashSource)).toString("base64")}`);
const { readIntroState, saveIntroPage, completeIntro, INTRO_COMPLETE_KEY, INTRO_PAGE_KEY } = intro;

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("new users start at the first story and unfinished stories resume", () => {
  const state = storage();
  assert.deepEqual(readIntroState(state), { complete: false, page: 0 });
  saveIntroPage(state, 2);
  assert.deepEqual(readIntroState(state), { complete: false, page: 2 });
});

test("completion persists independently from account and journey setup", () => {
  const state = storage({ [INTRO_PAGE_KEY]: "3" });
  completeIntro(state);
  assert.deepEqual(readIntroState(state), { complete: true, page: 0 });
  assert.equal(state.getItem(INTRO_COMPLETE_KEY), "complete");
  assert.equal(state.getItem(INTRO_PAGE_KEY), null);
  assert.equal(state.getItem("along.onboarding.v1"), null);
  assert.equal(state.getItem("along.private-ride.v1"), null);
});

test("existing users and saved journeys bypass the new story", () => {
  assert.equal(readIntroState(storage({ "along.onboarding.v1": "complete" })).complete, true);
  for (const role of ["rider", "driver"]) {
    assert.equal(readIntroState(storage({ "along.private-ride.v1": JSON.stringify({ role }) })).complete, true);
  }
});

test("invalid or unavailable storage never blocks entry", () => {
  for (const [value, page] of [["-1", 0], ["99", 3], ["NaN", 0], ["1.5", 0]]) {
    assert.deepEqual(readIntroState(storage({ [INTRO_PAGE_KEY]: value, "along.private-ride.v1": "{broken" })), { complete: false, page });
  }
  const blocked = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); }, removeItem() { throw Error("blocked"); } };
  assert.deepEqual(readIntroState(blocked), { complete: false, page: 0 });
  assert.doesNotThrow(() => saveIntroPage(blocked, 1));
  assert.doesNotThrow(() => completeIntro(blocked));
});

test("artwork is directly referenced and demo bypasses the intro wrapper", async () => {
  for (const path of Object.values(intro.introAssets)) {
    const png = await readFile(new URL(`../public${path}`, import.meta.url));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  const demo = await readFile(new URL("../app/demo/page.tsx", import.meta.url), "utf8");
  assert.match(demo, /<AlongApp demoMode/);
  assert.doesNotMatch(demo, /IntroExperience/);
});

test("dark-surface wordmark remains the exact approved transparent PNG", async () => {
  const png = await readFile(new URL(`../public${intro.introAssets.wordmarkWhite}`, import.meta.url));
  assert.equal(createHash("sha256").update(png).digest("hex"), "271534cb71db72b4d80f1adcac158aeffdad3097ee60de2215824b1dbbf01f87");
});

test("the pen sequence draws a → l → o → n → g within the 2.4 second splash", () => {
  assert.deepEqual(wordmarkStrokes.map((stroke) => stroke.letter), ["a", "l", "o", "n", "g"]);
  assert.equal(wordmarkStrokes[0].start, 250);
  assert.equal(Math.max(...wordmarkStrokes.map((stroke) => stroke.start + stroke.duration)), 1350);
  assert.deepEqual(splashTiming(false), { reveal: 2200, complete: 2400 });
  assert.deepEqual(splashTiming(true), { reveal: 900, complete: 1050 });
});

test("native and pre-React launch backgrounds are Midnight, without the default splash icon", async () => {
  const theme = await readFile(new URL("../android/app/src/main/res/values/styles.xml", import.meta.url), "utf8");
  const capacitor = await readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8");
  const html = await readFile(new URL("../capacitor/index.html", import.meta.url), "utf8");
  assert.match(theme, /windowSplashScreenBackground">@color\/along_midnight/);
  assert.match(theme, /windowSplashScreenAnimatedIcon">@drawable\/along_launch_empty/);
  assert.doesNotMatch(theme, /@drawable\/splash/);
  assert.match(capacitor, /backgroundColor: "#07111F"/);
  assert.match(html, /html,body\{margin:0;background:#07111f\}/);
});
