import { Link, useLocation as useRouterLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Calendar, Store, Home, Menu, LogOut, Gavel, Sparkles, Megaphone, Building2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { LocationPicker } from "./LocationPicker";

export function Navigation() {
  const routerLocation = useRouterLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/directory", label: "Directory", icon: Store },
    { href: "/quotes", label: "Get Quotes", icon: Gavel },
    { href: "/events", label: "Local Events", icon: Calendar },
    { href: "/membership", label: "For Business", icon: Building2 },
    { href: "/loyalty", label: "Elite Status", icon: Sparkles },
  ];

  const isActive = (path: string) => routerLocation.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#0a4a82]/10 bg-gradient-to-r from-[#0a4a82] via-[#0a4a82]/95 to-[#0a4a82] shadow-lg shadow-[#0a4a82]/10">
      <div className="flex h-36 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center hover:opacity-90 transition-opacity">
            <video 
              src="/assets/logo-video.mp4" 
              autoPlay
              loop
              muted
              playsInline
              className="h-24 w-auto"
              data-testid="img-logo"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} to={item.href}>
                <span className={`
                  flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-[background-color,color] duration-200
                  ${isActive(item.href) 
                    ? "bg-white/20 text-white" 
                    : "text-white/80 hover:text-white hover:bg-white/10"}
                `}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
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
                <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-offset-background transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2">
                  <Avatar className="h-10 w-10 border-2 border-white/30">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                    <AvatarFallback className="bg-white/20 text-white">
                      {user?.firstName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
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
                <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer rounded-lg">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex gap-3">
              <a href="/api/login">
                <Button variant="outline" className="rounded-full border-white/30 text-white hover:bg-white/10 hover:border-white/50">
                  Sign In
                </Button>
              </a>
              <a href="/api/login">
                <Button className="rounded-full bg-[#d4a373] text-white hover:bg-[#c49363] shadow-lg shadow-black/20">
                  Join Community
                </Button>
              </a>
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
                {navItems.map((item) => (
                  <Link key={item.href} to={item.href} onClick={() => setIsOpen(false)}>
                    <span className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-medium transition-[background-color,color] duration-200
                      ${isActive(item.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"}
                    `}>
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </span>
                  </Link>
                ))}
                {!isAuthenticated && (
                  <div className="flex flex-col gap-3 mt-4 pt-4 border-t">
                    <a href="/api/login" className="w-full">
                      <Button className="w-full rounded-full" size="lg">Sign In</Button>
                    </a>
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
