import { Link, useLocation } from "react-router-dom";
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
import { MapPin, Calendar, Store, Home, Menu, LogOut, User as UserIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export function Navigation() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/directory", label: "Directory", icon: Store },
    { href: "/events", label: "Local Events", icon: Calendar },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img 
              src="/assets/ChatGPT_Image_Jan_23,_2026,_01_16_31_PM_1770058614374.png" 
              alt="Local List 365" 
              className="h-12 w-auto"
              data-testid="img-logo"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} to={item.href}>
                <span className={`
                  flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                  ${isActive(item.href) 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}
                `}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-offset-background transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                    <AvatarFallback className="bg-primary/10 text-primary">
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
            <div className="hidden md:flex gap-2">
              <a href="/api/login">
                <Button variant="outline" className="rounded-full border-primary/20 text-primary hover:bg-primary/5">
                  Sign In
                </Button>
              </a>
              <a href="/api/login">
                <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
                  Join Community
                </Button>
              </a>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col gap-4 mt-8">
                {navItems.map((item) => (
                  <Link key={item.href} to={item.href} onClick={() => setIsOpen(false)}>
                    <span className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-medium transition-all
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
