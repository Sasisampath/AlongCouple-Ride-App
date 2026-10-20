# Along Couple Ride App

Along is a private mobile-first ride companion for Monu and Sasi. It combines a rider request flow, driver controls, pit stops, live location, and a real interactive mobility map.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` on a phone-sized viewport. Location access is requested only after tapping **Allow location** and requires HTTPS outside localhost.

## Mapping

- MapLibre GL JS renders the interactive map.
- OpenFreeMap Positron provides the no-key development style and OpenStreetMap-derived geography.
- OSRM provides road route geometry for the mocked ride layer.
- Set `VITE_MAP_STYLE_URL` to any MapLibre-compatible style JSON URL to swap the map provider styling without changing ride UI code.

The mapping boundary lives in `app/lib/map-adapter.ts`; browser location and speed handling live in `app/lib/use-live-location.ts` and `app/lib/geolocation.ts`.

## Validate

```bash
npm run lint
npm test
```

## PWA and Android

`npm run build` preserves the normal Vinext web build and also creates the static Capacitor bundle in `dist/capacitor`. To refresh the native project:

```bash
npm run build
npx cap sync android
npx cap open android
```

See [docs/android.md](docs/android.md) for Android Studio, physical-device, PWA installation, permissions, and debug APK instructions.

## Deploy to Vercel

Connect this repository to Vercel with the repository root (`./`) as the Root Directory. The checked-in `vercel.json` selects Nitro, runs `npm ci` and `npm run build:vercel`, and uses `.vercel/output`.

The app uses Vinext, not the Next.js build tool. `vite.vercel.config.ts` adds the [officially supported Nitro adapter](https://github.com/cloudflare/vinext#other-platforms-via-nitro) to generate Vercel's server function, routing configuration, and static assets. Do not deploy `dist/client` alone or select the Next.js preset: the home page requires the generated server route.

```bash
npm run build:vercel
npm run test:vercel
```

Push to the connected production branch (`main`) to trigger deployment. If an older deployment shows `404: NOT_FOUND`, check that the latest commit was deployed and clear conflicting dashboard build/output overrides before redeploying. Vercel should use the settings in `vercel.json`.

`VITE_MAP_STYLE_URL` is optional; without it, the map uses OpenFreeMap. This is a browser-visible build variable, so do not put secrets in it. Set any provider-specific public style URL in Vercel's Environment Variables before building.

The original `npm run dev` and `vite.config.ts` remain available for local development and Sites/Cloudflare hosting. The web half of the combined production build is also available directly as `npm run build:web`.

The app is a PWA. Mobile browsers can suspend web location updates when backgrounded or locked, and Along surfaces that limitation instead of simulating movement.
