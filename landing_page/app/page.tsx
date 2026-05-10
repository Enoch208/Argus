import { Cta } from "@/components/sections/cta";
import { Footer } from "@/components/sections/footer";
import { Hero } from "@/components/sections/hero";
import { Pipeline } from "@/components/sections/pipeline";
import { QvacMatrix } from "@/components/sections/qvac-matrix";
import { Threats } from "@/components/sections/threats";
import { VerdictDemo } from "@/components/sections/verdict-demo";

export default function Home() {
  return (
    <>
      <Hero />
      <VerdictDemo />
      <Pipeline />
      <QvacMatrix />
      <Threats />
      <Cta />
      <Footer />
    </>
  );
}
