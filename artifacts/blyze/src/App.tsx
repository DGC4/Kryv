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

// Pages
import NotFound from '@/pages/not-found';
import LiveHome from '@/pages/live/Home';
import LiveCategory from '@/pages/live/Category';
import LiveCategories from '@/pages/live/Categories';
import LiveChannel from '@/pages/live/Channel';
import CreatorProfile from '@/pages/profile/CreatorProfile';
import WatchHome from '@/pages/watch/Home';
import WatchDetail from '@/pages/watch/Detail';
import ClipsHome from '@/pages/clips/Home';
import ClipDetail from '@/pages/clips/Detail';
import SearchPage from '@/pages/search/Search';
import CinemaHome from '@/pages/cinema/Home';
import CinemaDetail from '@/pages/cinema/Detail';
import DashboardLive from '@/pages/dashboard/Live';
import DashboardWatch from '@/pages/dashboard/Watch';
import DashboardAdmin from '@/pages/dashboard/Admin';
import CustomerWallet from '@/pages/wallet/Wallet';
import Privacy from '@/pages/legal/Privacy';
import Terms from '@/pages/legal/Terms';
import CreatorEconomics from '@/pages/legal/CreatorEconomics';
import Safety from '@/pages/legal/Safety';
import SignInPage from '@/pages/auth/SignIn';
import SignUpPage from '@/pages/auth/SignUp';

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

function AppRoutes() {
  return (
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
        <ProtectedRoute>
          <Layout><CinemaHome /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/cinema/:id">
        <ProtectedRoute>
          <Layout><CinemaDetail /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/wallet">
        <ProtectedRoute>
          <Layout><CustomerWallet /></Layout>
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
  );
}

import { useEffect } from 'react';

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
