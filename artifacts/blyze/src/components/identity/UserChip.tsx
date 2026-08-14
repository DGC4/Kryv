import { useGetUserProfile } from '@workspace/api-client-react';
import { Radio, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

export type UserChipSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<UserChipSize, { avatar: string; text: string; gap: string }> = {
  sm: { avatar: 'h-7 w-7 text-[10px]', text: 'text-xs', gap: 'gap-2' },
  md: { avatar: 'h-9 w-9 text-xs', text: 'text-sm', gap: 'gap-2.5' },
  lg: { avatar: 'h-11 w-11 text-sm', text: 'text-sm', gap: 'gap-3' },
};

export function UserChip({
  username,
  avatarUrl,
  size = 'md',
  showAvatar = true,
  showName = true,
  className = '',
}: {
  username: string;
  avatarUrl?: string | null;
  size?: UserChipSize;
  showAvatar?: boolean;
  showName?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: profile } = useGetUserProfile(username, { query: { enabled: open && Boolean(username), staleTime: 60_000 } as any });
  const classes = SIZE_CLASSES[size];
  const profileHref = `/u/${encodeURIComponent(username)}`;

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={220} closeDelay={120}>
      <HoverCardTrigger asChild>
        <Link href={profileHref} className={`group/user-chip relative inline-flex min-w-0 items-center after:absolute after:-inset-2 after:content-[''] ${classes.gap} ${className}`} aria-label={`View ${username}'s Kryv profile`}>
          {showAvatar && <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.1] bg-primary/10 font-semibold text-primary ${classes.avatar}`}>{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : username.slice(0, 1).toUpperCase()}</span>}
          {showName && <span className={`truncate font-semibold text-white transition group-hover/user-chip:text-primary ${classes.text}`}>{username}</span>}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={10} className="w-72 border-white/[0.12] bg-[#0b0e14]/[0.98] p-4 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.1] bg-primary/15 text-sm font-semibold text-primary">{profile?.avatarUrl || avatarUrl ? <img src={profile?.avatarUrl || avatarUrl || undefined} alt="" className="h-full w-full object-cover" /> : username.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{profile?.username || username}</p><p className="mt-1 text-xs leading-relaxed text-white/45">{profile?.creatorChannel ? profile.creatorChannel.isLive ? 'Live on Kryv now' : 'Kryv creator channel' : 'Kryv account'}</p></div></div>
        {profile?.creatorChannel && <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-white/75">{profile.creatorChannel.isLive ? <Radio className="h-3.5 w-3.5 text-primary" /> : <Users className="h-3.5 w-3.5 text-primary" />}<span className="truncate">{profile.creatorChannel.displayName}</span></div><p className="mt-1 truncate text-[11px] text-white/40">{profile.creatorChannel.isLive ? profile.creatorChannel.streamTitle || 'Live on Kryv' : `${profile.creatorChannel.followerCount.toLocaleString()} followers`}</p></div>}
        {!profile && <div className="mt-4 flex items-center gap-2 text-xs text-white/45"><UserRound className="h-3.5 w-3.5 text-primary" />Loading public profile…</div>}
        <Link href={profileHref} className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground">View profile</Link>
      </HoverCardContent>
    </HoverCard>
  );
}
