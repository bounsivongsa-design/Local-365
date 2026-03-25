import { Shield, ShieldCheck, AlertTriangle, FileCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TrustBadgesProps {
  hasLLC: boolean | null;
  hasInsurance: boolean | null;
  isLicensed?: boolean | null;
  variant?: "compact" | "full";
  className?: string;
}

export function TrustBadges({ hasLLC, hasInsurance, isLicensed, variant = "compact", className = "" }: TrustBadgesProps) {
  const isVerifiedBusiness = hasLLC && hasInsurance;
  const isPartiallyVerified = hasLLC || hasInsurance || isLicensed;
  
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
        ) : null}
        {isLicensed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                className="bg-indigo-600 text-white border-0 shadow-sm cursor-help"
                data-testid="badge-licensed"
              >
                <FileCheck className="h-3 w-3 mr-1" />
                Licensed
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>State Licensed Professional</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {isVerifiedBusiness && (
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-emerald-700">Fully Verified Business</span>
        </div>
      )}
      
      {!hasLLC && !hasInsurance && !isLicensed ? (
        <div className="p-4 rounded-xl border-2 bg-gray-50 border-gray-200">
          <p className="text-sm text-gray-500 text-center">No credentials provided yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {hasLLC && (
            <div 
              className="p-4 rounded-xl border-2 transition-colors bg-gradient-to-br from-[#0a4a82]/5 to-[#0a4a82]/10 border-[#0a4a82]/20"
              data-testid="credential-llc"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#0a4a82]">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-bold text-[#0a4a82]">
                  LLC/Corporation
                </span>
              </div>
              <p className="text-xs ml-10 text-[#0a4a82]/70">
                Registered business entity
              </p>
            </div>
          )}
          
          {hasInsurance && (
            <div 
              className="p-4 rounded-xl border-2 transition-colors bg-gradient-to-br from-emerald-50 to-teal-50 border-teal-200"
              data-testid="credential-insurance"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-500">
                  <ShieldCheck className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-bold text-teal-700">
                  Insurance
                </span>
              </div>
              <p className="text-xs ml-10 text-teal-600">
                Liability coverage
              </p>
            </div>
          )}

          {isLicensed && (
            <div 
              className="p-4 rounded-xl border-2 transition-colors bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200"
              data-testid="credential-licensed"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500">
                  <FileCheck className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-bold text-indigo-700">
                  Licensed
                </span>
              </div>
              <p className="text-xs ml-10 text-indigo-600">
                State licensed professional
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
