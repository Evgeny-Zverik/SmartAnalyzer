import { Hero } from "@/components/marketing/Hero";
import { ToolsGrid } from "@/components/marketing/ToolsGrid";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Features } from "@/components/marketing/Features";
import { PricingPreview } from "@/components/marketing/PricingPreview";
import { FinalCTA } from "@/components/marketing/FinalCTA";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Hero />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold text-gray-900">
          Инструменты
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
          Пять инструментов для анализа документов и данных
        </p>
        <div className="mt-12">
          <ToolsGrid buttonText="Открыть" />
        </div>
      </section>
      <HowItWorks />
      <Features />
      <PricingPreview />
      <FinalCTA />
    </main>
  );
}
