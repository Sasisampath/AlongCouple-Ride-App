import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(root, "android");
const windows = process.platform === "win32";
const executable = windows ? "java.exe" : "java";

const candidates = [
  process.env.JAVA_HOME,
  process.platform === "darwin" ? "/Applications/Android Studio.app/Contents/jbr/Contents/Home" : null,
  process.platform === "darwin" ? "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" : null,
  process.platform === "linux" ? "/opt/android-studio/jbr" : null,
  windows && process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "Programs", "Android Studio", "jbr")
    : null,
].filter(Boolean);

const javaHome = candidates.find((candidate) =>
  existsSync(join(candidate, "bin", executable)),
);

const sdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.platform === "darwin" ? join(homedir(), "Library", "Android", "sdk") : null,
  process.platform === "darwin" ? "/opt/homebrew/share/android-commandlinetools" : null,
  process.platform === "linux" ? join(homedir(), "Android", "Sdk") : null,
  windows && process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "Android", "Sdk")
    : null,
].filter(Boolean);

const androidHome = sdkCandidates.find((candidate) =>
  existsSync(join(candidate, "platforms")),
);

if (!javaHome) {
  console.error("Java was not found. Install Android Studio or set JAVA_HOME, then retry.");
  process.exit(1);
}

if (!androidHome) {
  console.error("The Android SDK was not found. Install it in Android Studio or set ANDROID_HOME, then retry.");
  process.exit(1);
}

const gradle = windows ? "gradlew.bat" : "./gradlew";
const result = spawnSync(gradle, ["assembleDebug"], {
  cwd: android,
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome,
    PATH: `${join(javaHome, "bin")}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
