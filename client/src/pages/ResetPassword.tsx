import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 rounded-2xl overflow-hidden">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-[#1a1a2e]">Invalid Reset Link</h3>
              <p className="text-sm text-gray-600">
                This password reset link is missing or invalid. Please request a new one.
              </p>
              <Link to="/forgot-password">
                <Button className="w-full rounded-xl bg-[#0a4a82] hover:bg-[#083a6a] text-white" data-testid="button-request-new-link">
                  Request New Reset Link
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure your passwords match.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Something went wrong.", variant: "destructive" });
        return;
      }
      setSuccess(true);
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-white drop-shadow-lg">
            Set New Password
          </h1>
          <p className="text-white/80 mt-2 drop-shadow">
            Choose a strong password for your account
          </p>
        </div>

        <Card className="shadow-2xl border-0 rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/90 text-white">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <h2 className="font-semibold text-lg">New Password</h2>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {success ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-[#1a1a2e]">Password Reset Complete</h3>
                <p className="text-sm text-gray-600">
                  Your password has been updated. You can now sign in with your new password.
                </p>
                <Link to="/auth" className="block pt-2">
                  <Button className="w-full h-12 rounded-xl bg-[#0a4a82] hover:bg-[#083a6a] text-white font-semibold text-base" data-testid="button-go-to-signin">
                    Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 rounded-xl bg-white border-gray-200"
                      style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                      required
                      minLength={6}
                      data-testid="input-new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-toggle-new-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-white border-gray-200"
                      style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                      required
                      minLength={6}
                      data-testid="input-confirm-new-password"
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500 font-medium">Passwords don't match</p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting || password.length < 6 || password !== confirmPassword}
                  className="w-full h-12 rounded-xl bg-[#0a4a82] hover:bg-[#083a6a] text-white font-semibold text-base"
                  data-testid="button-reset-password"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Reset Password"
                  )}
                </Button>
                <div className="text-center pt-1">
                  <Link to="/auth" className="text-sm text-[#0a4a82] hover:text-[#083a6a] hover:underline font-medium" data-testid="link-back-to-signin">
                    <ArrowLeft className="h-3.5 w-3.5 inline mr-1" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
