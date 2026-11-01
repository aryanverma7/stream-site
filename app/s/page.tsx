import type { Metadata } from "next";
import { GuestPage } from "@/components/share/GuestPage";

export const metadata: Metadata = { title: "Shared video", robots: { index: false, follow: false } };

/** A share link's guest page: no login; the link's token is in the URL fragment, which no server sees. */
export default function SharePage() {
  return <GuestPage />;
}
