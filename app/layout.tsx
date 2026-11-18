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
          build machine doesn't reliably have. The same faces as the OBS
          widgets: Anton for display, Archivo Black for tags and controls,
          Bebas Neue for numbers and one of the ransom-note papers, Archivo
          for reading, Martian Mono for logs and config.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Archivo:wdth,wght@62..125,400..800&family=Bebas+Neue&family=Martian+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
