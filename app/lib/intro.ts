export const INTRO_COMPLETE_KEY = "along.intro.v1";
export const INTRO_PAGE_KEY = "along.intro.page.v1";

export const introAssets = {
  icon: "/brand/along-app-icon.webp",
  wordmark: "/brand/along-wordmark.webp",
  wordmarkWhite: "/brand/along-logo-white.webp",
  waiting: "/onboarding/onboarding-01-stay-close.webp",
  journey: "/onboarding/onboarding-02-see-distance.webp",
  requests: "/onboarding/onboarding-03-little-joys.webp",
  together: "/onboarding/onboarding-04-keep-moment.png",
} as const;

type IntroStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readIntroState(storage: IntroStorage) {
  try {
    // The story is new. People who already finished the original setup or have
    // an active ride must go straight back to their existing app state.
    const complete = storage.getItem(INTRO_COMPLETE_KEY) === "complete"
      || storage.getItem("along.onboarding.v1") === "complete";
    let hasRide = false;
    try {
      const ride = JSON.parse(storage.getItem("along.private-ride.v1") || "null");
      hasRide = ride?.role === "rider" || ride?.role === "driver";
    } catch { /* Corrupt ride storage is handled by the existing app. */ }
    const page = Number(storage.getItem(INTRO_PAGE_KEY) || 0);
    return { complete: complete || hasRide, page: Number.isInteger(page) ? Math.max(0, Math.min(3, page)) : 0 };
  } catch {
    return { complete: false, page: 0 };
  }
}

export function saveIntroPage(storage: IntroStorage, page: number) {
  try { storage.setItem(INTRO_PAGE_KEY, String(page)); } catch { /* In-memory navigation still works. */ }
}

export function completeIntro(storage: IntroStorage) {
  try {
    storage.setItem(INTRO_COMPLETE_KEY, "complete");
    storage.removeItem(INTRO_PAGE_KEY);
  } catch { /* Private browsing must not prevent entering the app. */ }
}
