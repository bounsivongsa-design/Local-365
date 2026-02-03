import { Shield, ShieldCheck, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TrustBadgesProps {
  hasLLC: boolean | null;
  hasInsurance: boolean | null;
  variant?: "compact" | "full";
  className?: string;
}

export function TrustBadges({ hasLLC, hasInsurance, variant = "compact", className = "" }: TrustBadgesProps) {
  const isVerifiedBusiness = hasLLC && hasInsurance;
  const isPartiallyVerified = hasLLC || hasInsurance;
  
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {isVerifiedBusiness ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                className="bg-emerald-600 text-white border-0 shadow-sm cursor-help"
                data-testid="badge-verified-business"
              >
                <ShieldCheck className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold">Verified Business</p>
              <p className="text-xs text-muted-foreground">LLC registered & insured</p>
            </TooltipContent>
          </Tooltip>
        ) : isPartiallyVerified ? (
          <div className="flex items-center gap-1">
            {hasLLC && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    className="bg-blue-600 text-white border-0 shadow-sm cursor-help"
                    data-testid="badge-llc"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    LLC
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Registered Business (LLC/Corp)</p>
                </TooltipContent>
              </Tooltip>
            )}
            {hasInsurance && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    className="bg-teal-600 text-white border-0 shadow-sm cursor-help"
                    data-testid="badge-insured"
                  >
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Insured
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Liability Insurance Coverage</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline"
                className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 cursor-help"
                data-testid="badge-unverified"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Unverified
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold text-amber-600">Unverified Business</p>
              <p className="text-xs text-muted-foreground">No LLC or insurance on file</p>
              <p className="text-xs mt-1">Exercise caution when hiring</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        {isVerifiedBusiness ? (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-semibold">Verified Business</span>
          </div>
        ) : !isPartiallyVerified ? (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Unverified Business</span>
          </div>
        ) : null}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div 
          className={`p-3 rounded-lg border ${
            hasLLC 
              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" 
              : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
          }`}
          data-testid="credential-llc"
        >
          <div className="flex items-center gap-2 mb-1">
            <Shield className={`h-4 w-4 ${hasLLC ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`} />
            <span className={`text-sm font-medium ${hasLLC ? "text-blue-700 dark:text-blue-300" : "text-gray-500"}`}>
              LLC/Corporation
            </span>
          </div>
          <p className={`text-xs ${hasLLC ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>
            {hasLLC ? "Registered business entity" : "Not registered"}
          </p>
        </div>
        
        <div 
          className={`p-3 rounded-lg border ${
            hasInsurance 
              ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800" 
              : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
          }`}
          data-testid="credential-insurance"
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className={`h-4 w-4 ${hasInsurance ? "text-teal-600 dark:text-teal-400" : "text-gray-400"}`} />
            <span className={`text-sm font-medium ${hasInsurance ? "text-teal-700 dark:text-teal-300" : "text-gray-500"}`}>
              Insurance
            </span>
          </div>
          <p className={`text-xs ${hasInsurance ? "text-teal-600 dark:text-teal-400" : "text-gray-400"}`}>
            {hasInsurance ? "Liability coverage" : "No insurance on file"}
          </p>
        </div>
      </div>
      
      {!isVerifiedBusiness && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {!isPartiallyVerified ? "Unverified Business" : "Partially Verified"}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {!isPartiallyVerified 
                  ? "This business hasn't provided LLC registration or insurance documentation. Consider asking for proof before hiring."
                  : hasLLC 
                    ? "This business is registered but hasn't provided insurance documentation."
                    : "This business has insurance but isn't registered as an LLC/Corporation."
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
