import { Routes, Route, Link } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";

import Home from "@/pages/Home";
import Directory from "@/pages/Directory";
import BusinessDetails from "@/pages/BusinessDetails";
import Events from "@/pages/Events";
import LocationPage from "@/pages/LocationPage";
import NotFound from "@/pages/not-found";
import { Chatbot } from "@/components/Chatbot";
import backgroundImage from "@assets/8dfd34be-08ad-4d1d-87e2-46f52ec9bfc4_1770063157367.jpg";

function AppRouter() {
  return (
    <div className="flex min-h-screen flex-col font-sans antialiased relative">
      {/* Static Image Background */}
      <div 
        className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      {/* Dark overlay for readability */}
      <div className="fixed inset-0 bg-black/40 -z-10" />
      <Navigation />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/directory/:id" element={<BusinessDetails />} />
          <Route path="/events" element={<Events />} />
          <Route path="/location/:area" element={<LocationPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-white/20 bg-black/60 backdrop-blur-sm py-12 text-white/80">
        <div className="container grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-display text-xl font-bold text-white mb-4">Local 365</h3>
            <p className="max-w-xs">Connecting neighbors, supporting local businesses, and celebrating community life every single day.</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Discover</h4>
            <ul className="space-y-2">
              <li><Link to="/directory" className="hover:text-[#d4a373]">Local Businesses</Link></li>
              <li><Link to="/events" className="hover:text-[#d4a373]">Events Calendar</Link></li>
              <li><Link to="/" className="hover:text-[#d4a373]">Community Feed</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Community</h4>
            <ul className="space-y-2">
              <li><a href="/api/login" className="hover:text-[#d4a373]">Sign In</a></li>
              <li><a href="#" className="hover:text-[#d4a373]">Help Center</a></li>
              <li><a href="#" className="hover:text-[#d4a373]">Guidelines</a></li>
            </ul>
          </div>
        </div>
        <div className="container mt-12 pt-8 border-t border-white/20 text-sm text-center">
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
        <AppRouter />
        <Chatbot />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
