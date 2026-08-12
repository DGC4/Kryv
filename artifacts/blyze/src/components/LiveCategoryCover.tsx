import type { LucideIcon } from 'lucide-react';
import {
  Aperture,
  Gamepad2,
  Headphones,
  MapPinned,
  MessagesSquare,
  Mic2,
  Palette,
  RadioTower,
  Sparkles,
  Trophy,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';

export type LiveCategoryCoverVariant = 'card' | 'hero' | 'tile';

type CategoryVisual = {
  icon: LucideIcon;
  description: string;
  eyebrow: string;
  base: string;
  glow: string;
  orb: string;
  line: string;
};

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  'just-chatting': {
    icon: MessagesSquare,
    description: 'Conversations, stories, and community moments.',
    eyebrow: 'Community',
    base: 'from-[#24122f] via-[#0c111e] to-[#06131b]',
    glow: 'bg-fuchsia-400/35',
    orb: 'border-fuchsia-200/30 bg-fuchsia-400/10',
    line: 'bg-fuchsia-200/55',
  },
  'irl-travel': {
    icon: MapPinned,
    description: 'Real-world moments, travel, and street-level stories.',
    eyebrow: 'Out in the world',
    base: 'from-[#0b2a2c] via-[#0b1721] to-[#08101f]',
    glow: 'bg-teal-300/35',
    orb: 'border-teal-100/30 bg-teal-300/10',
    line: 'bg-teal-100/60',
  },
  gaming: {
    icon: Gamepad2,
    description: 'Games, new worlds, and creator-led play.',
    eyebrow: 'Play live',
    base: 'from-[#101c46] via-[#101321] to-[#071522]',
    glow: 'bg-cyan-300/35',
    orb: 'border-cyan-100/30 bg-cyan-300/10',
    line: 'bg-cyan-100/65',
  },
  'music-djs': {
    icon: Headphones,
    description: 'Sets, sessions, and live sound from the community.',
    eyebrow: 'On the air',
    base: 'from-[#213313] via-[#111c18] to-[#090f14]',
    glow: 'bg-lime-300/30',
    orb: 'border-lime-100/30 bg-lime-300/10',
    line: 'bg-lime-100/60',
  },
  creative: {
    icon: Palette,
    description: 'Making, drawing, building, and creative process.',
    eyebrow: 'Make it live',
    base: 'from-[#3a1812] via-[#1d1520] to-[#0a1420]',
    glow: 'bg-orange-300/35',
    orb: 'border-orange-100/30 bg-orange-300/10',
    line: 'bg-orange-100/60',
  },
  esports: {
    icon: Trophy,
    description: 'Competition, tournaments, and teams in motion.',
    eyebrow: 'Competition',
    base: 'from-[#35141c] via-[#21131f] to-[#081622]',
    glow: 'bg-rose-300/35',
    orb: 'border-rose-100/30 bg-rose-300/10',
    line: 'bg-rose-100/60',
  },
  sports: {
    icon: RadioTower,
    description: 'Live sports culture, commentary, and shared moments.',
    eyebrow: 'Game time',
    base: 'from-[#122d38] via-[#111c26] to-[#0a0d1a]',
    glow: 'bg-sky-300/35',
    orb: 'border-sky-100/30 bg-sky-300/10',
    line: 'bg-sky-100/60',
  },
  'talk-podcasts': {
    icon: Mic2,
    description: 'Ideas, interviews, and long-form conversations.',
    eyebrow: 'Listen in',
    base: 'from-[#35260e] via-[#211917] to-[#101218]',
    glow: 'bg-amber-300/35',
    orb: 'border-amber-100/30 bg-amber-300/10',
    line: 'bg-amber-100/60',
  },
  'tech-building': {
    icon: Wrench,
    description: 'Technology, building, learning, and experiments.',
    eyebrow: 'In the lab',
    base: 'from-[#0c3232] via-[#101d23] to-[#071118]',
    glow: 'bg-emerald-300/35',
    orb: 'border-emerald-100/30 bg-emerald-300/10',
    line: 'bg-emerald-100/60',
  },
  'food-culture': {
    icon: UtensilsCrossed,
    description: 'Food, culture, and shared experiences.',
    eyebrow: 'Around the table',
    base: 'from-[#3c1a12] via-[#211719] to-[#100d15]',
    glow: 'bg-red-300/30',
    orb: 'border-red-100/30 bg-red-300/10',
    line: 'bg-red-100/60',
  },
  'fashion-lifestyle': {
    icon: Aperture,
    description: 'Style, beauty, and the everyday elevated.',
    eyebrow: 'The edit',
    base: 'from-[#31203d] via-[#20182b] to-[#0c111b]',
    glow: 'bg-violet-300/35',
    orb: 'border-violet-100/30 bg-violet-300/10',
    line: 'bg-violet-100/60',
  },
  'special-events': {
    icon: Sparkles,
    description: 'One-time moments, premieres, and community events.',
    eyebrow: 'Live occasion',
    base: 'from-[#2d3011] via-[#1d1d1a] to-[#0d1018]',
    glow: 'bg-yellow-200/35',
    orb: 'border-yellow-100/30 bg-yellow-200/10',
    line: 'bg-yellow-100/60',
  },
};

