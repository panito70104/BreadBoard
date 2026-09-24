"use client";

import { useEffect, useState } from "react";
import { CreditCard, Receipt } from "lucide-react";

import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { PricingGrid } from "@/components/pricing/pricing-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { createCheckoutSession, getPricingPlans } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types";

/**
 * Invoices come from the payment provider, so there are none until checkout is
 * live. TODO(payments): GET /billing/invoices from Recurrente.
 */
interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: string;
}

const INVOICES: Invoice[] = [];

export default function BillingPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void getPricingPlans().then((result) => {
      setPlans(result);
      setIsLoading(false);
    });
  }, []);

  async function handleSelectPlan(plan: SubscriptionPlan) {
    setPendingPlan(plan.id);
    // TODO(payments): redirect to the Recurrente checkout URL returned here.
    const { checkoutUrl } = await createCheckoutSession(plan.id);
    setPendingPlan(null);
    setNotice(
      `Checkout mock para el plan ${plan.name}. Con Recurrente conectado te llevaríamos a ${checkoutUrl}.`,
    );
  }

  const usageRatio =
    user && user.minutesLimit > 0 ? (user.minutesUsed / user.minutesLimit) * 100 : 0;

  return (
    <PageBody>
      <PageHeader
        title="Billing"
        description="Tu plan, tu consumo y tus facturas."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <CreditCard className="size-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Plan {user?.planId ?? "free"}
              </p>
              <p className="text-xs text-slate-500">Se renueva el 1 de cada mes</p>
            </div>
          </div>

          {user && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Minutos usados este mes</span>
                <span className="font-medium text-slate-900">
                  {user.minutesUsed} / {user.minutesLimit} min
                </span>
              </div>
              <Progress value={usageRatio} className="mt-2.5" label="Uso mensual" />
              <p className="mt-2 text-xs text-slate-500">
                Te quedan {Math.max(0, user.minutesLimit - user.minutesUsed)} minutos en
                este ciclo.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
            <Button variant="outline" size="sm">
              Actualizar método de pago
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">
              Cancelar plan
            </Button>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Receipt className="size-4.5" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-slate-900">Facturas</p>
          </div>

          {INVOICES.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              Todavía no tienes facturas. Aparecerán aquí después de tu primer pago.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-slate-100">
              {INVOICES.map((invoice) => (
                <li key={invoice.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{invoice.amount}</p>
                    <p className="text-xs text-slate-500">{formatDate(invoice.date)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    {invoice.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {notice && (
        <p className="animate-fade-in mt-6 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          {notice}
        </p>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Cambiar de plan</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sube o baja cuando quieras. El cambio aplica al siguiente ciclo.
        </p>

        <div className="mt-6">
          {isLoading ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-96 rounded-2xl" />
              ))}
            </div>
          ) : (
            <PricingGrid
              plans={plans}
              currentPlanId={user?.planId}
              renderAction={(plan) =>
                plan.id === user?.planId ? (
                  <Button variant="outline" size="lg" className="w-full" disabled>
                    Plan actual
                  </Button>
                ) : (
                  <Button
                    variant={plan.highlighted ? "primary" : "outline"}
                    size="lg"
                    className="w-full"
                    isLoading={pendingPlan === plan.id}
                    onClick={() => void handleSelectPlan(plan)}
                  >
                    {plan.ctaLabel}
                  </Button>
                )
              }
            />
          )}
        </div>
      </section>
    </PageBody>
  );
}
