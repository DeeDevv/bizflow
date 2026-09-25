"use client";

import { useBusiness } from "@/lib/business-store";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SetupWizard } from "@/components/setup/SetupWizard";

/**
 * First-login gate (Phase 2): when the signed-in owner has no business yet,
 * the dashboard is covered by the guided setup wizard — Business → Owner →
 * Team → Products → Review. Nothing else in the app is usable until the
 * business is registered, which is also where the owner picks their real
 * currency, so no default $ anywhere.
 *
 * Creating the business goes through the same real saveBusiness path; the
 * other wizard records are Phase-2 local/mock (see setup-store).
 */
export function SetupGate({ children }: { children: React.ReactNode }) {
  const { business, status } = useBusiness();

  if (status === "loading") {
    // One quiet beat while the business record is read — no flash of setup.
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Loading your workspace…</p>
      </div>
    );
  }

  // Business exists (or demo mode): normal dashboard.
  if (business.id || !isSupabaseConfigured) return <>{children}</>;

  return <SetupWizard />;
}
