import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Crown, ShieldCheck, Star, Clock, Zap } from 'lucide-react';

/**
 * KRYV Logo - Code-based SVG logo with neon glow
 */
export function KryvLogo({ className = "h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 group shrink-0 ${className}`}>
      <div className="relative w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_16px_hsl(var(--primary)/0.5)] group-hover:shadow-[0_0_24px_hsl(var(--primary)/0.7)] transition-all duration-500 overflow-hidden">
        {/* Animated background shine */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
        <span className="relative font-black text-primary-foreground text-sm tracking-tight select-none">K</span>
      </div>
      <span className="font-black text-lg tracking-tighter text-white hidden sm:block select-none group-hover:text-primary transition-colors duration-300">
        KRYV
      </span>
    </div>
  );
}

/**
 * User Badge Component - Tiered badges with animations and tooltips
 */
export type BadgeType = 'owner' | 'admin' | 'superstar' | 'member_30' | 'founder';

interface UserBadgeProps {
  type: BadgeType;
  size?: 'sm' | 'md';
  className?: string;
}

const BADGE_CONFIG = {
  owner: {
    label: 'DGC Owner',
    description: 'Platform Creator & Owner',
    icon: Crown,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/20',
    glow: 'shadow-[0_0_10px_rgba(250,204,21,0.4)]',
    animate: 'animate-bounce-subtle',
  },
  admin: {
    label: 'Staff',
    description: 'Kryv Platform Staff',
    icon: ShieldCheck,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    glow: 'shadow-[0_0_8px_hsl(var(--primary)/0.3)]',
    animate: '',
  },
  superstar: {
    label: 'Superstar',
    description: 'Top Contributor',
    icon: Star,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/20',
    glow: 'shadow-[0_0_8px_rgba(192,132,252,0.3)]',
    animate: 'animate-pulse-subtle',
  },
  member_30: {
    label: '30 Day Member',
    description: 'Loyal member for 30+ days',
    icon: Clock,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
    glow: '',
    animate: '',
  },
  founder: {
    label: 'Founder',
    description: 'Original Kryv Beta User',
    icon: Zap,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/20',
    glow: 'shadow-[0_0_8px_rgba(251,146,60,0.3)]',
    animate: '',
  },
};

export function UserBadge({ type, size = 'md', className = "" }: UserBadgeProps) {
  const config = BADGE_CONFIG[type];
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'w-4 h-4 p-0.5' : 'w-5 h-5 p-1';
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className={`
            inline-flex items-center justify-center rounded-md border transition-all duration-300 cursor-help
            ${config.bg} ${config.border} ${config.color} ${config.glow} ${config.animate} ${sizeClasses} ${className}
            hover:scale-110 hover:brightness-125
          `}>
            <Icon className="w-full h-full" strokeWidth={2.5} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-black/90 border-white/10 text-white px-3 py-1.5 backdrop-blur-xl">
          <div className="flex flex-col gap-0.5">
            <p className={`text-xs font-black uppercase tracking-widest ${config.color}`}>{config.label}</p>
            <p className="text-[10px] text-white/60 font-medium">{config.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Golden D Badge - Specifically for FanoDGC
 */
export function GoldenDBadge({ className = "" }: { className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className={`
            relative w-5 h-5 flex items-center justify-center cursor-help transition-all duration-500 hover:scale-125
            ${className}
          `}>
            {/* Glow background */}
            <div className="absolute inset-0 bg-yellow-400/20 blur-md rounded-full animate-pulse" />
            
            {/* SVG Golden D */}
            <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]">
              <defs>
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFE55C" />
                  <stop offset="50%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#CC9900" />
                </linearGradient>
              </defs>
              <text
                x="50%" y="75%"
                fontFamily="Arial Black, sans-serif"
                fontWeight="900"
                fontSize="80"
                fill="url(#goldGrad)"
                textAnchor="middle"
              >D</text>
            </svg>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-black/90 border-white/10 text-white px-3 py-1.5 backdrop-blur-xl">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-black uppercase tracking-widest text-yellow-400">DGC</p>
            <p className="text-[10px] text-white/60 font-medium">Official DGC Arcade Owner</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
