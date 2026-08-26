import { Hero } from "@/components/Hero";
import { LiveSection } from "@/components/LiveSection";
import { DonateSection } from "@/components/DonateSection";
import { ClipsSection } from "@/components/ClipsSection";
import { Footer } from "@/components/Footer";

/**
 * Home page - complete. Every section from the spec is now real: Hero
 * (dragon), Live, Donate, Clips, Footer. No placeholders remain.
 */
export default function Home() {
  return (
    <main>
      <Hero />
      <LiveSection />
      <DonateSection />
      <ClipsSection />
      <Footer />
    </main>
  );
}
