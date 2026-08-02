import { useLocation, Link } from 'wouter';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { useGetMe } from '@workspace/api-client-react';
import { useThemeStore } from '../store/theme';
import { Radio, PlaySquare, Tv, Search, Palette, LogOut, ShieldAlert, Video, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const NAV = [
  { label: 'Live',   path: '/live',   icon: Radio,       match: ['/', '/live'] },
  { label: 'Watch',  path: '/watch',  icon: PlaySquare,  match: ['/watch'] },
  { label: 'Cinema', path: '/cinema', icon: Tv,          match: ['/cinema'] },
];

export function Header() {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: me } = useGetMe({ query: { enabled: !!isSignedIn } });
  const cycleTheme = useThemeStore((s) => s.cycleTheme);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
      <div className="mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-4 max-w-[1600px]">

        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_16px_hsl(var(--primary)/0.5)] group-hover:shadow-[0_0_24px_hsl(var(--primary)/0.7)] transition-shadow">
              <span className="font-black text-primary-foreground text-sm tracking-tight">K</span>
            </div>
            <span className="font-black text-lg tracking-tight text-white hidden sm:block kryv-logo">
              KRYV
            </span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {NAV.map(item => {
              const active = item.match.some(m => location === m || location.startsWith(`${m}/`));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-semibold transition-colors ${
                    active
                      ? 'text-primary'
                      : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="hidden md:block">{item.label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full shadow-[0_0_6px_hsl(var(--primary))]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Search + Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search..."
              className="h-8 bg-white/[0.06] border border-white/[0.08] rounded-full pl-8 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 focus:bg-white/[0.09] transition-all w-44 lg:w-56"
            />
          </div>

          {/* Theme cycle */}
          <Button
            variant="ghost" size="icon"
            onClick={cycleTheme}
            className="h-8 w-8 text-white/40 hover:text-primary hover:bg-white/[0.06] rounded-full"
            title="Cycle theme"
          >
            <Palette className="w-4 h-4" />
          </Button>

          {isSignedIn ? (
            <>
              {/* Go Live shortcut */}
              <Link href="/dashboard/live">
                <Button
                  size="sm"
                  className="hidden sm:flex h-8 items-center gap-1.5 bg-destructive hover:bg-destructive/90 text-white font-bold text-xs px-3 rounded-full shadow-[0_0_12px_hsl(0_84%_60%/0.4)]"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Go Live
                </Button>
              </Link>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-full overflow-hidden border border-white/10 hover:border-primary/50 transition-colors shrink-0">
                    {user?.imageUrl
                      ? <img src={user.imageUrl} alt={user.username || ''} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">{user?.username?.[0]?.toUpperCase()}</div>
                    }
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52 bg-black/90 border-white/10 backdrop-blur-xl" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal pb-2">
                    <p className="text-sm font-bold text-white truncate">{user?.username}</p>
                    <p className="text-xs text-white/40 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/[0.07]" />
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
                    <Link href="/dashboard/watch" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="w-4 h-4 text-white/50" />
                      <span>Creator Dashboard</span>
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
                    onClick={() => signOut()}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" className="h-8 text-white/60 hover:text-white text-sm font-medium">
                  Log in
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm px-4 rounded-full shadow-[0_0_12px_hsl(var(--primary)/0.35)]">
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
