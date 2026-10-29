import { CtaBand } from "@/components/landing/CtaBand";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Navbar } from "@/components/landing/Navbar";
import { Showcase } from "@/components/landing/Showcase";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0b0b10] text-white">
      <Navbar />
      <Hero />
      <Features />
      <Showcase />
      <HowItWorks />
      <CtaBand />
      <Footer />
    </main>
  );
}
