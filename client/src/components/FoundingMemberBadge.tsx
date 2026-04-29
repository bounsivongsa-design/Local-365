import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FoundingMemberBadgeProps {
  number: number | null | undefined;
  variant?: "default" | "compact" | "medallion";
  className?: string;
}

/**
 * Premium "Founding Member" badge.
 *
 * Three variants:
 *  - "compact"   – inline pill badge for cards / list rows
 *  - "default"   – larger pill badge for profile headers
 *  - "medallion" – circular metal medallion for hero / dashboard placement
 *
 * The 3D look is built from layered effects rather than an image asset:
 *  - multi-stop gold gradient (true polished-gold ramp, not flat amber)
 *  - inset highlight at the top + inset shadow at the bottom (raised relief)
 *  - colored drop shadow to lift it off the page
 *  - engraved crown icon (drop-shadow gives it depth instead of looking flat)
 */
export function FoundingMemberBadge({ number, variant = "default", className }: FoundingMemberBadgeProps) {
  if (!number) return null;

  const tooltip = `Founding Member #${number} — one of the first 100 businesses on LocalList365`;

  // Polished-gold gradient used by every variant. Reads top-to-bottom:
  //   pale highlight → mid gold → deeper gold → mid gold (bottom reflection)
  // This is what makes it read as metal instead of "yellow plastic".
  const goldGradient =
    "linear-gradient(180deg, #FFF4C2 0%, #F5C842 18%, #B8860B 50%, #DAA520 78%, #8B6914 100%)";

  // Inset highlight (top) + inset shadow (bottom) gives the raised relief.
  // Outer shadow is gold-tinted so it lifts off both light and dark backgrounds
  // without the cheap "black halo" look.
  const reliefShadow = [
    "inset 0 1px 0 rgba(255, 248, 196, 0.95)",
    "inset 0 -1px 2px rgba(101, 67, 8, 0.55)",
    "0 1px 1px rgba(101, 67, 8, 0.25)",
    "0 4px 10px -2px rgba(184, 134, 11, 0.45)",
  ].join(", ");

  if (variant === "medallion") {
    return (
      <div
        className={cn("inline-flex flex-col items-center gap-1.5", className)}
        title={tooltip}
        data-testid={`badge-founding-member-${number}`}
      >
        <div
          className="relative h-20 w-20 rounded-full flex items-center justify-center"
          style={{
            background: goldGradient,
            boxShadow: [
              "inset 0 2px 1px rgba(255, 248, 196, 0.95)",
              "inset 0 -3px 4px rgba(101, 67, 8, 0.6)",
              "inset 0 0 0 1px rgba(184, 134, 11, 0.4)",
              "0 2px 2px rgba(101, 67, 8, 0.3)",
              "0 8px 20px -4px rgba(184, 134, 11, 0.55)",
            ].join(", "),
          }}
        >
          {/* Inner ring – mimics a struck-coin rim */}
          <div
            className="absolute inset-1.5 rounded-full pointer-events-none"
            style={{
              border: "1px solid rgba(101, 67, 8, 0.35)",
              boxShadow: "inset 0 1px 0 rgba(255, 248, 196, 0.7)",
            }}
          />
          <div className="relative flex flex-col items-center">
            <Crown
              className="h-5 w-5"
              style={{
                color: "#5C3D08",
                filter: "drop-shadow(0 1px 0 rgba(255,248,196,0.7)) drop-shadow(0 -1px 0 rgba(101,67,8,0.4))",
              }}
              strokeWidth={2.5}
            />
            <span
              className="text-base font-black leading-none mt-0.5"
              style={{
                color: "#5C3D08",
                textShadow: "0 1px 0 rgba(255,248,196,0.7), 0 -1px 0 rgba(101,67,8,0.3)",
                letterSpacing: "-0.02em",
              }}
            >
              #{number}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900/80">
          Founding Member
        </span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
          className,
        )}
        style={{
          background: goldGradient,
          color: "#5C3D08",
          textShadow: "0 1px 0 rgba(255,248,196,0.7)",
          boxShadow: reliefShadow,
        }}
        title={tooltip}
        data-testid={`badge-founding-member-${number}`}
      >
        <Crown
          className="h-3 w-3"
          style={{ filter: "drop-shadow(0 1px 0 rgba(255,248,196,0.6))" }}
          strokeWidth={2.5}
        />
        Founding #{number}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold",
        className,
      )}
      style={{
        background: goldGradient,
        color: "#4A3008",
        textShadow: "0 1px 0 rgba(255,248,196,0.75), 0 -1px 0 rgba(101,67,8,0.2)",
        boxShadow: reliefShadow,
        letterSpacing: "0.01em",
      }}
      title={tooltip}
      data-testid={`badge-founding-member-${number}`}
    >
      <Crown
        className="h-4 w-4"
        style={{
          color: "#5C3D08",
          filter: "drop-shadow(0 1px 0 rgba(255,248,196,0.7)) drop-shadow(0 -1px 0 rgba(101,67,8,0.4))",
        }}
        strokeWidth={2.5}
      />
      <span>Founding Member #{number}</span>
    </div>
  );
}
