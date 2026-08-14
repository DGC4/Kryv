import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { ThemeProvider } from "./lib/themeProvider";
import { setBaseUrl } from "@workspace/api-client-react";
import { useAuthStore } from "./lib/auth-store";
import "./styles/theme.css";

// Configure API base URL if provided, otherwise use relative paths
if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}

// Route modules are intentionally split so public entry pages do not preload
// every owner dashboard, player, and catalog management surface.
const NotFound = lazy(() => import('@/pages/not-found'));
const LiveHome = lazy(() => import('@/pages/live/Home'));
const LiveCategory = lazy(() => import('@/pages/live/Category'));
const LiveCategories = lazy(() => import('@/pages/live/Categories'));
const LiveChannel = lazy(() => import('@/pages/live/Channel'));
const CreatorProfile = lazy(() => import('@/pages/profile/CreatorProfile'));
const CreatorDirectory = lazy(() => import('@/pages/creators/Directory'));
const WatchHome = lazy(() => import('@/pages/watch/Home'));
const WatchDetail = lazy(() => import('@/pages/watch/Detail'));
const ClipsHome = lazy(() => import('@/pages/clips/Home'));
const ClipDetail = lazy(() => import('@/pages/clips/Detail'));
const SearchPage = lazy(() => import('@/pages/search/Search'));
const CinemaHome = lazy(() => import('@/pages/cinema/Home'));
const CinemaDetail = lazy(() => import('@/pages/cinema/Detail'));
const DashboardStudio = lazy(() => import('@/pages/dashboard/Studio'));
const DashboardLive = lazy(() => import('@/pages/dashboard/Live'));
const DashboardWatch = lazy(() => import('@/pages/dashboard/Watch'));
const DashboardAdmin = lazy(() => import('@/pages/dashboard/Admin'));
const CustomerWallet = lazy(() => import('@/pages/wallet/Wallet'));
const Privacy = lazy(() => import('@/pages/legal/Privacy'));
const Terms = lazy(() => import('@/pages/legal/Terms'));
const CreatorEconomics = lazy(() => import('@/pages/legal/CreatorEconomics'));
const Safety = lazy(() => import('@/pages/legal/Safety'));
const SignInPage = lazy(() => import('@/pages/auth/SignIn'));
const SignUpPage = lazy(() => import('@/pages/auth/SignUp'));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRedirect() {
  const [location] = useLocation();
  if (location === '/') return <Redirect to="/live" />;
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

class RouteLoadBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div className="flex min-h-screen items-center justify-center bg-[#080808] px-4 text-center text-white"><div className="max-w-md rounded-2xl border border-red-300/20 bg-red-400/[0.05] p-6"><h1 className="text-lg font-black text-white">Kryv needs a quick refresh</h1><p className="mt-2 text-sm leading-relaxed text-white/55">A page update could not finish loading. Your account and active payment state were not changed.</p><button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground">Refresh Kryv</button></div></div>;
    }
    return this.props.children;
  }
}

function AppRoutes() {
  return (
    <RouteLoadBoundary><Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#080808] text-white"><div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-sm font-bold text-white/65"><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Loading Kryv…</div></div>}>
    <Switch>
      <Route path="/" component={HomeRedirect} />
      
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />

      <Route path="/live">
        <Layout><LiveHome /></Layout>
      </Route>
      <Route path="/live/categories">
        <Layout><LiveCategories /></Layout>
      </Route>
      <Route path="/live/categories/:slug">
        <Layout><LiveCategory /></Layout>
      </Route>
      <Route path="/live/:channelSlugOrId">
        <Layout><LiveChannel /></Layout>
      </Route>
      <Route path="/profile/:slug">
        <Layout><CreatorProfile /></Layout>
      </Route>
      <Route path="/creators">
        <Layout><CreatorDirectory /></Layout>
      </Route>

      <Route path="/watch">
        <Layout><WatchHome /></Layout>
      </Route>
      <Route path="/watch/:id">
        <Layout><WatchDetail /></Layout>
      </Route>

      <Route path="/clips">
        <Layout><ClipsHome /></Layout>
      </Route>
      <Route path="/clips/:id">
        <Layout><ClipDetail /></Layout>
      </Route>
      <Route path="/search">
        <Layout><SearchPage /></Layout>
      </Route>

      <Route path="/cinema">
        <Layout><CinemaHome /></Layout>
      </Route>
      <Route path="/cinema/:id">
        <Layout><CinemaDetail /></Layout>
      </Route>

      <Route path="/wallet">
        <ProtectedRoute>
          <Layout><CustomerWallet /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <Layout><DashboardStudio /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/studio">
        <ProtectedRoute>
          <Redirect to="/dashboard" />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/live">
        <ProtectedRoute>
          <Layout><DashboardLive /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/watch">
        <ProtectedRoute>
          <Layout><DashboardWatch /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin">
        <ProtectedRoute>
          <Layout><DashboardAdmin /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/privacy">
        <Layout><Privacy /></Layout>
      </Route>
      <Route path="/terms">
        <Layout><Terms /></Layout>
      </Route>
      <Route path="/creator-economics">
        <Layout><CreatorEconomics /></Layout>
      </Route>
      <Route path="/safety">
        <Layout><Safety /></Layout>
      </Route>

      <Route>
        <Layout><NotFound /></Layout>
      </Route>
    </Switch>
    </Suspense></RouteLoadBoundary>
  );
}


function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location]);
  return null;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={basePath}>
          <ScrollToTop />
          <AppRoutes />
        </WouterRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
