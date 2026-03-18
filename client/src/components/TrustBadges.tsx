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
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline"
                className="bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 border-amber-400 dark:border-amber-700 cursor-help"
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
      
      <div className="grid grid-cols-2 gap-3">
        <div 
          className={`p-4 rounded-xl border-2 transition-colors ${
            hasLLC 
              ? "bg-gradient-to-br from-[#0a4a82]/5 to-[#0a4a82]/10 border-[#0a4a82]/20" 
              : "bg-gray-50 border-gray-200"
          }`}
          data-testid="credential-llc"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasLLC ? "bg-[#0a4a82]" : "bg-gray-300"}`}>
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className={`text-sm font-bold ${hasLLC ? "text-[#0a4a82]" : "text-gray-400"}`}>
              LLC/Corporation
            </span>
          </div>
          <p className={`text-xs ml-10 ${hasLLC ? "text-[#0a4a82]/70" : "text-gray-400"}`}>
            {hasLLC ? "Registered business entity" : "Not registered"}
          </p>
        </div>
        
        <div 
          className={`p-4 rounded-xl border-2 transition-colors ${
            hasInsurance 
              ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-teal-200" 
              : "bg-gray-50 border-gray-200"
          }`}
          data-testid="credential-insurance"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasInsurance ? "bg-teal-500" : "bg-gray-300"}`}>
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className={`text-sm font-bold ${hasInsurance ? "text-teal-700" : "text-gray-400"}`}>
              Insurance
            </span>
          </div>
          <p className={`text-xs ml-10 ${hasInsurance ? "text-teal-600" : "text-gray-400"}`}>
            {hasInsurance ? "Liability coverage" : "No insurance on file"}
          </p>
        </div>

        <div 
          className={`p-4 rounded-xl border-2 transition-colors ${
            isLicensed 
              ? "bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200" 
              : "bg-gray-50 border-gray-200"
          }`}
          data-testid="credential-licensed"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLicensed ? "bg-indigo-500" : "bg-gray-300"}`}>
              <FileCheck className="h-4 w-4 text-white" />
            </div>
            <span className={`text-sm font-bold ${isLicensed ? "text-indigo-700" : "text-gray-400"}`}>
              Licensed
            </span>
          </div>
          <p className={`text-xs ml-10 ${isLicensed ? "text-indigo-600" : "text-gray-400"}`}>
            {isLicensed ? "State licensed professional" : "No license on file"}
          </p>
        </div>
      </div>
      
      {!isVerifiedBusiness && (
        <div className={`p-4 rounded-xl border-2 ${isPartiallyVerified ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200" : "bg-gradient-to-r from-amber-50 to-red-50 border-amber-300"}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isPartiallyVerified ? "bg-amber-400" : "bg-amber-500"}`}>
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">
                {!isPartiallyVerified ? "Unverified Business" : "Partially Verified"}
              </p>
              <p className="text-xs text-amber-700/80 mt-1 leading-relaxed">
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
