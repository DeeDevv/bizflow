/** Small shared primitives for the setup wizard steps (Phase 2). */

/** The standard input style used across the app's forms. */
export const field =
  "mt-1.5 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

/** A form-wide error line (same style as the auth and modal forms). */
export function StepError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}
