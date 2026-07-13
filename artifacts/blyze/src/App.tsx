import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { dark } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Layout } from "./components/Layout";

// Pages
import NotFound from '@/pages/not-found';
import LiveHome from '@/pages/live/Home';
import LiveCategory from '@/pages/live/Category';
import LiveChannel from '@/pages/live/Channel';
import WatchHome from '@/pages/watch/Home';
import WatchDetail from '@/pages/watch/Detail';
import CinemaHome from '@/pages/cinema/Home';
import CinemaDetail from '@/pages/cinema/Detail';
import DashboardLive from '@/pages/dashboard/Live';
import DashboardWatch from '@/pages/dashboard/Watch';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(180, 100%, 50%)",
    colorForeground: "hsl(0, 0%, 98%)",
    colorMutedForeground: "hsl(240, 5%, 65%)",
    colorDanger: "hsl(0, 84%, 60%)",
    colorBackground: "hsl(240, 10%, 6%)",
    colorInput: "hsl(240, 10%, 12%)",
    colorInputForeground: "hsl(0, 0%, 98%)",
    colorNeutral: "hsl(240, 10%, 12%)",
    fontFamily: "Space Grotesk, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0f0f12] border border-white/10 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold font-display text-white",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-white/80 font-medium",
    footerActionLink: "text-primary hover:text-primary/80 font-medium transition-colors",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground bg-[#0f0f12] px-2",
    identityPreviewEditButton: "text-primary hover:text-primary/80",
    formFieldSuccessText: "text-green-400",
    alertText: "text-destructive-foreground",
    logoBox: "mb-6 flex justify-center",
    logoImage: "h-10",
    socialButtonsBlockButton: "border-white/10 hover:bg-white/5 transition-colors text-white",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 font-bold transition-colors",
    formFieldInput: "bg-black/20 border-white/10 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all",
    footerAction: "bg-black/20 py-4 border-t border-white/10",
    dividerLine: "bg-white/10",
    alert: "bg-destructive/10 border-destructive/20 text-destructive",
    otpCodeFieldInput: "bg-black/20 border-white/10 text-white focus:border-primary",
    formFieldRow: "mb-4",
    main: "px-8 py-8",
  },
};

function SignInPage() {
  return (
    <Layout>
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center py-12 px-4 relative z-10">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </Layout>
  );
}

function SignUpPage() {
  return (
    <Layout>
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center py-12 px-4 relative z-10">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </Layout>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function HomeRedirect() {
  const [location] = useLocation();
  if (location === '/') return <Redirect to="/live" />;
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          <Route path="/live">
            <Layout><LiveHome /></Layout>
          </Route>
          <Route path="/live/categories/:slug">
            <Layout><LiveCategory /></Layout>
          </Route>
          <Route path="/live/:channelSlugOrId">
            <Layout><LiveChannel /></Layout>
          </Route>

          <Route path="/watch">
            <Layout><WatchHome /></Layout>
          </Route>
          <Route path="/watch/:id">
            <Layout><WatchDetail /></Layout>
          </Route>

          <Route path="/cinema">
            <Layout><CinemaHome /></Layout>
          </Route>
          <Route path="/cinema/:id">
            <Layout><CinemaDetail /></Layout>
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

          <Route>
            <Layout><NotFound /></Layout>
          </Route>
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
