import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { notation: value >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function PageLoading() {
  return <div className="flex min-h-[55vh] items-center justify-center"><div className="flex items-center gap-3 text-sm text-white/55"><Loader2 className="h-5 w-5 animate-spin text-violet-300" />Loading creator studio…</div></div>;
}

export function PageError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return <section className="kryv-card mx-auto flex min-h-[45vh] max-w-xl flex-col items-center justify-center rounded-3xl px-6 py-10 text-center"><div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-rose-400/10 text-rose-300"><AlertCircle className="h-5 w-5" /></div><h1 className="kryv-title text-2xl font-bold text-white">Creator studio is unavailable</h1><p className="mt-3 max-w-sm text-sm leading-6 text-white/55">{message || "We couldn’t load your private creator information. Please try again."}</p>{onRetry && <Button onClick={onRetry} className="kryv-action mt-6 rounded-xl bg-violet-300 font-bold text-[#14111d] hover:bg-violet-200">Try again</Button>}</section>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="kryv-label mb-2">{eyebrow}</p><h1 className="kryv-title text-3xl font-bold text-white sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{description}</p></div>{action && <div className="shrink-0">{action}</div>}</header>;
}

export function EmptyPanel({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-black/10 px-6 py-8 text-center"><p className="font-bold text-white/80">{title}</p><p className="mt-1 max-w-sm text-sm leading-6 text-white/40">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}
