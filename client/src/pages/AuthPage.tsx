import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2, Building2 } from "lucide-react";
import { AuthSwitchLinks } from "@/components/RegisterCta";
import {
  LOGIN_LABEL,
  REGISTER_BUSINESS_PATH,
  REGISTER_CUSTOMER_PATH,
  REGISTER_LABEL,
  REGISTER_PATH,
} from "@/lib/auth-copy";

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialLoginType = searchParams.get("loginType") === "business" ? "business" : "customer";
  const [loginType, setLoginType] = useState<"customer" | "business">(initialLoginType);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate("/");
    }
  }, [isAuthenticated, authLoading, navigate]);

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (searchParams.get("mode") === "register") {
    const type = searchParams.get("type");
    if (type === "business") return <Navigate to={REGISTER_BUSINESS_PATH} replace />;
    if (type === "customer") return <Navigate to={REGISTER_CUSTOMER_PATH} replace />;
    return <Navigate to={REGISTER_PATH} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        const message = data.message || "Invalid email or password";
        setLoginError(message);
        toast({ title: "Sign in failed", description: message, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
    } catch {
      setLoginError("Something went wrong. Please try again.");
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = { color: "#1a1a2e", WebkitTextFillColor: "#1a1a2e" };
  const inputClass = "h-12 rounded-xl bg-white dark:bg-gray-900";
  const registerFromLogin = loginType === "business" ? REGISTER_BUSINESS_PATH : REGISTER_PATH;

  return (
    <div className="min-h-[calc(100vh-144px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-center mb-2">
            <span className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
              Local List <span className="text-[#d4a373]">365</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg" data-testid="heading-auth">
            {loginType === "business" ? "Business Sign In" : "Welcome Back"}
          </h1>
          <p className="text-white/80 mt-2 drop-shadow">
            {loginType === "business"
              ? "Access your business dashboard & manage your listing"
              : "Sign in to your Local List 365 account"}
          </p>
        </div>

        <Card className="shadow-2xl border-0 rounded-2xl overflow-hidden">
          <CardHeader className={`pb-6 ${loginType === "business" ? "bg-gradient-to-r from-[#0a4a82] to-[#1a6ab2]" : "bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/90"} text-white`}>
            <div className="flex bg-white/10 rounded-xl p-1 mb-3">
              <span
                className="flex-1 py-3 rounded-lg text-base font-semibold min-h-11 bg-white text-[#0a4a82] shadow-sm text-center"
                data-testid="tab-login"
              >
                {LOGIN_LABEL}
              </span>
              <Link
                to={REGISTER_PATH}
                className="flex-1 py-3 rounded-lg text-base font-semibold min-h-11 transition-all text-white/80 hover:text-white text-center"
                data-testid="tab-register"
              >
                {REGISTER_LABEL}
              </Link>
            </div>

            <div className="flex bg-white/10 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setLoginType("customer")}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  loginType === "customer"
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/60 hover:text-white/80"
                }`}
                data-testid="tab-login-customer"
              >
                <User className="h-3.5 w-3.5" />
                Customer
              </button>
              <button
                type="button"
                onClick={() => setLoginType("business")}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  loginType === "business"
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/60 hover:text-white/80"
                }`}
                data-testid="tab-login-business"
              >
                <Building2 className="h-3.5 w-3.5" />
                Business Owner
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            <form onSubmit={handleLogin} className="space-y-4">
              <AuthSwitchLinks mode="login" />
              {loginError && (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 space-y-3" data-testid="alert-login-failed">
                  <p className="text-sm font-semibold text-red-800">{loginError}</p>
                  <p className="text-sm text-red-700">
                    Don't have an account yet? Register with this email, or reset your password if you already registered.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button asChild className="flex-1 min-h-11 rounded-xl bg-[#d4a373] text-white hover:bg-[#c49363] font-semibold">
                      <Link to={registerFromLogin} data-testid="button-failed-login-register">
                        {REGISTER_LABEL}
                      </Link>
                    </Button>
                    <a href="/forgot-password" className="flex-1">
                      <Button type="button" variant="outline" className="w-full min-h-11 rounded-xl" data-testid="button-failed-login-reset">
                        Reset password
                      </Button>
                    </a>
                  </div>
                </div>
              )}
              {loginType === "business" && (
                <div className="flex items-center gap-3 p-3 bg-[#0a4a82]/5 border border-[#0a4a82]/15 rounded-xl">
                  <Building2 className="h-5 w-5 text-[#0a4a82] flex-shrink-0" />
                  <p className="text-sm text-[#0a4a82]">
                    Sign in with the email used to register your business account
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="login-email">{loginType === "business" ? "Business Email" : "Email"}</Label>
                <div className="relative">
                  {loginType === "business" ? (
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    id="login-email"
                    type="email"
                    placeholder={loginType === "business" ? "owner@yourbusiness.com" : "you@example.com"}
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className={`pl-10 ${inputClass}`}
                    style={inputStyle}
                    required
                    data-testid="input-login-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className={`pl-10 pr-10 ${inputClass}`}
                    style={inputStyle}
                    required
                    data-testid="input-login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={`w-full h-12 rounded-xl font-semibold text-base ${
                  loginType === "business"
                    ? "bg-gradient-to-r from-[#0a4a82] to-[#1a6ab2] hover:from-[#083a6a] hover:to-[#155a9a] text-white"
                    : "bg-[#0a4a82] hover:bg-[#083a6a] text-white"
                }`}
                data-testid="button-login-submit"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {loginType === "business" ? "Sign In to Dashboard" : "Sign In"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <div className="text-center">
                <a
                  href="/forgot-password"
                  className="text-sm text-[#0a4a82] hover:text-[#083a6a] hover:underline font-medium"
                  data-testid="link-forgot-password"
                >
                  Forgot your password?
                </a>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-white/80 text-sm mt-6 drop-shadow">
          New here?{" "}
          <Link
            to={REGISTER_PATH}
            className="text-[#d4a373] hover:text-[#c49363] font-semibold underline-offset-2 hover:underline"
            data-testid="link-switch-to-register"
          >
            {REGISTER_LABEL}
          </Link>
          {" · "}
          <Link
            to={REGISTER_BUSINESS_PATH}
            className="text-[#d4a373] hover:text-[#c49363] font-semibold underline-offset-2 hover:underline"
            data-testid="link-switch-to-business"
          >
            {REGISTER_LABEL} — business
          </Link>
        </p>
      </div>
    </div>
  );
}
