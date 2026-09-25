"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { businessTypeLabel } from "@/lib/business-types";
import { useSetup } from "@/lib/setup-store";

/**
 * Step 5 — Review. A short summary, not a configuration report: the owner
 * just needs confirmation that the essentials are in place.
 */

export function ReviewStep({
  onBack,
  onGoToBizMate,
  busy,
}: {
  onBack: () => void;
  onGoToBizMate: () => void;
  busy: boolean;
}) {
  const { setup } = useSetup();

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
        Your BizMate setup
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Everything essential is in place. You can refine details anytime in
        Settings.
      </p>

      <dl className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        <SummaryRow label="Business" value={setup.businessDraft.name} />
        <SummaryRow label="Business type" value={businessTypeLabel(setup.businessType)} />
        <SummaryRow
          label="Owner"
          value={setup.owner.name + (setup.owner.email ? ` · ${setup.owner.email}` : "")}
        />
        <SummaryRow
          label="Employees"
          value={
            setup.employees.length === 0
              ? "None yet — add them anytime"
              : `${setup.employees.length}`
          }
        />
        <SummaryRow
          label="Products"
          value={
            setup.products.length === 0
              ? "None yet — add them anytime"
              : `${setup.products.length}`
          }
        />
      </dl>

      <div className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
        <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-700">You&apos;re ready to go.</p>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onGoToBizMate} disabled={busy}>
          {busy ? "Setting up your workspace…" : "Go to BizMate"}
        </Button>
      </div>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-sm text-zinc-500">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium text-zinc-900">
        {value || "—"}
      </dd>
    </div>
  );
}
