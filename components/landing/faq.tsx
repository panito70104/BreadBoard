import { ChevronDown } from "lucide-react";

import { faqItems } from "@/data/landing";
import { Container, Section, SectionHeading } from "@/components/ui/section";

export function Faq() {
  return (
    <Section id="faq" className="scroll-mt-16">
      <Container>
        <SectionHeading
          eyebrow="Q&A"
          title="Preguntas frecuentes"
          description="Lo que suelen preguntarnos antes de subir el primer documento."
        />

        <div className="mx-auto mt-12 max-w-3xl divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {faqItems.map((item) => (
            <details key={item.question} className="group px-5 py-1 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-medium text-slate-900 marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                {item.question}
                <ChevronDown
                  className="size-5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
