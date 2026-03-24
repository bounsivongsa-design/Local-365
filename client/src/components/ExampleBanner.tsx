import { AlertTriangle } from "lucide-react";

interface ExampleBannerProps {
  variant?: "overlay" | "inline" | "ribbon";
}

export function ExampleBanner({ variant = "overlay" }: ExampleBannerProps) {
  if (variant === "ribbon") {
    return (
      <div className="absolute top-0 right-0 z-20 overflow-hidden w-28 h-28 pointer-events-none" data-testid="badge-example-ribbon">
        <div className="absolute top-[18px] right-[-34px] rotate-45 bg-orange-500 text-white text-[10px] font-extrabold tracking-widest py-1 px-10 shadow-lg uppercase text-center">
          Example
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-400/30 rounded-xl" data-testid="banner-example-inline">
        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
        <p className="text-xs font-semibold text-orange-700">
          This is an example listing — not a real business. It shows what your listing could look like!
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-1.5 px-3 text-xs font-bold tracking-wide uppercase shadow-md" data-testid="banner-example-overlay">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>Example Listing</span>
    </div>
  );
}

export function ExampleEventBanner() {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-1.5 px-3 text-xs font-bold tracking-wide uppercase shadow-md" data-testid="banner-example-event">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>Example Event</span>
    </div>
  );
}
