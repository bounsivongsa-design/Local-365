import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_CONSENT_KEY = "ll365_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "dismissed");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-500"
      data-testid="cookie-consent-banner"
    >
      <div className="bg-[#1a1a2e]/95 backdrop-blur-lg border-t border-white/10 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#d4a373]/20 flex items-center justify-center shrink-0 mt-0.5">
                <Cookie className="h-5 w-5 text-[#d4a373]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium mb-1">We use cookies</p>
                <p className="text-white/60 text-xs sm:text-sm leading-relaxed">
                  This site uses cookies to keep you signed in and improve your experience. By continuing to use Local List 365, you agree to our{" "}
                  <Link
                    to="/legal?section=privacy"
                    className="text-[#d4a373] hover:text-[#e0b48a] underline underline-offset-2 transition-colors"
                    data-testid="link-cookie-privacy"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <Button
                onClick={accept}
                className="flex-1 sm:flex-none bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl px-5 py-2 text-sm font-semibold shadow-lg"
                data-testid="button-accept-cookies"
              >
                Accept
              </Button>
              <button
                onClick={dismiss}
                className="p-2 text-white/40 hover:text-white/70 transition-colors rounded-lg hover:bg-white/5"
                aria-label="Dismiss"
                data-testid="button-dismiss-cookies"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
