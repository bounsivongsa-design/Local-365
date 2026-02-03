import { Badge } from "@/components/ui/badge";
import { Building2, Star, Crown } from "lucide-react";

interface MembershipBadgeProps {
  tier: string | null | undefined;
  variant?: "compact" | "full";
}

const TIER_CONFIG: Record<string, { 
  label: string; 
  icon: typeof Building2; 
  color: string; 
  bgColor: string;
}> = {
  basic: {
    label: "Member",
    icon: Building2,
    color: "#0a4a82",
    bgColor: "bg-[#0a4a82]/10"
  },
  standard: {
    label: "Standard Member",
    icon: Star,
    color: "#8a9a5b",
    bgColor: "bg-[#8a9a5b]/10"
  },
  premium: {
    label: "Premium Member",
    icon: Crown,
    color: "#d4a373",
    bgColor: "bg-[#d4a373]/10"
  }
};

export function MembershipBadge({ tier, variant = "compact" }: MembershipBadgeProps) {
  if (!tier || tier === "none") {
    return null;
  }

  const config = TIER_CONFIG[tier];
  if (!config) return null;

  const Icon = config.icon;

  if (variant === "compact") {
    return (
      <Badge 
        className={`${config.bgColor} border-0`}
        style={{ color: config.color }}
        data-testid={`badge-membership-${tier}`}
      >
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  }

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor}`}
      data-testid={`badge-membership-${tier}-full`}
    >
      <Icon className="h-5 w-5" style={{ color: config.color }} />
      <div>
        <p className="font-medium text-sm" style={{ color: config.color }}>{config.label}</p>
        <p className="text-xs text-muted-foreground">Local List 365 Member</p>
      </div>
    </div>
  );
}