const FALLBACK_VISUAL = CATEGORY_VISUALS.gaming;

export function getLiveCategoryVisual(slug?: string | null) {
  return CATEGORY_VISUALS[slug || ''] || FALLBACK_VISUAL;
}

export function LiveCategoryCover({
  slug,
  variant = 'card',
  className = '',
}: {
  slug?: string | null;
  variant?: LiveCategoryCoverVariant;
  className?: string;
}) {
  const visual = getLiveCategoryVisual(slug);
  const Icon = visual.icon;
  const isHero = variant === 'hero';
  const isTile = variant === 'tile';

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-br ${visual.base} ${className}`}>
      <div className={`absolute -right-1/3 -top-1/4 h-[88%] w-[88%] rounded-full blur-3xl ${visual.glow} kryv-category-drift`} />
      <div className={`absolute -bottom-1/3 -left-1/4 h-[72%] w-[72%] rounded-full blur-3xl ${visual.glow} opacity-45 kryv-category-drift-slow`} />
      <div className={`absolute left-[12%] top-[14%] rounded-full border ${visual.orb} ${isHero ? 'h-56 w-56 sm:h-80 sm:w-80' : isTile ? 'h-24 w-24' : 'h-36 w-36 sm:h-44 sm:w-44'} kryv-category-orbit`} />
      <div className={`absolute left-[19%] top-[21%] rounded-full border ${visual.orb} ${isHero ? 'h-40 w-40 sm:h-56 sm:w-56' : isTile ? 'h-16 w-16' : 'h-24 w-24 sm:h-32 sm:w-32'}`} />
      <div className={`absolute left-[7%] top-[48%] h-px w-[88%] rotate-[-18deg] ${visual.line} opacity-45`} />
      <div className={`absolute left-[8%] top-[61%] h-px w-[70%] rotate-[24deg] ${visual.line} opacity-25`} />
      <div className={`absolute flex items-center justify-center rounded-2xl border border-white/15 bg-black/20 text-white/85 shadow-2xl backdrop-blur-sm ${isHero ? 'right-[13%] top-[18%] h-20 w-20 sm:h-28 sm:w-28' : isTile ? 'right-4 top-4 h-10 w-10' : 'right-4 top-5 h-14 w-14 sm:h-16 sm:w-16'} kryv-category-float`}>
        <Icon className={isHero ? 'h-9 w-9 sm:h-12 sm:w-12' : isTile ? 'h-5 w-5' : 'h-6 w-6 sm:h-7 sm:w-7'} strokeWidth={1.5} />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_30%,transparent_0%,rgba(0,0,0,0.06)_42%,rgba(0,0,0,0.72)_100%)]" />
    </div>
  );
}
