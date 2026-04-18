import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FoundingMemberBadgeProps {
  number: number | null | undefined;
  variant?: "default" | "compact";
  className?: string;
}

export function FoundingMemberBadge({ number, variant = "default", className }: FoundingMemberBadgeProps) {
  if (!number) return null;

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-semibold text-amber-900",
          className
        )}
        title={`Founding Member #${number} — one of the first 100 businesses on LocalList365`}
        data-testid={`badge-founding-member-${number}`}
      >
        <Crown className="h-3 w-3" />
        Founding #{number}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-400 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-sm",
        className
      )}
      title={`Founding Member #${number} — one of the first 100 businesses on LocalList365`}
      data-testid={`badge-founding-member-${number}`}
    >
      <Crown className="h-4 w-4 text-amber-700" />
      <span>Founding Member #{number}</span>
    </div>
  );
}
