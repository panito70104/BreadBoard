import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, formatPrice } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types";

export interface PricingCardProps {
  plan: SubscriptionPlan;
  /** Marks the plan the signed-in user is already on. */
  isCurrent?: boolean;
  href?: string;
  /** Rendered instead of the link when the page handles checkout itself. */
  action?: React.ReactNode;
  className?: string;
}

export function PricingCard({
  plan,
  isCurrent = false,
  href = "/signup",
  action,
  className,
}: PricingCardProps) {
  const isHighlighted = plan.highlighted && !isCurrent;

  return (
    <Card
      as="article"
      className={cn(
        "relative flex flex-col p-6 sm:p-7",
        isHighlighted &&
          "border-brand-200 shadow-[var(--shadow-float)] ring-1 ring-brand-100 lg:-my-3 lg:py-10",
        className,
      )}
    >
      {isHighlighted && (
        <Badge
          tone="brand"
          className="absolute -top-3 left-6 border border-brand-100 bg-brand-600 text-white"
        >
          Más elegido
        </Badge>
      )}
      {isCurrent && (
        <Badge tone="success" className="absolute -top-3 left-6 border border-emerald-100">
          Tu plan actual
        </Badge>
      )}

      <header>
        <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>

        <p className="mt-5 flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold tracking-tight text-slate-900">
            {formatPrice(plan.price, plan.currency)}
          </span>
          <span className="text-sm text-slate-500">/ mes</span>
        </p>

        <p className="mt-3 text-sm text-slate-600">
          {plan.minutesPerMonth} minutos de video al mes
          {" · "}
          hasta {plan.maxDurationMinutes} min por video
        </p>
      </header>

      <ul className="mt-6 flex-1 space-y-3 border-t border-slate-100 pt-6">
        {plan.features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2.5 text-sm">
            {feature.included ? (
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
            ) : (
              <Minus className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden />
            )}
            <span className={feature.included ? "text-slate-700" : "text-slate-400"}>
              {feature.label}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        {action ?? (
          <Link
            href={href}
            className={buttonVariants({
              variant: isHighlighted ? "primary" : "outline",
              size: "lg",
              className: "w-full",
            })}
          >
            {plan.ctaLabel}
          </Link>
        )}
      </div>
    </Card>
  );
}
