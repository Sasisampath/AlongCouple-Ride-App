import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f6f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
