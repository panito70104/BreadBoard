import { PricingGrid } from "@/components/pricing/pricing-grid";
import { Container, Section, SectionHeading } from "@/components/ui/section";
import { getPricingPlans } from "@/lib/api";

/** Server component: reads plans through the same mock API the app uses. */
export async function PricingSection() {
  const plans = await getPricingPlans();

  return (
    <Section id="precios" className="scroll-mt-16 border-y border-slate-200/70 bg-white">
      <Container>
        <SectionHeading
          eyebrow="Precios"
          title="Empieza gratis, sube de plan cuando llegue la época de exámenes"
          description="Sin permanencia. Cancelas cuando quieras y tus videos siguen siendo tuyos."
        />

        <PricingGrid plans={plans} className="mt-14" />

        <p className="mt-10 text-center text-sm text-slate-500">
          Precios en USD. Los pagos se procesarán con Recurrente cuando el checkout esté
          activo.
        </p>
      </Container>
    </Section>
  );
}
