import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import NotFound from "@/pages/not-found";

// Live
import LiveHome from "@/pages/live/Home";
import ChannelDetail from "@/pages/live/Channel";
import CategoryDetail from "@/pages/live/Category";

// Watch
import WatchHome from "@/pages/watch/Home";
import WatchDetail from "@/pages/watch/Detail";

// Cinema
import CinemaHome from "@/pages/cinema/Home";
import CinemaDetail from "@/pages/cinema/Detail";

// Dashboard
import DashboardLive from "@/pages/dashboard/Live";
import DashboardWatch from "@/pages/dashboard/Watch";
import DashboardAdmin from "@/pages/dashboard/Admin";

// Legal
import Privacy from "@/pages/legal/Privacy";
import Terms from "@/pages/legal/Terms";

// Clerk
import { ClerkProvider, SignIn, SignUp } from "@clerk/react";
import { dark } from "@clerk/themes";
import { setBaseUrl } from "@workspace/api-client-react";

// Configure API base URL if provided, otherwise use relative paths
if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}

function Router() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        <Switch>
          {/* Main Navigation */}
          <Route path="/" component={LiveHome} />
          <Route path="/live" component={LiveHome} />
          <Route path="/live/categories/:slug" component={CategoryDetail} />
          <Route path="/live/:id" component={ChannelDetail} />
          
          <Route path="/watch" component={WatchHome} />
          <Route path="/watch/:id" component={WatchDetail} />
          
          <Route path="/cinema" component={CinemaHome} />
          <Route path="/cinema/:id" component={CinemaDetail} />
          
          {/* Dashboard / Creator routes */}
          <Route path="/dashboard/live" component={DashboardLive} />
          <Route path="/dashboard/watch" component={DashboardWatch} />
          <Route path="/dashboard/admin" component={DashboardAdmin} />
          
          {/* Auth routes */}
          <Route path="/sign-in">
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
              <SignIn routing="path" path="/sign-in" />
            </div>
          </Route>
          <Route path="/sign-up">
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
              <SignUp routing="path" path="/sign-up" />
            </div>
          </Route>

          {/* Legal */}
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/legal/privacy" component={Privacy} />
          <Route path="/legal/terms" component={Terms} />

          {/* Fallback */}
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ClerkProvider 
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      appearance={{ 
        baseTheme: dark,
        variables: { colorPrimary: 'hsl(188, 91%, 43%)' }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Router />
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
