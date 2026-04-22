import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, RefreshCw, Loader2, Gift, Shield } from "lucide-react";

interface AdminReferral {
  id: number;
  code: string;
  status: string;
  createdAt: string | null;
  rewardedAt: string | null;
  referrerBusinessId: number;
  referrerBusinessName: string;
  referrerHasStripeCustomer: boolean;
  referrerTier: string | null;
  referredBusinessId: number;
  referredBusinessName: string;
  estimatedCreditCents: number | null;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: string) {
  if (status === "rewarded") {
    return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20" data-testid={`badge-status-${status}`}>Rewarded</Badge>;
  }
  if (status === "pending") {
    return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20" data-testid={`badge-status-${status}`}>Pending</Badge>;
  }
  if (status === "processing") {
    return <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/20" data-testid={`badge-status-${status}`}>Processing</Badge>;
  }
  return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
}

export default function AdminReferrals() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirmRow, setConfirmRow] = useState<AdminReferral | null>(null);

  const isAdmin = isAuthenticated && user?.accountType === "admin";

  const { data: referrals, isLoading } = useQuery<AdminReferral[]>({
    queryKey: ["/api/admin/referrals", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all"
        ? "/api/admin/referrals"
        : `/api/admin/referrals?status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: isAdmin,
  });

  const issueCredit = useMutation({
    mutationFn: async (referralId: number) => {
      const res = await apiRequest("POST", `/api/admin/referrals/${referralId}/issue-credit`);
      return res.json() as Promise<{ ok: boolean; creditCents: number; balanceTransactionId: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Credit issued",
        description: `Applied ${formatCents(data.creditCents)} to referrer's Stripe balance.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals/stats"] });
      setConfirmRow(null);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to issue credit",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  const totals = (referrals || []).reduce(
    (acc, r) => {
      acc.total++;
      if (r.status === "rewarded") acc.rewarded++;
      else if (r.status === "pending") acc.pending++;
      else if (r.status === "processing") acc.processing++;
      return acc;
    },
    { total: 0, rewarded: 0, pending: 0, processing: 0 },
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="bg-white/95 backdrop-blur-sm p-8 text-center max-w-md">
          <Shield className="h-12 w-12 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Admin Access Required</h2>
          <p className="text-slate-500 mb-4">You need admin privileges to view this page.</p>
          <Button onClick={() => navigate("/dashboard")} className="bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl" data-testid="button-go-dashboard">
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <Link to="/admin" data-testid="link-back-admin">
            <Button variant="ghost" size="sm" className="mb-2 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Admin
            </Button>
          </Link>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Referrals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Spot referrals where the Stripe credit didn't land and re-issue it manually.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="rewarded">Rewarded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card data-testid="card-stat-total">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Showing</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold" data-testid="text-stat-total">{totals.total}</div></CardContent>
        </Card>
        <Card data-testid="card-stat-rewarded">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rewarded</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600" data-testid="text-stat-rewarded">{totals.rewarded}</div></CardContent>
        </Card>
        <Card data-testid="card-stat-pending">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600" data-testid="text-stat-pending">{totals.pending}</div></CardContent>
        </Card>
        <Card data-testid="card-stat-processing">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600" data-testid="text-stat-processing">{totals.processing}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16" data-testid="state-loading">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !referrals || referrals.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground" data-testid="state-empty">
              <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No referrals match this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Referrer</th>
                    <th className="px-4 py-3">Referred</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Rewarded</th>
                    <th className="px-4 py-3">Credit (est.)</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {referrals.map((r) => (
                    <tr key={r.id} data-testid={`row-referral-${r.id}`}>
                      <td className="px-4 py-3" data-testid={`text-referrer-${r.id}`}>
                        <div className="font-medium">{r.referrerBusinessName}</div>
                        <div className="text-xs text-muted-foreground">
                          #{r.referrerBusinessId}
                          {r.referrerTier ? ` · ${r.referrerTier}` : ""}
                          {!r.referrerHasStripeCustomer ? " · no Stripe customer" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3" data-testid={`text-referred-${r.id}`}>
                        <div className="font-medium">{r.referredBusinessName}</div>
                        <div className="text-xs text-muted-foreground">#{r.referredBusinessId}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" data-testid={`text-code-${r.id}`}>{r.code}</td>
                      <td className="px-4 py-3">{statusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground" data-testid={`text-created-${r.id}`}>{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground" data-testid={`text-rewarded-${r.id}`}>{formatDate(r.rewardedAt)}</td>
                      <td className="px-4 py-3" data-testid={`text-credit-${r.id}`}>{formatCents(r.estimatedCreditCents)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!r.referrerHasStripeCustomer || (issueCredit.isPending && issueCredit.variables === r.id)}
                          onClick={() => setConfirmRow(r)}
                          data-testid={`button-issue-credit-${r.id}`}
                        >
                          {issueCredit.isPending && issueCredit.variables === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          )}
                          {r.status === "rewarded" ? "Re-issue" : "Issue credit"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmRow} onOpenChange={(open) => !open && setConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmRow?.status === "rewarded" ? "Re-issue" : "Issue"} Stripe credit?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will apply an estimated {formatCents(confirmRow?.estimatedCreditCents ?? null)} credit
              to <strong>{confirmRow?.referrerBusinessName}</strong>'s Stripe customer balance for referring{" "}
              <strong>{confirmRow?.referredBusinessName}</strong>. The exact amount is recalculated from
              their current subscription at issue time. This action is logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-issue">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-issue"
              onClick={() => confirmRow && issueCredit.mutate(confirmRow.id)}
            >
              Issue credit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
