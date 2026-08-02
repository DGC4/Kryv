import { Crown, ShieldCheck, Sparkles, Star, Timer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function KryvLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="group flex min-w-0 items-center gap-2.5" aria-label="Kryv">
      <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-400 via-violet-500 to-fuchsia-600 shadow-[0_0_28px_rgba(147,91,255,0.42)]">
        <div className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]" />
        <svg className="relative h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 4v16M5 12h3.2L18.5 4M8.2 12 18.5 20" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!compact && <span className="kryv-title text-xl font-bold text-white">KRYV</span>}
    </div>
  );
}

type BadgeKind = "owner" | "admin" | "superstar" | "member";

const badgeConfig: Record<BadgeKind, { label: string; detail: string; icon: typeof Crown; tone: string }> = {
  owner: { label: "DGC", detail: "Official DGC owner", icon: Crown, tone: "text-amber-300 border-amber-300/25 bg-amber-300/10 shadow-[0_0_14px_rgba(252,211,77,0.24)]" },
  admin: { label: "Staff", detail: "Kryv platform staff", icon: ShieldCheck, tone: "text-cyan-300 border-cyan-300/25 bg-cyan-300/10" },
  superstar: { label: "Superstar", detail: "Recognized community contributor", icon: Star, tone: "text-fuchsia-300 border-fuchsia-300/25 bg-fuchsia-300/10" },
  member: { label: "30 day member", detail: "A loyal Kryv community member", icon: Timer, tone: "text-violet-300 border-violet-300/25 bg-violet-300/10" },
};

export function CreatorBadge({ kind, className = "" }: { kind: BadgeKind; className?: string }) {
  const config = badgeConfig[kind];
  const Icon = config.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`kryv-badge-glow inline-flex h-5 w-5 items-center justify-center rounded-md border ${config.tone} ${className}`} tabIndex={0} aria-label={config.detail}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      </TooltipTrigger>
      <TooltipContent className="border-white/10 bg-[#151521]/95 text-white backdrop-blur-xl">
        <p className="text-xs font-extrabold">{config.label}</p>
        <p className="text-[11px] text-white/55">{config.detail}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function KryvLiveMark() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-[10px] font-extrabold tracking-[0.12em] text-rose-300">
      <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-300" /></span>
      LIVE
    </span>
  );
}

export function KryvOrb() {
  return (
    <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 opacity-50" aria-hidden="true">
      <div className="kryv-orbit absolute inset-0 rounded-full border border-violet-400/20" />
      <div className="absolute inset-7 rounded-full border border-fuchsia-300/15" />
      <Sparkles className="absolute left-6 top-24 h-4 w-4 text-fuchsia-200/70" />
    </div>
  );
}
