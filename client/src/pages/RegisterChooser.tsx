import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { User, Building2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  LOGIN_LABEL,
  LOGIN_PATH,
  REGISTER_BUSINESS_BODY,
  REGISTER_BUSINESS_HEADLINE,
  REGISTER_BUSINESS_PATH,
  REGISTER_CUSTOMER_BODY,
  REGISTER_CUSTOMER_HEADLINE,
  REGISTER_CUSTOMER_PATH,
  REGISTER_LABEL,
} from "@/lib/auth-copy";

export default function RegisterChooser() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-[calc(100vh-144px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-center mb-2">
            <span className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
              Local List <span className="text-[#d4a373]">365</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg" data-testid="heading-register-chooser">
            {REGISTER_LABEL}
          </h1>
          <p className="text-white/80 mt-2 drop-shadow">
            Choose how you want to join. Pick the door that matches you.
          </p>
        </div>

        <div className="space-y-4">
          <Link to={REGISTER_CUSTOMER_PATH} data-testid="door-register-customer" className="block">
            <Card className="shadow-2xl border-0 rounded-2xl overflow-hidden transition hover:scale-[1.01] hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#0a4a82]/10 text-[#0a4a82] flex items-center justify-center shrink-0">
                  <User className="h-6 w-6" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-lg text-[#1a1a2e]">{REGISTER_CUSTOMER_HEADLINE}</p>
                  <p className="text-slate-600 mt-1 leading-relaxed">{REGISTER_CUSTOMER_BODY}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-[#d4a373] shrink-0 mt-1" />
              </CardContent>
            </Card>
          </Link>

          <Link to={REGISTER_BUSINESS_PATH} data-testid="door-register-business" className="block">
            <Card className="shadow-2xl border-0 rounded-2xl overflow-hidden transition hover:scale-[1.01] hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              <CardContent className="p-6 flex items-start gap-4 bg-gradient-to-br from-white to-[#fff6eb]">
                <div className="h-12 w-12 rounded-xl bg-[#d4a373]/20 text-[#0a4a82] flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-lg text-[#1a1a2e]">{REGISTER_BUSINESS_HEADLINE}</p>
                  <p className="text-slate-600 mt-1 leading-relaxed">{REGISTER_BUSINESS_BODY}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-[#d4a373] shrink-0 mt-1" />
              </CardContent>
            </Card>
          </Link>
        </div>

        <p className="text-center text-white/80 text-sm mt-6 drop-shadow">
          Already have an account?{" "}
          <Link
            to={LOGIN_PATH}
            className="text-[#d4a373] hover:text-[#c49363] font-semibold underline-offset-2 hover:underline"
            data-testid="link-chooser-signin"
          >
            {LOGIN_LABEL}
          </Link>
        </p>
      </div>
    </div>
  );
}
