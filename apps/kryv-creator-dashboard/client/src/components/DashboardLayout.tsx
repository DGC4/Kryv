import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Bell, ChartNoAxesCombined, CircleDollarSign, LayoutDashboard, LogOut, Radio, Settings2, UserRound } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CreatorBadge, KryvLogo } from "./KryvBrand";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuGroups = [
  { label: "Creator studio", items: [
    { icon: LayoutDashboard, label: "Overview", path: "/" },
    { icon: Radio, label: "Stream setup", path: "/stream" },
    { icon: ChartNoAxesCombined, label: "Analytics", path: "/analytics" },
    { icon: CircleDollarSign, label: "Monetization", path: "/monetization" },
  ] },
  { label: "Channel", items: [
    { icon: UserRound, label: "Profile & channel", path: "/channel" },
    { icon: Bell, label: "Notifications", path: "/notifications" },
    { icon: Settings2, label: "Studio settings", path: "/stream" },
  ] },
];

const SIDEBAR_WIDTH_KEY = "kryv-sidebar-width";
const DEFAULT_WIDTH = 272;
const MIN_WIDTH = 220;
const MAX_WIDTH = 340;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const value = saved ? Number.parseInt(saved, 10) : DEFAULT_WIDTH;
    return Number.isFinite(value) ? Math.min(Math.max(value, MIN_WIDTH), MAX_WIDTH) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)); }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <main className="kryv-shell flex min-h-screen items-center justify-center px-5">
        <section className="kryv-content kryv-card w-full max-w-md rounded-3xl p-8 text-center">
          <div className="mx-auto mb-7 w-fit"><KryvLogo /></div>
          <p className="kryv-label mb-3">Creator studio</p>
          <h1 className="kryv-title text-3xl font-bold text-white">Your channel starts here.</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">Sign in with your Manus account to access your private Kryv creator dashboard.</p>
          <Button onClick={startLogin} className="kryv-action mt-7 h-11 w-full rounded-xl bg-violet-400 font-extrabold text-[#11101a] hover:bg-violet-300">Sign in to creator studio</Button>
        </section>
      </main>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeItem = menuGroups.flatMap((group) => group.items).find((item) => item.path === location) ?? menuGroups[0].items[0];
  const initials = (user?.name || user?.email || "K").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = event.clientX - left;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const stop = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", stop);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <div className="kryv-shell flex min-h-screen w-full">
      <div className="kryv-content relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-white/[0.07] bg-[#0c0c15]/88 backdrop-blur-xl" disableTransition={isResizing}>
          <SidebarHeader className="h-[76px] border-b border-white/[0.06] px-4 py-0">
            <div className="flex h-full items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
              <KryvLogo compact={isCollapsed} />
              {!isCollapsed && <span className="rounded-full border border-violet-300/15 bg-violet-300/10 px-2 py-1 text-[9px] font-extrabold tracking-[0.1em] text-violet-200">BETA</span>}
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 py-5">
            {menuGroups.map((group) => (
              <div className="mb-6 last:mb-0" key={group.label}>
                <p className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/30 group-data-[collapsible=icon]:hidden">{group.label}</p>
                <SidebarMenu className="gap-1">
                  {group.items.map((item) => {
                    const active = item.path === location || (item.label === "Studio settings" && location === "/stream");
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton isActive={active} tooltip={item.label} onClick={() => setLocation(item.path)} className="kryv-action h-11 rounded-xl px-3 text-sm font-semibold text-white/55 hover:bg-white/[0.06] hover:text-white data-[active=true]:bg-violet-400/12 data-[active=true]:text-violet-100 data-[active=true]:shadow-[inset_0_0_0_1px_rgba(196,166,255,0.13)]">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>
          <SidebarFooter className="border-t border-white/[0.06] p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="kryv-focus flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-white/[0.05] group-data-[collapsible=icon]:justify-center" aria-label="Open creator profile menu">
                  <Avatar className="h-9 w-9 border border-white/10 bg-violet-300/10">
                    <AvatarImage src={undefined} alt="" />
                    <AvatarFallback className="bg-transparent text-xs font-extrabold text-violet-100">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-1.5"><p className="truncate text-sm font-bold text-white">{user?.name || "Kryv Creator"}</p>{user?.role === "admin" && <CreatorBadge kind="owner" />}</div>
                    <p className="truncate text-[11px] text-white/40">Creator account</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-60 border-white/10 bg-[#171722] text-white">
                <DropdownMenuLabel className="font-normal"><p className="font-bold">{user?.name || "Kryv Creator"}</p><p className="mt-1 truncate text-xs text-white/45">{user?.email || "Private creator account"}</p></DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => setLocation("/channel")} className="cursor-pointer focus:bg-white/10 focus:text-white"><UserRound className="mr-2 h-4 w-4" />Profile & channel</DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-rose-300 focus:bg-rose-400/10 focus:text-rose-200"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        {!isCollapsed && <button className="absolute right-[-3px] top-0 z-50 hidden h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-violet-300/30 md:block" onMouseDown={() => setIsResizing(true)} aria-label="Resize sidebar" />}
      </div>
      <SidebarInset className="kryv-content bg-transparent">
        {isMobile && <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/[0.07] bg-[#0b0c14]/90 px-4 backdrop-blur-xl"><SidebarTrigger className="kryv-focus h-9 w-9 rounded-lg border border-white/10 bg-white/[0.04] text-white" /><KryvLogo compact /><span className="ml-auto text-xs font-bold text-white/45">{activeItem.label}</span></header>}
        <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-7 lg:px-9 lg:py-8">{children}</main>
      </SidebarInset>
    </div>
  );
}
