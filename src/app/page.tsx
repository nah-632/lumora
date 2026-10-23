import { ServicesGrid } from "@/components/ServicesGrid";
import { Hero } from "@/components/Hero";
import { TrustStrip } from "@/components/TrustStrip";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <TrustStrip />
      <ServicesGrid />
    </main>
  );
}
