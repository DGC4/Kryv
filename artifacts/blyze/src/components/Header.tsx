import { useLocation } from 'wouter';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { Link } from 'wouter';
import { useThemeStore } from '../store/theme';
import { Palette, Tv, PlaySquare, Radio, Search, Plus, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function Header() {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const cycleTheme = useThemeStore((s) => s.cycleTheme);

  const navItems = [
    { label: 'Live', path: '/live', icon: Radio, match: ['/', '/live'] },
    { label: 'Watch', path: '/watch', icon: PlaySquare, match: ['/watch'] },
    { label: 'Cinema', path: '/cinema', icon: Tv, match: ['/cinema'] },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded transform group-hover:rotate-12 transition-transform duration-300 flex items-center justify-center">
              <span className="font-bold text-primary-foreground font-display">K</span>
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-white hidden sm:block">
              KRYV
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const isActive = item.match.some((m) => location === m || location.startsWith(`${m}/`));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden md:block">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={cycleTheme} className="text-muted-foreground hover:text-primary">
            <Palette className="w-5 h-5" />
            <span className="sr-only">Cycle Theme</span>
          </Button>

          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-black/20 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all w-48 lg:w-64 text-white"
            />
          </div>

          {isSignedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <img 
                    src={user?.imageUrl} 
                    alt={user?.username || 'Avatar'} 
                    className="rounded-full object-cover border border-white/10"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-white">{user?.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/live" className="flex items-center w-full cursor-pointer">
                    <Radio className="mr-2 h-4 w-4" />
                    <span>Go Live</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/watch" className="flex items-center w-full cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Upload Video</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors hidden sm:block">
                Log in
              </Link>
              <Link href="/sign-up">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
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
