import { Link } from "wouter";
import { LogIn, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { buildAuthPath } from "@/lib/auth-return";

export type AccountEntryIntent = "follow" | "alerts" | "chat" | "clip" | "engagement" | "report" | "membership";

const copy: Record<AccountEntryIntent, { title: string; description: string }> = {
  follow: {
    title: "Follow this creator",
    description: "Create an account to keep this channel in your Live following list and receive the controls that go with it.",
  },
  alerts: {
    title: "Manage live alerts",
    description: "Create an account to choose when Kryv alerts you about creators you follow.",
  },
  chat: {
    title: "Join stream chat",
    description: "Create an account to send messages. Watching this broadcast remains available without an account.",
  },
  clip: {
    title: "Create a live clip",
    description: "Create an account to request a clip tied to your Kryv profile and the channel’s publication controls.",
  },
  engagement: {
    title: "Join channel engagement",
    description: "Create an account to collect channel points and participate in channel polls or predictions.",
  },
  report: {
    title: "Send a safety report",
    description: "Create an account so Kryv can protect the integrity of the report and follow up when needed.",
  },
  membership: {
    title: "Join this channel",
    description: "Create an account to receive an individual channel membership after provider-confirmed crypto settlement.",
  },
};

interface AccountEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: AccountEntryIntent;
  returnTo: string;
}

export function AccountEntryDialog({ open, onOpenChange, intent, returnTo }: AccountEntryDialogProps) {
  const detail = copy[intent];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(28rem,calc(100vw-2rem))] border-white/10 bg-[#10131a] p-5 shadow-2xl sm:p-6">
        <DialogTitle className="text-xl font-black tracking-tight text-white">{detail.title}</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-white/55">{detail.description}</DialogDescription>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link
            href={buildAuthPath("/sign-up", returnTo)}
            onClick={() => onOpenChange(false)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <UserPlus className="h-4 w-4" /> Create account
          </Link>
          <Link
            href={buildAuthPath("/sign-in", returnTo)}
            onClick={() => onOpenChange(false)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 text-sm font-black text-white transition hover:border-primary/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
        </div>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">You will return to this Live room after completing account entry.</p>
      </DialogContent>
    </Dialog>
  );
}
