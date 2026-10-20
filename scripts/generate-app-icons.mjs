import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const icons = `${root}/public/icons`;
const source = `${icons}/app-icon.svg`;
const foregroundSource = `${icons}/app-icon-foreground.svg`;
const androidRes = `${root}/android/app/src/main/res`;

const densities = {
  mdpi: { launcher: 48, foreground: 108 },
  hdpi: { launcher: 72, foreground: 162 },
  xhdpi: { launcher: 96, foreground: 216 },
  xxhdpi: { launcher: 144, foreground: 324 },
  xxxhdpi: { launcher: 192, foreground: 432 },
};

await mkdir(icons, { recursive: true });
await Promise.all([
  sharp(source).resize(192, 192).png().toFile(`${icons}/icon-192.png`),
  sharp(source).resize(512, 512).png().toFile(`${icons}/icon-512.png`),
  sharp(source).resize(512, 512).png().toFile(`${icons}/maskable-512.png`),
  sharp(source).resize(180, 180).png().toFile(`${icons}/apple-touch-icon.png`),
]);

await Promise.all(
  Object.entries(densities).flatMap(([density, sizes]) => {
    const target = `${androidRes}/mipmap-${density}`;
    return [
      sharp(source).resize(sizes.launcher, sizes.launcher).png().toFile(`${target}/ic_launcher.png`),
      sharp(source).resize(sizes.launcher, sizes.launcher).png().toFile(`${target}/ic_launcher_round.png`),
      sharp(foregroundSource)
        .resize(sizes.foreground, sizes.foreground)
        .png()
        .toFile(`${target}/ic_launcher_foreground.png`),
    ];
  }),
);
