import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export, per the spec (Section 2): no live Next.js server, since
  // none of this site's dynamic behavior is server-rendered - it's all
  // client-side fetch() calls to the Python backend. This builds the whole
  // site to plain HTML/CSS/JS files the Mac Mini just serves directly.
  output: "export",
};

export default nextConfig;
