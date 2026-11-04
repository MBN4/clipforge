import { Nav } from "@/components/Nav";
import { Hero } from "@/components/landing/Hero";
import { Steps } from "@/components/landing/Steps";
import { Features } from "@/components/landing/Features";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <Steps />
        <Features />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
