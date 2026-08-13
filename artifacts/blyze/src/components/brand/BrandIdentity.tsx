import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Crown, ShieldCheck, Star, Clock, Zap } from 'lucide-react';

/**
 * Compact Kryv product mark. The mark remains distinctive without animation,
 * so navigation stays quiet while content and status carry the hierarchy.
 */
export function KryvLogo({ className = 'h-9', subscriptionTier: _subscriptionTier = 'free' }: { className?: string; subscriptionTier?: 'free' | 'plus' | 'pro' | 'ultra' }) {
  void _subscriptionTier;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
        <svg viewBox="0 0 100 100" className="h-6 w-6" aria-hidden="true">
          <path d="M21 18h17v64H21z" fill="currentColor" />
          <path d="M43 46 74 18h14L53 50z" fill="currentColor" opacity="0.88" />
          <path d="m43 54 10-4 35 32H74z" fill="currentColor" />
        </svg>
      </div>
      <span className="font-display text-base font-bold tracking-[0.18em] text-white select-none">KRYV</span>
    </div>
  );
}

export type BadgeType = 'owner' | 'admin' | 'superstar' | 'member_30' | 'founder';

interface UserBadgeProps {
  type: BadgeType;
  size?: 'sm' | 'md';
  className?: string;
}

const BADGE_CONFIG = {
  owner: {
    label: 'DGC owner',
    description: 'Platform creator and owner',
    icon: Crown,
    color: 'text-yellow-300',
    bg: 'bg-yellow-300/10',
    border: 'border-yellow-300/20',
  },
  admin: {
    label: 'Staff',
    description: 'Kryv platform staff',
    icon: ShieldCheck,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  },
  superstar: {
    label: 'Top contributor',
    description: 'Recognized community contributor',
    icon: Star,
    color: 'text-purple-300',
    bg: 'bg-purple-300/10',
    border: 'border-purple-300/20',
  },
  member_30: {
    label: '30-day member',
    description: 'Member for 30 days or more',
    icon: Clock,
    color: 'text-blue-300',
    bg: 'bg-blue-300/10',
    border: 'border-blue-300/20',
  },
  founder: {
    label: 'Founder',
    description: 'Original Kryv beta user',
    icon: Zap,
    color: 'text-orange-300',
    bg: 'bg-orange-300/10',
    border: 'border-orange-300/20',
  },
};

export function UserBadge({ type, size = 'md', className = '' }: UserBadgeProps) {
  const config = BADGE_CONFIG[type];
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'h-4 w-4 p-0.5' : 'h-5 w-5 p-1';

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center justify-center rounded-md border ${config.bg} ${config.border} ${config.color} ${sizeClasses} ${className}`}>
            <Icon className="h-full w-full" strokeWidth={2.25} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="border-white/10 bg-black/95 px-3 py-1.5 text-white">
          <p className={`text-xs font-semibold ${config.color}`}>{config.label}</p>
          <p className="mt-0.5 text-[11px] text-white/60">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Official owner identifier used in administrative contexts. */
export function GoldenDBadge({ className = '' }: { className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-yellow-300/25 bg-yellow-300/10 text-[11px] font-bold text-yellow-200 ${className}`}>
            D
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="border-white/10 bg-black/95 px-3 py-1.5 text-white">
          <p className="text-xs font-semibold text-yellow-200">DGC</p>
          <p className="mt-0.5 text-[11px] text-white/60">Official DGC Arcade owner</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
