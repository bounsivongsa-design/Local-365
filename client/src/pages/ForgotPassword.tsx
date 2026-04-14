import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Something went wrong.", variant: "destructive" });
        return;
      }
      setSent(true);
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
            Reset Your Password
          </h1>
          <p className="text-white/80 mt-2 drop-shadow">
            We'll send you a link to get back into your account
          </p>
        </div>

        <Card className="shadow-2xl border-0 rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/90 text-white">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <h2 className="font-semibold text-lg">Password Recovery</h2>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {sent ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-[#1a1a2e]">Check Your Email</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  If an account exists for <strong>{email}</strong>, you'll receive an email with a link to reset your password. The link expires in 1 hour.
                </p>
                <p className="text-xs text-gray-400">
                  Don't see it? Check your spam folder.
                </p>
                <div className="pt-2 space-y-2">
                  <Button
                    onClick={() => { setSent(false); setEmail(""); }}
                    variant="outline"
                    className="w-full rounded-xl border-[#0a4a82]/20 text-[#0a4a82] hover:bg-[#0a4a82]/5"
                    data-testid="button-try-different-email"
                  >
                    Try a different email
                  </Button>
                  <Link to="/auth" className="block">
                    <Button variant="ghost" className="w-full rounded-xl text-[#0a4a82]" data-testid="link-back-to-signin">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Sign In
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-600">
                  Enter the email address you used to create your account and we'll send you a password reset link.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-white border-gray-200"
                      style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                      required
                      data-testid="input-forgot-email"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="w-full h-12 rounded-xl bg-[#0a4a82] hover:bg-[#083a6a] text-white font-semibold text-base"
                  data-testid="button-send-reset-link"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Send Reset Link"
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
