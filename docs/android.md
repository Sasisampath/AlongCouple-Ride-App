# Along on Android

Along keeps the existing Vinext web deployment and produces an additional static bundle for Capacitor in `dist/capacitor`.

## Build and sync

```bash
npm install
npm run build
npx cap sync android
npx cap open android
```

`npm run build` first creates the normal server-backed web build, then creates the self-contained Capacitor bundle. The native project never points at a remote development server.

## Android permissions

The Android manifest includes foreground coarse/fine location, network access, network state, and Android 13+ notification permission. Along does not declare `ACCESS_BACKGROUND_LOCATION`. Notification permission is prepared in the manifest but should only be requested at runtime when a native notification feature is introduced.

## Physical Android phone

1. Install Android Studio and its Android SDK.
2. On the phone, enable Developer options by tapping **Build number** seven times, then enable **USB debugging**.
3. Connect the phone with a data-capable USB cable and accept the RSA debugging prompt.
4. Open `android/` in Android Studio with `npx cap open android`.
5. Select the phone in the device selector and press **Run**.

You can verify the connection from a terminal with `adb devices` if the Android SDK platform tools are on your `PATH`.

## Debug APK

Run:

```bash
npm run android:apk
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## PWA on an Android phone

1. Open the HTTPS Along deployment in Chrome on Android.
2. Open Chrome’s menu and choose **Install app** or **Add to Home screen**.
3. Confirm the installation and launch **Along** from the home screen.

The manifest uses standalone display mode, so the installed PWA opens without normal Chrome navigation controls.
