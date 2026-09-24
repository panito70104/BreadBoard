import { howItWorksSteps } from "@/data/landing";
import { Container, Section, SectionHeading } from "@/components/ui/section";

export function HowItWorks() {
  return (
    <Section id="como-funciona" className="scroll-mt-16 border-y border-slate-200/70 bg-white">
      <Container>
        <SectionHeading
          eyebrow="Cómo funciona"
          title="De un PDF denso a una explicación que sí se entiende"
          description="Cuatro pasos. Tú solo haces el primero."
        />

        <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {howItWorksSteps.map(({ step, title, description, Icon }) => (
            <li
              key={step}
              className="group relative rounded-2xl border border-slate-200/80 bg-paper p-6 transition-colors hover:border-brand-200"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="font-hand text-3xl text-slate-300">{step}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
