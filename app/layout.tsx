import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DualBladeX",
  description: "DualBladeX — Valorant streamer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/*
          Chakra Petch + Rajdhani, the project's established brand fonts
          (used identically across every widget in this whole project) -
          loaded via a plain <link> tag rather than next/font/google, which
          tries to fetch and self-host fonts at BUILD TIME. That approach
          requires build-time network access to fonts.googleapis.com, which
          isn't guaranteed everywhere (confirmed failing in this sandboxed
          environment) - a plain link tag defers font loading to the
          browser at runtime instead, matching how every other widget in
          this project already loads these same two fonts.
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Rajdhani:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#0F1923]">{children}</body>
    </html>
  );
}
