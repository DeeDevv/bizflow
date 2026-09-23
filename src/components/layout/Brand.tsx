/** BizFlow logo lockup — gradient mark plus wordmark. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-card"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-4.5 w-4.5 text-white"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M21 7v6h-6" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-zinc-900">
        BizFlow
      </span>
    </div>
  );
}
