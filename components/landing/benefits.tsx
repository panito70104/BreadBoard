import { benefits } from "@/data/landing";
import { Container, Section, SectionHeading } from "@/components/ui/section";
import { cn } from "@/lib/utils";

export function Benefits() {
  return (
    <Section id="beneficios" className="scroll-mt-16">
      <Container>
        <SectionHeading
          eyebrow="Beneficios"
          title="Pensado para la semana antes del examen"
          description="No es otra app de resúmenes: es la explicación que te faltaba, en video."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ title, description, Icon }, index) => (
            <article
              key={title}
              className={cn(
                "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-card)] transition-transform duration-200 hover:-translate-y-0.5",
                // The first card spans two columns on large screens for rhythm.
                index === 0 && "lg:col-span-2 lg:flex lg:items-center lg:gap-6",
              )}
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600",
                  index === 0 && "lg:size-14",
                )}
              >
                <Icon className={cn("size-5", index === 0 && "lg:size-7")} aria-hidden />
              </span>
              <div className={cn(index !== 0 && "mt-5")}>
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
