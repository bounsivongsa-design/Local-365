import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { REGISTER_LABEL, REGISTER_PATH, LOGIN_LABEL } from "@/lib/auth-copy";

const primaryClass =
  "rounded-full bg-[#d4a373] text-white hover:bg-[#c49363] font-semibold shadow-lg shadow-black/20 min-h-11 px-5";

export function RegisterCta({
  className = "",
  size = "default",
  testId = "button-register",
  fullWidth = false,
}: {
  className?: string;
  size?: "default" | "sm" | "lg";
  testId?: string;
  fullWidth?: boolean;
}) {
  return (
    <Button asChild size={size} className={`${primaryClass} ${fullWidth ? "w-full" : ""} ${className}`}>
      <Link to={REGISTER_PATH} data-testid={testId}>
        {REGISTER_LABEL}
      </Link>
    </Button>
  );
}

export function GuestRegisterBanner({
  context = "default",
}: {
  context?: "event" | "default";
}) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return null;

  return (
    <div
      className="rounded-xl border-2 border-[#d4a373] bg-[#fff6eb] p-4 text-left"
      data-testid="banner-guest-register"
    >
      <p className="font-bold text-[#1a1a2e] text-base">New here? Create an account</p>
      <p className="text-sm text-slate-600 mt-1 mb-3 leading-relaxed">
        {context === "event"
          ? "Register for a free Locallist account to follow local events and connect with businesses. You can browse events without an account — this is not a ticket signup."
          : "Register for a free account to request quotes, follow events, and leave reviews."}
      </p>
      <RegisterCta testId="button-banner-register" fullWidth />
    </div>
  );
}

export function AuthSwitchLinks({
  mode,
  onRegister,
  onLogin,
}: {
  mode: "login" | "register";
  onRegister: () => void;
  onLogin: () => void;
}) {
  if (mode === "login") {
    return (
      <div
        className="rounded-xl border-2 border-[#d4a373] bg-[#fff6eb] p-4 text-center"
        data-testid="panel-new-here"
      >
        <p className="font-bold text-[#1a1a2e] text-lg">New here? Create an account</p>
        <p className="text-sm text-slate-600 mt-1 mb-3">
          Customer accounts are free. Register takes about a minute.
        </p>
        <Button
          type="button"
          onClick={onRegister}
          className={`${primaryClass} w-full`}
          data-testid="button-new-here-register"
        >
          {REGISTER_LABEL}
        </Button>
      </div>
    );
  }

  return (
    <p className="text-center text-sm text-slate-600" data-testid="text-already-have-account">
      Already have an account?{" "}
      <button
        type="button"
        onClick={onLogin}
        className="font-semibold text-[#0a4a82] hover:underline"
        data-testid="link-already-have-account"
      >
        {LOGIN_LABEL}
      </button>
    </p>
  );
}

export { REGISTER_PATH };
