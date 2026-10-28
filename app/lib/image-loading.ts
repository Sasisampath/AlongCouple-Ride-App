import manifest from "./image-assets.json";

type AssetPath = keyof typeof manifest;
const paths = Object.keys(manifest) as AssetPath[];
export const imageGroups = {
  onboarding: paths.filter(path => path.startsWith("/onboarding/")),
  setup: paths.filter(path => path.startsWith("/setup/")),
  main: ["/brand/along-map-icon.webp", "/setup/invite.webp", "/setup/sign-in.webp", "/setup/avatar-7.webp", ...paths.filter(path => path.startsWith("/profile/"))],
  profile: paths.filter(path => path.startsWith("/profile/")),
  requests: paths.filter(path => path.startsWith("/requests/")),
  together: paths.filter(path => path.startsWith("/together/")),
} as const;

// Migrate saved avatar paths without changing anyone's selected avatar. Only
// known bundled assets are rewritten; user photos and external pair data stay intact.
export function optimizedImage(src: string): string {
  const next = src.replace(/\.png$/, ".webp");
  return Object.hasOwn(manifest, next) ? next : src;
}

const decoded = new Map<string, { image: HTMLImageElement; ready: Promise<void> }>();
export function preloadImages(sources: readonly string[]): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  return Promise.all(sources.filter(src => Object.hasOwn(manifest, src)).map(src => {
    const existing = decoded.get(src);
    if (existing) return existing.ready;
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    const ready = new Promise<void>(resolve => {
      image.onload = () => { void image.decode().catch(() => {}).then(resolve); };
      image.onerror = () => { decoded.delete(src); resolve(); };
      image.src = src;
    });
    // Retain the decoded small image so the next screen can reuse its bitmap.
    decoded.set(src, { image, ready });
    return ready;
  })).then(() => {});
}
