import { PricingCard } from "@/components/pricing/pricing-card";
import { cn } from "@/lib/utils";
import type { PlanId, SubscriptionPlan } from "@/types";

export interface PricingGridProps {
  plans: SubscriptionPlan[];
  currentPlanId?: PlanId;
  renderAction?: (plan: SubscriptionPlan) => React.ReactNode;
  className?: string;
}

export function PricingGrid({
  plans,
  currentPlanId,
  renderAction,
  className,
}: PricingGridProps) {
  return (
    <div className={cn("grid items-start gap-6 lg:grid-cols-3", className)}>
      {plans.map((plan) => (
        <PricingCard
          key={plan.id}
          plan={plan}
          isCurrent={plan.id === currentPlanId}
          action={renderAction?.(plan)}
        />
      ))}
    </div>
  );
}
