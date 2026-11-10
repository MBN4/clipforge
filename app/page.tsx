import { Nav } from "@/components/Nav";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { ForgeSequence } from "@/components/landing/ForgeSequence";
import { CaptionShowcase } from "@/components/landing/CaptionShowcase";
import { Stats } from "@/components/landing/Stats";
import { Features } from "@/components/landing/Features";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <Marquee />
        <ForgeSequence />
        <CaptionShowcase />
        <Stats />
        <Features />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
