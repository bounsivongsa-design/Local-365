import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HelpHintProps {
  text: string;
  className?: string;
  testId?: string;
}

export function HelpHint({ text, className = "", testId }: HelpHintProps) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="What is this?"
          className={`inline-flex items-center justify-center text-current/60 hover:text-current transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a4a82] rounded-full ${className}`}
          data-testid={testId ?? "help-hint"}
          onClick={(e) => e.preventDefault()}
        >
          <HelpCircle className="h-4 w-4 opacity-70 hover:opacity-100" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-xs text-xs leading-relaxed bg-white text-[#1a1a2e] border border-gray-200 shadow-lg p-3"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
