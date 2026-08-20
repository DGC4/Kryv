import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuthStore } from '../lib/auth-store';
import { getApiUrl } from '../lib/api';
import { useGetMe, useGetNotificationInbox, useMarkNotificationRead } from '@workspace/api-client-react';
import { useThemeStore } from '../store/theme';
import { Bell, Menu, Radio, PlaySquare, Tv, Search, Palette, Lock, RefreshCw, LogOut, ShieldAlert, Video, LayoutDashboard, Clapperboard, Users, WalletCards } from 'lucide-react';
import { KryvLogo, GoldenDBadge } from './brand/BrandIdentity';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const NAV = [
  { label: 'Live',   path: '/live',   icon: Radio,       match: ['/', '/live'] },
  { label: 'Watch',  path: '/watch',  icon: PlaySquare,  match: ['/watch'] },
  { label: 'Creators', path: '/creators', icon: Users, match: ['/creators', '/profile', '/u'] },
  { label: 'Clips',  path: '/clips',  icon: Clapperboard, match: ['/clips'] },
  { label: 'Cinema', path: '/cinema', icon: Tv,          match: ['/cinema'] },
];

export function Header() {
  const [location, navigate] = useLocation();
  const { user, clearAuth } = useAuthStore();
  const isSignedIn = !!user;
  const { data: me } = useGetMe({ query: { enabled: isSignedIn } });
  const [notificationOffset, setNotificationOffset] = useState(0);
  const notificationInbox = useGetNotificationInbox({ limit: 12, offset: notificationOffset }, { query: { enabled: isSignedIn, refetchInterval: isSignedIn ? 30000 : false } });
  const markNotificationRead = useMarkNotificationRead();
  const cycleTheme = useThemeStore((s) => s.cycleTheme);
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const [searchQuery, setSearchQuery] = useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query.length >= 2) navigate(`/search?q=${encodeURIComponent(query)}`);
  };
  const handleLogout = async () => {
    try {
      await fetch(getApiUrl('/api/logout'), { method: 'POST', credentials: 'include' });
    } finally {
      clearAuth();
      navigate('/live');
    }
  };

  const openNotification = (notification: NonNullable<typeof notificationInbox.data>['items'][number]) => {
    if (!notification.isRead) markNotificationRead.mutate({ id: notification.id }, { onSuccess: () => notificationInbox.refetch() });
    const channelSlug = typeof notification.data?.channelSlug === 'string' ? notification.data.channelSlug : null;
    const videoId = typeof notification.data?.videoId === 'number' ? notification.data.videoId : null;
    const clipId = typeof notification.data?.clipId === 'number' ? notification.data.clipId : null;
    if (notification.type === 'followed_channel_live' && channelSlug) navigate(`/live/${channelSlug}`);
    if (notification.type === 'watch_upload_ready' && videoId) navigate(`/watch/${videoId}`);
    if (notification.type === 'clip_ready' && clipId) navigate(`/clips/${clipId}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
      <div className="mx-auto px-3 sm:px-4 lg:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4 max-w-[1600px]">

        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-1 sm:gap-6 min-w-0">
          <Link href="/" aria-label="Kryv home">
            <KryvLogo subscriptionTier={me?.role === 'owner' ? 'ultra' : 'free'} />
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Browse Kryv" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-primary sm:hidden"><Menu className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 border-white/10 bg-black/95 p-1 backdrop-blur-xl">{NAV.map((item) => <DropdownMenuItem key={item.path} asChild><Link href={item.path} className="flex cursor-pointer items-center gap-2.5"><item.icon className="h-4 w-4 text-primary" /><span>{item.label}</span></Link></DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>

          <nav aria-label="Primary navigation" className="hidden shrink-0 items-center gap-0 sm:flex sm:gap-0.5">
            {NAV.map(item => {
              const active = item.match.some(m => location === m || location.startsWith(`${m}/`));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-2 rounded-md text-sm font-semibold transition-colors ${
                    active
                      ? 'text-primary'
                      : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="hidden md:block">{item.label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Search + Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <form onSubmit={submitSearch} className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Kryv..."
              aria-label="Search Kryv"
              minLength={2}
              maxLength={64}
              className="h-8 bg-white/[0.06] border border-white/[0.08] rounded-full pl-8 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 focus:bg-white/[0.09] transition-all w-44 lg:w-56"
            />
          </form>

          <Link href="/search" className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Search Kryv" className="h-10 w-10 rounded-full text-white/50 hover:bg-white/[0.06] hover:text-primary" title="Search Kryv">
              <Search className="h-4 w-4" />
            </Button>
          </Link>

          {/* Theme controls: palette cycles immediately; the adjacent control records Auto or Locked behavior for route changes. */}
          <Button
            variant="ghost" size="icon"
            onClick={cycleTheme}
            aria-label="Cycle color theme"
            className="h-10 w-10 shrink-0 rounded-full text-white/40 hover:bg-white/[0.06] hover:text-primary"
            title="Cycle theme"
          >
            <Palette className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Theme rotation is ${themePreference === 'auto' ? 'automatic' : 'locked'}`}
                className="h-10 w-10 shrink-0 rounded-full text-white/40 hover:bg-white/[0.06] hover:text-primary"
                title={themePreference === 'auto' ? 'Theme rotation: automatic' : 'Theme rotation: locked'}
              >
                {themePreference === 'auto' ? <RefreshCw className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 border-white/10 bg-black/95 p-1.5 text-white backdrop-blur-xl">
              <DropdownMenuLabel className="px-2.5 py-2 text-sm font-semibold text-white">Theme rotation</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setThemePreference('auto')} className={`mb-1 flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 ${themePreference === 'auto' ? 'bg-primary/[0.12] text-white focus:bg-primary/[0.16]' : 'text-white/65 focus:bg-white/[0.08] focus:text-white'}`}>
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span><span className="block text-sm font-semibold">Auto</span><span className="mt-0.5 block text-[11px] leading-relaxed text-white/45">Advance to the next Kryv theme after navigation.</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setThemePreference('locked')} className={`flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 ${themePreference === 'locked' ? 'bg-primary/[0.12] text-white focus:bg-primary/[0.16]' : 'text-white/65 focus:bg-white/[0.08] focus:text-white'}`}>
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span><span className="block text-sm font-semibold">Locked</span><span className="mt-0.5 block text-[11px] leading-relaxed text-white/45">Keep your current theme until you choose another palette color.</span></span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isSignedIn ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={`Notifications${notificationInbox.data?.unreadCount ? `, ${notificationInbox.data.unreadCount} unread` : ''}`} className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.06] hover:text-primary"><Bell className="h-4 w-4" />{Boolean(notificationInbox.data?.unreadCount) && <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full border border-black bg-primary px-1 text-[9px] font-black leading-4 text-primary-foreground">{notificationInbox.data!.unreadCount > 9 ? '9+' : notificationInbox.data!.unreadCount}</span>}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1rem))] border-white/10 bg-black/95 p-1 backdrop-blur-xl"><DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2"><span className="text-sm font-black text-white">Notifications</span><span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{notificationInbox.data?.unreadCount ?? 0} unread</span></DropdownMenuLabel><DropdownMenuSeparator className="bg-white/[0.07]" />{notificationInbox.isLoading ? <div className="px-3 py-6 text-center text-xs text-white/40">Loading notifications…</div> : notificationInbox.data?.items.length ? <><div className="max-h-[min(60vh,28rem)] overflow-y-auto">{notificationInbox.data.items.map((notification) => <DropdownMenuItem key={notification.id} onSelect={() => openNotification(notification)} className={`mb-1 flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 focus:bg-white/[0.08] ${notification.isRead ? 'text-white/55' : 'bg-primary/[0.07] text-white'}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.isRead ? 'bg-white/20' : 'bg-primary'}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{notification.title}</span>{notification.message && <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-white/45">{notification.message}</span>}<span className="mt-1.5 block text-[10px] text-white/30">{new Date(notification.createdAt).toLocaleString()}</span></span></DropdownMenuItem>)}</div><div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-3 py-2.5"><span className="text-[10px] font-semibold text-white/40">{notificationInbox.data.total ? `${notificationInbox.data.offset + 1}–${Math.min(notificationInbox.data.offset + notificationInbox.data.items.length, notificationInbox.data.total)} of ${notificationInbox.data.total}` : 'No alerts'}</span><div className="flex gap-1"><Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[10px]" disabled={notificationInbox.data.offset === 0} onClick={() => setNotificationOffset(Math.max(0, notificationOffset - notificationInbox.data.limit))}>Newer</Button><Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[10px]" disabled={notificationInbox.data.offset + notificationInbox.data.items.length >= notificationInbox.data.total} onClick={() => setNotificationOffset(notificationOffset + notificationInbox.data.limit)}>Older</Button></div></div></> : <div className="px-4 py-8 text-center"><Bell className="mx-auto h-5 w-5 text-white/20" /><p className="mt-2 text-xs font-bold text-white/50">Your inbox is clear.</p><p className="mt-1 text-[11px] leading-relaxed text-white/35">Followed creator live alerts will appear here after a confirmed broadcast start.</p></div>}</DropdownMenuContent>
              </DropdownMenu>

              {/* Go Live shortcut */}
              <Link href="/dashboard/live">
                <Button
                  size="sm"
                  className="hidden sm:flex min-h-10 items-center gap-1.5 bg-destructive hover:bg-destructive/90 text-white font-semibold text-xs px-3 rounded-full"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Go Live
                </Button>
              </Link>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="Open account menu" className="h-10 w-10 rounded-full overflow-hidden border border-white/10 hover:border-primary/50 transition-colors shrink-0">
                    {user?.avatarUrl
                      ? <img src={user.avatarUrl} alt={user.username || ''} decoding="async" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">{user?.username?.[0]?.toUpperCase()}</div>
                    }
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52 bg-black/90 border-white/10 backdrop-blur-xl" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal pb-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-white truncate">{user?.username}</p>
                      {me?.role === 'owner' && <GoldenDBadge />}
                    </div>
                    <p className="text-xs text-white/40 truncate">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/[0.07]" />
                  <DropdownMenuItem asChild>
                    <Link href={`/u/${encodeURIComponent(user?.username || '')}`} className="flex items-center gap-2 cursor-pointer">
                      <Users className="w-4 h-4 text-primary" />
                      <span>Public Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/live" className="flex items-center gap-2 cursor-pointer">
                      <Radio className="w-4 h-4 text-destructive" />
                      <span>Go Live</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/watch" className="flex items-center gap-2 cursor-pointer">
                      <Video className="w-4 h-4 text-primary" />
                      <span>Upload Video</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="w-4 h-4 text-white/50" />
                      <span>Creator Studio</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/wallet" className="flex items-center gap-2 cursor-pointer">
                      <WalletCards className="w-4 h-4 text-primary" />
                      <span>Kryv Wallet</span>
                    </Link>
                  </DropdownMenuItem>
                  {me?.role === 'owner' && (
                    <>
                      <DropdownMenuSeparator className="bg-white/[0.07]" />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/admin" className="flex items-center gap-2 cursor-pointer text-primary">
                          <ShieldAlert className="w-4 h-4" />
                          <span>Owner Console</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator className="bg-white/[0.07]" />
                  <DropdownMenuItem
                    onClick={() => void handleLogout()}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <Link href="/sign-in" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="h-8 text-white/60 hover:text-white text-sm font-medium">
                  Log in
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs sm:text-sm px-3 sm:px-4 rounded-full">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
