import { useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  useGetActivityObservabilityPreferences,
  useReportActivityPresence,
} from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';

type RouteKey =
  | 'live_home'
  | 'live_categories'
  | 'live_category'
  | 'live_channel'
  | 'watch_home'
  | 'watch_detail'
  | 'clips_home'
  | 'clip_detail'
  | 'cinema_catalog'
  | 'cinema_detail'
  | 'creator_studio'
  | 'creator_wallet'
  | 'creator_achievements'
  | 'account_settings';

function routeKeyFor(pathname: string): RouteKey | null {
  if (pathname === '/live') return 'live_home';
  if (pathname === '/live/categories') return 'live_categories';
  if (pathname.startsWith('/live/categories/')) return 'live_category';
  if (pathname.startsWith('/live/')) return 'live_channel';
  if (pathname === '/watch') return 'watch_home';
  if (pathname.startsWith('/watch/')) return 'watch_detail';
  if (pathname === '/clips') return 'clips_home';
  if (pathname.startsWith('/clips/')) return 'clip_detail';
  if (pathname === '/cinema') return 'cinema_catalog';
  if (pathname.startsWith('/cinema/')) return 'cinema_detail';
  if (pathname === '/dashboard/live') return 'creator_studio';
  return null;
}

function deviceClass(): 'desktop' | 'tablet' | 'mobile' | 'other' {
  if (typeof window === 'undefined') return 'other';
  if (window.innerWidth < 640) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

export function ActivityPresenceTracker() {
  const user = useAuthStore(state => state.user);
  const [location] = useLocation();
  const { data: preference, refetch } = useGetActivityObservabilityPreferences({
    query: { enabled: Boolean(user), staleTime: 0, refetchOnWindowFocus: true },
  });
  const reportPresence = useReportActivityPresence();

  useEffect(() => {
    const refresh = () => { void refetch(); };
    window.addEventListener('kryv:activity-observability-change', refresh);
    return () => window.removeEventListener('kryv:activity-observability-change', refresh);
  }, [refetch]);

  useEffect(() => {
    const routeKey = routeKeyFor(location);
    if (!user || !preference?.enabled || !routeKey) return;

    const report = () => reportPresence.mutate({ data: { routeKey, deviceClass: deviceClass() } });
    report();
    const heartbeat = window.setInterval(report, 45_000);
    return () => window.clearInterval(heartbeat);
  }, [location, preference?.enabled, reportPresence, user]);

  return null;
}
