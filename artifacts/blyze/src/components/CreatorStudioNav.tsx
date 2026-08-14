import { Link } from 'wouter';
import { Library, Radio, Wallet } from 'lucide-react';

type CreatorWorkspace = 'live' | 'watch' | 'revenue';

interface CreatorStudioNavProps {
  active: CreatorWorkspace;
  className?: string;
}

const WORKSPACES = [
  { id: 'live', label: 'Live studio', href: '/dashboard/live', icon: Radio },
  { id: 'watch', label: 'Watch manager', href: '/dashboard/watch', icon: Library },
  { id: 'revenue', label: 'Revenue & wallet', href: '/dashboard/live?tab=revenue', icon: Wallet },
] as const;

/** Shared entry rail for the creator's existing Live, Watch, and money workspaces. */
export function CreatorStudioNav({ active, className = '' }: CreatorStudioNavProps) {
  return (
    <nav aria-label="Creator studio workspaces" className={`flex min-w-max items-center gap-1 rounded-xl border border-white/[0.08] bg-black/20 p-1 ${className}`}>
      {WORKSPACES.map(({ id, label, href, icon: Icon }) => {
        const isActive = id === active;
        return (
          <Link
            key={id}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            title={label}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors sm:px-3 ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
