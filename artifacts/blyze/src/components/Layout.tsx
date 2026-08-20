import { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useGetPlatformFocusMode } from '@workspace/api-client-react';
import { Header } from './Header';
import { Footer } from './Footer';
import { AnimatedBackground } from './AnimatedBackground';
import { ActivityPresenceTracker } from './ActivityPresenceTracker';
import { FocusModeShell } from './focus/FocusModeShell';

interface LayoutProps {
  children: ReactNode;
}

function isFocusModeBypassRoute(location: string) {
  return [
    '/dashboard',
    '/wallet',
    '/sign-in',
    '/sign-up',
    '/privacy',
    '/terms',
    '/safety',
    '/creator-economics',
  ].some((path) => location === path || location.startsWith(`${path}/`));
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const focusModeQuery = useGetPlatformFocusMode({
    query: {
      // Focus configuration is revalidated by the server on the next navigation
      // or browser focus. A dedicated interval is intentionally avoided here.
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const focus = focusModeQuery.data;
  const showFocus = Boolean(
    focus?.isEnabled
      && focus.sourceId
      && (focus.sourceType === 'live' || focus.sourceType === 'cinema')
      && !isFocusModeBypassRoute(location),
  );

  return (
    <div className="min-h-[100dvh] flex flex-col relative text-foreground">
      <AnimatedBackground />
      <ActivityPresenceTracker />
      <a
        href="#kryv-main-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>
      <Header />
      <main
        id="kryv-main-content"
        tabIndex={-1}
        className="flex-1 min-h-0 relative z-10 flex flex-col focus:outline-none"
      >
        {showFocus ? <FocusModeShell sourceType={focus!.sourceType as 'live' | 'cinema'} sourceId={focus!.sourceId!} chatEnabled={focus!.chatEnabled} announcementText={focus!.announcementText} /> : children}
      </main>
      <Footer />
    </div>
  );
}
