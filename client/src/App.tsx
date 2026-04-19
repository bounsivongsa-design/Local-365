import { Routes, Route, Link } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";
import { FoundingUrgencyBanner } from "@/components/FoundingUrgencyBanner";
import { LocationProvider } from "@/context/LocationContext";

import Home from "@/pages/Home";
import Directory from "@/pages/Directory";
import BusinessDetails from "@/pages/BusinessDetails";
import Events from "@/pages/Events";
import LocationPage from "@/pages/LocationPage";

import Dashboard from "@/pages/Dashboard";
import AccountSetup from "@/pages/AccountSetup";
import QuoteRequests from "@/pages/QuoteRequests";
import Advertising from "@/pages/Advertising";
import AdminAds from "@/pages/AdminAds";
import AdminPromoCodes from "@/pages/AdminPromoCodes";
import AdminEvents from "@/pages/AdminEvents";
import AdminDashboard from "@/pages/AdminDashboard";
import AILab from "@/pages/AILab";
import BusinessMembership from "@/pages/BusinessMembership";
import AuthPage from "@/pages/AuthPage";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Legal from "@/pages/Legal";
import FAQ from "@/pages/FAQ";
import HelpWanted from "@/pages/HelpWanted";
import CreateBusiness from "@/pages/CreateBusiness";
import EditListing from "@/pages/EditListing";
import NewsletterPage from "@/pages/Newsletter";
import SocialPage from "@/pages/Social";
import NotFound from "@/pages/not-found";
import { DevModePanel } from "@/components/DevModePanel";
import { CookieConsent } from "@/components/CookieConsent";
import { useReferralCapture } from "@/hooks/use-referral-capture";
import backgroundImage from "@assets/image_1773172681995.png";

function AppRouter() {
  useReferralCapture();
  return (
    <div className="flex min-h-screen flex-col font-sans antialiased relative">
      {/* Static Image Background */}
      <div 
        className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      <FoundingUrgencyBanner />
      <Navigation />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/directory/:id" element={<BusinessDetails />} />
          <Route path="/events" element={<Events />} />
          <Route path="/location/:area" element={<LocationPage />} />
          
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/account-setup" element={<AccountSetup />} />
          <Route path="/quotes" element={<QuoteRequests />} />
          <Route path="/advertising" element={<Advertising />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/ads" element={<AdminAds />} />
          <Route path="/admin/promo-codes" element={<AdminPromoCodes />} />
          <Route path="/admin/events" element={<AdminEvents />} />
          <Route path="/admin/ai-lab" element={<AILab />} />
          <Route path="/membership" element={<BusinessMembership />} />
          <Route path="/jobs" element={<HelpWanted />} />
          <Route path="/create-business" element={<CreateBusiness />} />
          <Route path="/edit-listing" element={<EditListing />} />
          <Route path="/newsletter" element={<NewsletterPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      
      <footer className="border-t border-white/20 bg-black/70 backdrop-blur-md py-12 text-white/80">
        <div className="container grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-display text-xl font-bold text-white mb-4" data-testid="text-footer-brand">Local List 365</h3>
            <p className="max-w-xs text-sm leading-relaxed">Your trusted community directory for Moyock, NC. Connecting neighbors, supporting local businesses, and celebrating community life every single day.</p>
            <p className="mt-3 text-sm"><a href="mailto:support@locallist365.com" className="text-[#d4a373] hover:text-[#c49363] transition-colors" data-testid="link-footer-support-email">support@locallist365.com</a></p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Discover</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/directory" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-directory">Local Businesses</Link></li>
              <li><Link to="/events" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-events">Events Calendar</Link></li>
              <li><Link to="/jobs" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-jobs">Help Wanted</Link></li>
              <li><Link to="/quotes" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-quotes">Request Quotes</Link></li>
              <li><Link to="/membership" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-membership">Business Membership</Link></li>
              <li><Link to="/advertising" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-advertising">Advertising</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/dashboard" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-dashboard">My Dashboard</Link></li>
              <li><Link to="/auth" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-signin">Sign In</Link></li>
              <li><Link to="/legal?section=terms" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-terms">Terms of Service</Link></li>
              <li><Link to="/legal?section=privacy" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-privacy">Privacy Policy</Link></li>
              <li><Link to="/legal?section=disclaimers" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-disclaimers">Disclaimers</Link></li>
              <li><Link to="/faq" className="hover:text-[#d4a373] transition-colors" data-testid="link-footer-faq">FAQ</Link></li>
            </ul>
          </div>
        </div>
        <div className="container mt-10 pt-6 border-t border-white/15 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <p>&copy; {new Date().getFullYear()} Local List 365. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/legal?section=terms" className="hover:text-white/80 transition-colors" data-testid="link-footer-terms-bottom">Terms</Link>
            <span className="text-white/20">|</span>
            <Link to="/legal?section=privacy" className="hover:text-white/80 transition-colors" data-testid="link-footer-privacy-bottom">Privacy</Link>
            <span className="text-white/20">|</span>
            <Link to="/legal?section=disclaimers" className="hover:text-white/80 transition-colors" data-testid="link-footer-disclaimers-bottom">Disclaimers</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LocationProvider>
          <Toaster />
          <AppRouter />
          <CookieConsent />
          <DevModePanel />
        </LocationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
