import { Link, useLocation as useRouterLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Calendar, Store, Home, Menu, LogOut, Gavel, Megaphone, Building2, Briefcase, Settings, LayoutDashboard, Shield, Bell, Mail, Share2, HelpCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LocationPicker } from "./LocationPicker";
import logoImage from "@assets/logo_no_bg.png";

export function Navigation() {
  const routerLocation = useRouterLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const { data: messageCounts } = useQuery<{ count: number } | null>({
    queryKey: ["/api/user/message-counts"],
    enabled: !!user,
    refetchInterval: !!user ? 30000 : false,
    queryFn: async () => {
      const res = await fetch("/api/user/message-counts", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
  });

  const unreadCount = messageCounts?.count || 0;

  const isAdminAccount = user?.accountType === "admin";
  const isBusinessOwner = user?.accountType === "business" && !!user?.linkedBusinessId;

  const { data: adminPending } = useQuery<{ total: number; pendingAds: number; pendingEvents: number; pendingCategories: number } | null>({
    queryKey: ["/api/admin/pending-counts"],
    enabled: isAdminAccount,
    refetchInterval: isAdminAccount ? 30000 : false,
    queryFn: async () => {
      const res = await fetch("/api/admin/pending-counts", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const adminPendingTotal = adminPending?.total || 0;

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/directory", label: "Directory", icon: Store },
    { href: "/quotes", label: "Get Quotes", icon: Gavel },
    { href: "/events", label: "Local Events", icon: Calendar },
    { href: "/jobs", label: "Help Wanted", icon: Briefcase },
    { href: "/membership", label: "For Business", icon: Building2 },
    { href: "/help", label: "Help", icon: HelpCircle },
  ];

  const isBusinessAccount = user?.accountType === "business";

  const authenticatedNavItems = [
    ...navItems,
    ...(isBusinessAccount ? [{ href: "/advertising", label: "Advertising", icon: Megaphone }] : []),
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(isAdminAccount ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  const isActive = (path: string) => routerLocation.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#0a4a82]/10 bg-gradient-to-r from-[#0a4a82] via-[#0a4a82]/95 to-[#0a4a82] shadow-lg shadow-[#0a4a82]/10">
      <div className="flex h-36 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center hover:opacity-90 transition-opacity">
            <img 
              src={logoImage}
              alt="Local List 365"
              className="h-20 w-20 object-contain drop-shadow-lg"
              data-testid="img-logo"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {(isAuthenticated ? authenticatedNavItems : navItems).map((item) => (
              <Link key={item.href} to={item.href}>
                <span className={`
                  relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-[background-color,color] duration-200
                  ${isActive(item.href) 
                    ? "bg-white/25 text-white font-semibold" 
                    : "text-white/90 hover:text-white hover:bg-white/10"}
                `}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.href === "/admin" && adminPendingTotal > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-[#0a4a82] animate-pulse" data-testid="badge-admin-pending">
                      {adminPendingTotal > 99 ? "99+" : adminPendingTotal}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <LocationPicker />
          
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-offset-background transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2" data-testid="button-settings-menu">
                  <div className="h-10 w-10 rounded-full border-2 border-white/30 bg-white/20 flex items-center justify-center">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-[#0a4a82] animate-pulse" data-testid="badge-unread-messages">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user?.firstName && <p className="font-medium">{user.firstName} {user.lastName}</p>}
                    {user?.email && <p className="w-[200px] truncate text-sm text-muted-foreground">{user.email}</p>}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <Link to="/dashboard">
                  <DropdownMenuItem className="cursor-pointer rounded-lg" data-testid="menu-dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer rounded-lg">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex gap-3">
              <Link to="/auth">
                <Button variant="outline" className="rounded-full border-white/30 text-white hover:bg-white/10 hover:border-white/50">
                  Sign In
                </Button>
              </Link>
              <Link to="/auth?mode=register">
                <Button className="rounded-full bg-[#d4a373] text-white hover:bg-[#c49363] shadow-lg shadow-black/20">
                  Join Community
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-white/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col gap-4 mt-8">
                {(isAuthenticated ? authenticatedNavItems : navItems).map((item) => (
                  <Link key={item.href} to={item.href} onClick={() => setIsOpen(false)}>
                    <span className={`
                      relative flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-medium transition-[background-color,color] duration-200
                      ${isActive(item.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"}
                    `}>
                      <item.icon className="h-5 w-5" />
                      {item.label}
                      {item.href === "/admin" && adminPendingTotal > 0 && (
                        <span className="ml-auto h-6 min-w-6 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                          {adminPendingTotal > 99 ? "99+" : adminPendingTotal}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
                {!isAuthenticated && (
                  <div className="flex flex-col gap-3 mt-4 pt-4 border-t">
                    <Link to="/auth" onClick={() => setIsOpen(false)} className="w-full">
                      <Button className="w-full rounded-full" size="lg">Sign In</Button>
                    </Link>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
