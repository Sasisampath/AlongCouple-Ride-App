# Along first-time intro

This change is limited to the branded splash, four-page story, and entry into
the existing setup. Ride, Requests, Us, Profile, map/GPS, pairing, native
packaging, and the `/demo` route are not redesigned.

## Local preview

```sh
npm install
npm run dev
```

Open `http://localhost:3000/?intro=preview` at **390 × 844**. Append
`&slide=2`, `&slide=3`, or `&slide=4` to inspect a specific page.
This override is development-only and does not change intro storage. Normal
entry is `/`; users with completed setup or an existing saved journey bypass
the new story.

The preview's Get started button enters the existing app/setup. Consequently,
an existing saved profile still opens its existing app; it is never erased by
previewing the intro.

## Entry and persistence

- The splash lasts 2400 ms on cold entry, for both new and returning users.
  Reduced motion uses a 1050 ms fade-only sequence, without pen tracing or scale.
- Swipes, page dots, and CTAs navigate the four pages. Skip leads to page four.
- `along.intro.page.v1` restores an unfinished story after refresh.
- Get started records `along.intro.v1=complete`, removes the page marker, and
  opens the existing name setup (or restores existing app state).
- The intro does **not** set the existing account/setup completion flag.
- Back from name setup returns to the final new intro, not the old welcome.
- `along.onboarding.v1=complete` and saved rider/driver state are recognized
  for backwards-compatible returning-user entry.
- `/demo` continues to render the named `AlongApp` directly, without this gate.

## Sign-in placeholder — intentional

Per the user's instruction, Sign in opens a clearly labeled "coming soon"
dialog. It collects no email/password, makes no auth requests, and creates no
fake authenticated session. Get started in that dialog opens the same existing
setup. Replace this dialog with the real sign-in entry when auth is ready.

This checkout currently has a hosted ChatGPT auth helper, not a Supabase
sign-in implementation. The helper and existing data layer are unchanged.

## Locked assets and fonts

The supplied PNGs are copied byte-for-byte and referenced centrally in
`app/lib/intro.ts`:

| Supplied image | App asset |
| --- | --- |
| Minimal Navy “a.” App Icon.png | `public/brand/along-app-icon.png` |
| Playful Along Wordmark with Coral Dot.png | `public/brand/along-wordmark.png` |
| White “along” Wordmark with Coral Dot.png | `public/brand/along-logo-white.png` |
| ChatGPT Image Oct 23, 2026, 08_11_47 AM-1.png | `public/onboarding/onboarding-01-five-minutes.png` |
| ChatGPT Image Oct 23, 2026, 08_11_49 AM-2.png | `public/onboarding/onboarding-02-live-journey.png` |
| ChatGPT Image Oct 23, 2026, 08_11_51 AM-3.png | `public/onboarding/onboarding-03-little-requests.png` |
| ChatGPT Image Oct 23, 2026, 08_11_53 AM-4.png | `public/onboarding/onboarding-04-together.png` |

The four illustrations retain transparency and use `object-fit: contain`.
No people or objects are cropped, split, redrawn, or regenerated. Dark intro
surfaces use the exact supplied transparent white wordmark with no background,
border, shadow, clipping, or filter. Its aspect ratio is preserved with
`height: auto` and `object-fit: contain`. The original dark wordmark is retained
as the light-surface variant. The animated splash uses the same exact white
PNG for the finished frame. Five animation-only SVG pen paths, aligned to its
1448×1086 canvas, draw `a → l → o → n → g`; these are not a replacement logo.

## Animated splash

The user approved the new animated splash after clarifying the two briefs.
No reference video was attached; the supplied storyboard defines the sequence:

- 0–250 ms: Midnight and very faint route geometry.
- 250–1350 ms: rounded 1.7px SVG strokes, via dash offset, letter by letter.
- 1350–1580 ms: pen strokes crossfade into the original PNG lettering.
- 1550–1750 ms: the PNG's own coral dot appears with a single subtle settle.
- 1780–1960 ms: the small Inter `go together.` line appears.
- 2200–2400 ms: the splash fades/scales out over the entering destination.

The dot is isolated by a static circular SVG mask/clip during animation. Both
layers reference the same intact PNG at identical coordinates; it is never
cropped into separate files, recolored, regenerated, or rectangle-wiped.
The final composite preserves the approved source. The splash has no remote
assets, video, spinner, animation library, or frame-by-frame React updates.

The destination stays mounted during the crossfade, avoiding a second entry
animation. Returning users follow the existing saved setup/journey state;
real signed-in/signed-out routing is still pending the real auth implementation.
The dummy sign-in remains as requested.

Development-only review URLs (ignored in production builds):

- `/?intro=preview&splash=loop`: full animation, two seconds of onboarding,
  then replay. Intended for mobile visual review only; storage is untouched.
- `/?intro=preview&splash=hold&at=1350`: pause at the end of the pen trace.
- `/?intro=preview&splash=hold&at=2000`: final exact-logo frame.
- Add `&motion=reduce` to inspect the reduced-motion path without changing OS
  preferences. Production follows `prefers-reduced-motion`.

Android launch theme, WebView background, and the pre-React HTML background now
use `#07111F`. A transparent native launch drawable avoids the default icon
before the React reveal. Android's system launch window is theme-controlled;
see [Android's splash documentation](https://developer.android.com/develop/ui/views/launch/splash-screen)
and [Capacitor's splash guidance](https://capacitorjs.com/docs/apis/splash-screen).
Existing permissions, launcher icons, auth, map and journey code are untouched.

Bricolage Grotesque and Inter are locally bundled from the corresponding
`@fontsource-variable` packages, including their OFL licenses. No external font
request is needed in the production/native bundle. Typography and color tokens
are scoped to `.intro-*` so the main product styling stays unchanged.

## Verification

```sh
npm test
npx eslint app/components/intro-experience.tsx app/lib/intro.ts tests/intro.test.mjs
```

`npm test` builds both the web app and the static Capacitor bundle, then runs
the existing product checks plus intro storage/compatibility tests.

Browser checks on 2026-10-23:

- All four pages at 360×800, 375×812, 390×844, 393×852, and 430×932: no
  horizontal/vertical overflow, supplied artwork loaded with contain sizing,
  CTA and footer fully visible.
- CTA sequence, both swipe directions, dots, Skip, dummy sign-in, and setup
  entry exercised.
- Production static bundle: page-two refresh recovery; Get started completion;
  reload skips the story and returns to existing name setup; Back returns to
  the final story. No console errors in these checks.
- Safe-area padding uses the device's `env(safe-area-inset-*)` values. Physical
  device cutouts and system gesture areas were not separately device-tested.

Local screenshots are in the git-ignored `outputs/onboarding/` folder.
The later splash update was synced to Android and `assembleDebug` passed.
Physical-device cold-start appearance and 60fps performance still need device
verification. No deployment or publishing is needed to use the local preview.
