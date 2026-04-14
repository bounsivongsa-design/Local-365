import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2, Building2 } from "lucide-react";

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const accountTypeParam = searchParams.get("type");
  const initialLoginType = searchParams.get("loginType") === "business" ? "business" : "customer";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [loginType, setLoginType] = useState<"customer" | "business">(initialLoginType);
  const [accountType, setAccountType] = useState<"customer" | "business">(
    accountTypeParam === "business" ? "business" : "customer"
  );
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate("/");
    }
  }, [isAuthenticated, authLoading, navigate]);

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", password: "", confirmPassword: "", firstName: "", lastName: "", businessName: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Sign in failed", description: data.message || "Invalid email or password", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      toast({ title: "Terms Required", description: "You must agree to the Terms of Service, Privacy Policy, and Disclaimers to create an account.", variant: "destructive" });
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
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerData.email,
          password: registerData.password,
          firstName: registerData.firstName,
          lastName: registerData.lastName,
          accountType: accountType,
          businessName: accountType === "business" ? registerData.businessName : undefined,
          acceptedTerms: true,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Registration failed", description: data.message || "Could not create account", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome!", description: accountType === "business" ? "Your business account has been created. Set up your membership to get listed!" : "Your account has been created." });
      if (accountType === "business") {
        navigate("/membership");
      } else {
        navigate("/");
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = { color: '#1a1a2e', WebkitTextFillColor: '#1a1a2e' };
  const inputClass = "h-12 rounded-xl bg-white dark:bg-gray-900";

  return (
    <div className="min-h-[calc(100vh-144px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-center mb-2">
            <span className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">Local List <span className="text-[#d4a373]">365</span></span>
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg" data-testid="heading-auth">
            {mode === "login"
              ? loginType === "business" ? "Business Sign In" : "Welcome Back"
              : accountType === "business" ? "Business Account" : "Customer Account"}
          </h1>
          <p className="text-white/80 mt-2 drop-shadow">
            {mode === "login"
              ? loginType === "business" ? "Access your business dashboard & manage your listing" : "Sign in to your Local List 365 account"
              : accountType === "business" ? "Create a business account — first month FREE" : "Always free — browse, discover, and connect locally"}
          </p>
        </div>

        <Card className="shadow-2xl border-0 rounded-2xl overflow-hidden">
          <CardHeader className={`pb-6 ${mode === "login" && loginType === "business" ? "bg-gradient-to-r from-[#0a4a82] to-[#1a6ab2]" : "bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/90"} text-white`}>
            <div className="flex bg-white/10 rounded-xl p-1 mb-3">
              <button
                onClick={() => { setMode("login"); setLoginType("customer"); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === "login"
                    ? "bg-white text-[#0a4a82] shadow-sm"
                    : "text-white/80 hover:text-white"
                }`}
                data-testid="tab-login"
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode("register"); setAccountType("customer"); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === "register"
                    ? "bg-white text-[#0a4a82] shadow-sm"
                    : "text-white/80 hover:text-white"
                }`}
                data-testid="tab-register"
              >
                Register
              </button>
            </div>

            {mode === "login" && (
              <div className="flex bg-white/10 rounded-lg p-1">
                <button
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
            )}

            {mode === "register" && (
              <div className="flex bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setAccountType("customer")}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    accountType === "customer"
                      ? "bg-white/20 text-white shadow-sm"
                      : "text-white/60 hover:text-white/80"
                  }`}
                  data-testid="tab-register-customer"
                >
                  <User className="h-3.5 w-3.5" />
                  Customer
                </button>
                <button
                  onClick={() => setAccountType("business")}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    accountType === "business"
                      ? "bg-white/20 text-white shadow-sm"
                      : "text-white/60 hover:text-white/80"
                  }`}
                  data-testid="tab-register-business"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Business Owner
                </button>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-6 space-y-5">

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
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
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
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
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
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
                    <span className="font-semibold">First month FREE!</span> No charges until your second month. Cancel anytime.
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
            )}
          </CardContent>
        </Card>

        <p className="text-center text-white/70 text-sm mt-6 drop-shadow">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button onClick={() => { setMode("register"); setAccountType("customer"); }} className="text-[#d4a373] hover:text-[#c49363] font-semibold" data-testid="link-switch-to-register">
                Customer account
              </button>
              {" | "}
              <button onClick={() => { setMode("register"); setAccountType("business"); }} className="text-[#d4a373] hover:text-[#c49363] font-semibold" data-testid="link-switch-to-business">
                Business account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => { setMode("login"); setLoginType(accountType); }} className="text-[#d4a373] hover:text-[#c49363] font-semibold" data-testid="link-switch-to-login">
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
