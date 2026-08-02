import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import AnalyticsPage from "@/pages/AnalyticsPage";
import ChannelSettingsPage from "@/pages/ChannelSettingsPage";
import CreatorHomePage from "@/pages/CreatorHomePage";
import MonetizationPage from "@/pages/MonetizationPage";
import NotFound from "@/pages/NotFound";
import NotificationSettingsPage from "@/pages/NotificationSettingsPage";
import StreamSetupPage from "@/pages/StreamSetupPage";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Route, Switch } from "wouter";

function CreatorShell({ children }: { children: React.ReactNode }) { return <DashboardLayout>{children}</DashboardLayout>; }
const HomeRoute = () => <CreatorShell><CreatorHomePage /></CreatorShell>;
const StreamRoute = () => <CreatorShell><StreamSetupPage /></CreatorShell>;
const AnalyticsRoute = () => <CreatorShell><AnalyticsPage /></CreatorShell>;
const MonetizationRoute = () => <CreatorShell><MonetizationPage /></CreatorShell>;
const ChannelRoute = () => <CreatorShell><ChannelSettingsPage /></CreatorShell>;
const NotificationsRoute = () => <CreatorShell><NotificationSettingsPage /></CreatorShell>;

function Router() {
  return <Switch>
    <Route path="/" component={HomeRoute} />
    <Route path="/stream" component={StreamRoute} />
    <Route path="/analytics" component={AnalyticsRoute} />
    <Route path="/monetization" component={MonetizationRoute} />
    <Route path="/channel" component={ChannelRoute} />
    <Route path="/notifications" component={NotificationsRoute} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
