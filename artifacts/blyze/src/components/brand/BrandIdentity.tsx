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
export function KryvLogo({ className = "h-9" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 group shrink-0 cursor-pointer ${className}`}>
      <div className="relative w-10 h-10 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
        {/* Billion-Dollar Mark: Custom SVG K-Play-Signal Fusion */}
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)] group-hover:drop-shadow-[0_0_20px_hsl(var(--primary)/0.8)] transition-all duration-500">
          <defs>
            <linearGradient id="kryvGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="#00E5FF" />
            </linearGradient>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          {/* Background Shard 1 (Left Pillar) */}
          <path 
            d="M25 20 L40 20 L40 80 L25 80 Z" 
            fill="url(#kryvGradient)" 
            className="animate-pulse-subtle"
          />
          
          {/* Background Shard 2 (Top Arm / Signal) */}
          <path 
            d="M45 45 L75 20 L85 20 L55 50 Z" 
            fill="url(#kryvGradient)" 
            opacity="0.9"
          />
          
          {/* Background Shard 3 (Bottom Arm / Play Button) */}
          <path 
            d="M45 55 L55 50 L85 80 L75 80 Z" 
            fill="url(#kryvGradient)" 
          />
          
          {/* Central Highlight (The 'K' spine) */}
          <rect x="30" y="25" width="4" height="50" fill="white" opacity="0.2" rx="2" />
          
          {/* Animated Play-Indicator Pulse */}
          <circle cx="55" cy="50" r="4" fill="white" className="animate-ping" style={{ animationDuration: '3s' }} />
        </svg>
        
        {/* Glassmorphism ring around the mark */}
        <div className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-[2px] -z-10 group-hover:border-primary/30 transition-colors duration-500" />
      </div>
      
      {/* Brand Text: Ultra-premium Typography */}
      <div className="flex flex-col -gap-1">
        <span className="font-black text-xl tracking-[0.2em] text-white select-none group-hover:text-primary transition-colors duration-500 leading-none">
          KRYV
        </span>
        <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div className="h-[1px] w-8 bg-primary/50" />
          <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">Premium</span>
        </div>
      </div>
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
