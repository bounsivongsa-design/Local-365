import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
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
  LOGIN_PATH,
  REGISTER_BUSINESS_PATH,
  REGISTER_CUSTOMER_PATH,
  REGISTER_LABEL,
  REGISTER_PATH,
} from "@/lib/auth-copy";

type AccountType = "customer" | "business";

export default function RegisterAccountPage() {
  const { accountType: accountTypeParam } = useParams<{ accountType: string }>();
  const accountType: AccountType | null =
    accountTypeParam === "business" || accountTypeParam === "customer" ? accountTypeParam : null;

  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [registerData, setRegisterData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    businessName: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate("/");
    }
  }, [isAuthenticated, authLoading, navigate]);

  if (!accountType) {
    return <Navigate to={REGISTER_PATH} replace />;
  }

  const otherPath = accountType === "business" ? REGISTER_CUSTOMER_PATH : REGISTER_BUSINESS_PATH;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      toast({
        title: "Terms Required",
        description: "You must agree to the Terms of Service, Privacy Policy, and Disclaimers to create an account.",
        variant: "destructive",
      });
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure your passwords match.", variant: "destructive" });
      return;
    }

    if (registerData.password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    setRegisterError(null);
    setExistingAccount(false);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerData.email,
          password: registerData.password,
          firstName: registerData.firstName,
          lastName: registerData.lastName,
          accountType,
          businessName: accountType === "business" ? registerData.businessName : undefined,
          acceptedTerms: true,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        const message = data.message || "Could not create account";
        const alreadyExists = /already exists/i.test(message);
        setRegisterError(message);
        setExistingAccount(alreadyExists);
        toast({ title: "Registration failed", description: message, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Welcome!",
        description:
          accountType === "business"
            ? "Your business account has been created. Set up your membership to get listed!"
            : "Your account has been created.",
      });
      navigate(accountType === "business" ? "/membership" : "/");
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = { color: "#1a1a2e", WebkitTextFillColor: "#1a1a2e" };
  const inputClass = "h-12 rounded-xl bg-white dark:bg-gray-900";

  return (
    <div className="min-h-[calc(100vh-144px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-center mb-2">
            <span className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
              Local List <span className="text-[#d4a373]">365</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg" data-testid="heading-register">
            {accountType === "business" ? "Business Account" : "Customer Account"}
          </h1>
          <p className="text-white/80 mt-2 drop-shadow">
            {accountType === "business"
              ? "Create a business account — first 90 days FREE"
              : "Always free — browse, discover, and connect locally"}
          </p>
        </div>

        <Card className="shadow-2xl border-0 rounded-2xl overflow-hidden">
          <CardHeader className="pb-6 bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/90 text-white">
            <div className="flex bg-white/10 rounded-xl p-1">
              <Link
                to={LOGIN_PATH}
                className="flex-1 py-3 rounded-lg text-base font-semibold min-h-11 transition-all text-white/80 hover:text-white text-center"
                data-testid="tab-login"
              >
                {LOGIN_LABEL}
              </Link>
              <span
                className="flex-1 py-3 rounded-lg text-base font-semibold min-h-11 bg-white text-[#0a4a82] shadow-sm text-center"
                data-testid="tab-register"
              >
                {REGISTER_LABEL}
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            <form onSubmit={handleRegister} className="space-y-4">
              <div
                className="rounded-xl border-2 border-[#d4a373] bg-[#fff6eb] p-4"
                data-testid="banner-account-type"
              >
                <p className="font-bold text-[#1a1a2e]" data-testid="text-account-type-confirm">
                  You're creating a {accountType} account
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  <Link
                    to={otherPath}
                    className="font-semibold text-[#0a4a82] hover:underline"
                    data-testid="link-switch-account-type"
                  >
                    Wrong one? Switch
                  </Link>
                </p>
              </div>

              <AuthSwitchLinks mode="register" />
              {registerError && (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 space-y-3" data-testid="alert-register-failed">
                  <p className="text-sm font-semibold text-red-800">{registerError}</p>
                  {existingAccount && (
                    <>
                      <p className="text-sm text-red-700">Already have an account? Sign in with that email, or reset your password.</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button asChild className="flex-1 min-h-11 rounded-xl bg-[#0a4a82] text-white hover:bg-[#083a6a] font-semibold">
                          <Link to={LOGIN_PATH} data-testid="button-existing-account-signin">
                            {LOGIN_LABEL}
                          </Link>
                        </Button>
                        <a href="/forgot-password" className="flex-1">
                          <Button type="button" variant="outline" className="w-full min-h-11 rounded-xl" data-testid="button-existing-account-reset">
                            Reset password
                          </Button>
                        </a>
                      </div>
                    </>
                  )}
                </div>
              )}
              {accountType === "business" && (
                <div className="space-y-2">
                  <Label htmlFor="register-business">Business Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-business"
                      placeholder="Your Business Name"
                      value={registerData.businessName}
                      onChange={(e) => setRegisterData({ ...registerData, businessName: e.target.value })}
                      className={`pl-10 ${inputClass}`}
                      style={inputStyle}
                      required
                      data-testid="input-register-business"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="register-first">First Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-first"
                      placeholder="First"
                      value={registerData.firstName}
                      onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                      className={`pl-10 ${inputClass}`}
                      style={inputStyle}
                      data-testid="input-register-firstname"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-last">Last Name</Label>
                  <Input
                    id="register-last"
                    placeholder="Last"
                    value={registerData.lastName}
                    onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                    className={inputClass}
                    style={inputStyle}
                    data-testid="input-register-lastname"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className={`pl-10 ${inputClass}`}
                    style={inputStyle}
                    required
                    data-testid="input-register-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className={`pl-10 pr-10 ${inputClass}`}
                    style={inputStyle}
                    required
                    data-testid="input-register-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-confirm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                    className={`pl-10 pr-10 ${inputClass}`}
                    style={inputStyle}
                    required
                    data-testid="input-register-confirm"
                  />
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  id="accept-terms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.currentTarget.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0a4a82] focus:ring-[#0a4a82] cursor-pointer"
                  data-testid="checkbox-accept-terms"
                />
                <label htmlFor="accept-terms" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                  I agree to the{" "}
                  <a href="/legal?section=terms" target="_blank" className="text-[#0a4a82] font-semibold hover:underline">Terms of Service</a>,{" "}
                  <a href="/legal?section=privacy" target="_blank" className="text-[#0a4a82] font-semibold hover:underline">Privacy Policy</a>, and{" "}
                  <a href="/legal?section=disclaimers" target="_blank" className="text-[#0a4a82] font-semibold hover:underline">Disclaimers</a>.
                </label>
              </div>

              {accountType === "business" ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm text-center">
                  <span className="font-semibold">First 90 days FREE!</span> No charges for the first 90 days. Cancel anytime.
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[#0a4a82] text-sm text-center">
                  <span className="font-semibold">Customer accounts are always free!</span> Browse businesses, request quotes, and discover local events.
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl bg-[#0a4a82] hover:bg-[#083a6a] text-white font-semibold text-base"
                data-testid="button-register-submit"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {accountType === "business" ? "Create Business Account" : "Create Account"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-white/80 text-sm mt-6 drop-shadow">
          Already have an account?{" "}
          <Link
            to={LOGIN_PATH}
            className="text-[#d4a373] hover:text-[#c49363] font-semibold underline-offset-2 hover:underline"
            data-testid="link-switch-to-login"
          >
            {LOGIN_LABEL}
          </Link>
        </p>
      </div>
    </div>
  );
}
