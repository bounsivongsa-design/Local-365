import { Badge } from "@/components/ui/badge";
import { Medal, Award, Crown } from "lucide-react";

interface MembershipBadgeProps {
  tier: string | null | undefined;
  variant?: "compact" | "full";
}

const TIER_CONFIG: Record<string, { 
  label: string; 
  icon: typeof Medal; 
  color: string; 
  bgColor: string;
  borderColor: string;
}> = {
  basic: {
    label: "Bronze Member",
    icon: Medal,
    color: "#cd7f32",
    bgColor: "bg-[#cd7f32]/10",
    borderColor: "border-[#cd7f32]/30",
  },
  bronze: {
    label: "Bronze Member",
    icon: Medal,
    color: "#cd7f32",
    bgColor: "bg-[#cd7f32]/10",
    borderColor: "border-[#cd7f32]/30",
  },
  standard: {
    label: "Silver Member",
    icon: Award,
    color: "#71717a",
    bgColor: "bg-[#c0c0c0]/15",
    borderColor: "border-[#c0c0c0]/40",
  },
  silver: {
    label: "Silver Member",
    icon: Award,
    color: "#71717a",
    bgColor: "bg-[#c0c0c0]/15",
    borderColor: "border-[#c0c0c0]/40",
  },
  premium: {
    label: "Gold Member",
    icon: Crown,
    color: "#d4a373",
    bgColor: "bg-[#d4a373]/10",
    borderColor: "border-[#d4a373]/30",
  },
  gold: {
    label: "Gold Member",
    icon: Crown,
    color: "#d4a373",
    bgColor: "bg-[#d4a373]/10",
    borderColor: "border-[#d4a373]/30",
  },
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
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor} border ${config.borderColor}`}
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
