import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";

import Home from "@/pages/Home";
import Directory from "@/pages/Directory";
import BusinessDetails from "@/pages/BusinessDetails";
import Events from "@/pages/Events";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="flex min-h-screen flex-col font-sans antialiased">
      <Navigation />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/directory" component={Directory} />
          <Route path="/directory/:id" component={BusinessDetails} />
          <Route path="/events" component={Events} />
          <Route component={NotFound} />
        </Switch>
      </main>
      
      {/* Footer */}
      <footer className="border-t bg-white py-12 text-muted-foreground">
        <div className="container grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-display text-xl font-bold text-foreground mb-4">Local 365</h3>
            <p className="max-w-xs">Connecting neighbors, supporting local businesses, and celebrating community life every single day.</p>
          </div>
          <div>
            <h4 className="font-bold text-foreground mb-4">Discover</h4>
            <ul className="space-y-2">
              <li><a href="/directory" className="hover:text-primary">Local Businesses</a></li>
              <li><a href="/events" className="hover:text-primary">Events Calendar</a></li>
              <li><a href="/" className="hover:text-primary">Community Feed</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-foreground mb-4">Community</h4>
            <ul className="space-y-2">
              <li><a href="/api/login" className="hover:text-primary">Sign In</a></li>
              <li><a href="#" className="hover:text-primary">Help Center</a></li>
              <li><a href="#" className="hover:text-primary">Guidelines</a></li>
            </ul>
          </div>
        </div>
        <div className="container mt-12 pt-8 border-t text-sm text-center">
          &copy; {new Date().getFullYear()} Local 365. Built for the community.
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
