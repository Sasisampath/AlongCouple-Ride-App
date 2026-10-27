import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRuntime } from "./components/pwa-runtime";
import "./globals.css";
import "./design-system.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Along — just us, wherever we go",
  description: "A private ride and location companion for two.",
  applicationName: "Along",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Along",
  },
  formatDetection: { telephone: true },
  openGraph: {
    title: "Along — just us, wherever we go",
    description: "A private ride and location companion for two.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Along private ride companion" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Along — just us, wherever we go",
    description: "A private ride and location companion for two.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.svg",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><link rel="preload" as="image" type="image/webp" href="/brand/along-logo-white.webp" /></head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRuntime />
        {children}
      </body>
    </html>
  );
}
