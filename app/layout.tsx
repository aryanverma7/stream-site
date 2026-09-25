import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DualBladeX",
  description: "DualBladeX — Valorant streams on Twitch and YouTube. Live now, or catch the tapes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/*
          Loaded via a plain <link> rather than next/font/google, which
          fetches and self-hosts at BUILD TIME and needs network access the
          build machine doesn't reliably have. Big Shoulders Stencil is the
          display voice (hazmat and facility stencils), Archivo the UI face,
          VT323 only for on-screen-display data, Martian Mono for logs and
          config. The OBS widgets still use Chakra Petch/Rajdhani; the site
          no longer does.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Big+Shoulders+Stencil+Display:wght@700;800;900&family=Martian+Mono:wght@400;500&family=VT323&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
