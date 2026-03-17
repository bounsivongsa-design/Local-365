import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Tag,
  Calendar,
  Users,
  Ticket,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";

interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  applicableTiers: string[] | null;
  maxUses: number | null;
  currentUses: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean | null;
  createdAt: string | null;
}

export default function AdminPromoCodes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "",
    applicableTiers: [] as string[],
    maxUses: "",
    expiresAt: "",
  });

  const { data: promoCodes = [], isLoading } = useQuery<PromoCode[]>({
    queryKey: ["/api/promo-codes"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/promo-codes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      setDialogOpen(false);
      setNewCode({ code: "", description: "", discountType: "percentage", discountValue: "", applicableTiers: [], maxUses: "", expiresAt: "" });
      toast({ title: "Promo code created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/promo-codes/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/promo-codes/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      toast({ title: "Promo code deleted" });
    },
  });

  const handleCreate = () => {
    if (!newCode.code || !newCode.discountValue) {
      toast({ title: "Error", description: "Code and discount value are required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      code: newCode.code,
      description: newCode.description || null,
      discountType: newCode.discountType,
      discountValue: parseInt(newCode.discountValue),
      applicableTiers: newCode.applicableTiers.length > 0 ? newCode.applicableTiers : [],
      maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
      expiresAt: newCode.expiresAt || null,
    });
  };

  const handleTierToggle = (tier: string) => {
    setNewCode((prev) => ({
      ...prev,
      applicableTiers: prev.applicableTiers.includes(tier)
        ? prev.applicableTiers.filter((t) => t !== tier)
        : [...prev.applicableTiers, tier],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#0a4a82]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="bg-gradient-to-r from-[#0a4a82] to-[#083a6a] py-10">
        <div className="container">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm" data-testid="link-back-dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3" data-testid="text-page-title">
                <Ticket className="h-8 w-8 text-[#d4a373]" />
                Promo Codes
              </h1>
              <p className="text-white/70 mt-1">Create and manage promotional discount codes</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#d4a373] hover:bg-[#c49363] text-white" data-testid="button-create-promo">
                  <Plus className="h-4 w-4 mr-2" />
                  New Promo Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Promo Code</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Code</label>
                    <Input
                      placeholder="e.g. WELCOME25"
                      value={newCode.code}
                      onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                      data-testid="input-promo-code"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                    <Input
                      placeholder="e.g. 25% off first month"
                      value={newCode.description}
                      onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                      data-testid="input-promo-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Discount Type</label>
                      <Select value={newCode.discountType} onValueChange={(v) => setNewCode({ ...newCode, discountType: v })}>
                        <SelectTrigger data-testid="select-discount-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Discount Value {newCode.discountType === "percentage" ? "(%)" : "($)"}
                      </label>
                      <Input
                        type="number"
                        placeholder={newCode.discountType === "percentage" ? "25" : "50"}
                        value={newCode.discountValue}
                        onChange={(e) => setNewCode({ ...newCode, discountValue: e.target.value })}
                        data-testid="input-discount-value"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Applicable Tiers (leave empty for all)</label>
                    <div className="flex gap-2">
                      {["bronze", "silver", "gold"].map((tier) => (
                        <Button
                          key={tier}
                          type="button"
                          size="sm"
                          variant={newCode.applicableTiers.includes(tier) ? "default" : "outline"}
                          onClick={() => handleTierToggle(tier)}
                          className={newCode.applicableTiers.includes(tier) ? "bg-[#0a4a82]" : ""}
                          data-testid={`button-tier-${tier}`}
                        >
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Max Uses (optional)</label>
                      <Input
                        type="number"
                        placeholder="Unlimited"
                        value={newCode.maxUses}
                        onChange={(e) => setNewCode({ ...newCode, maxUses: e.target.value })}
                        data-testid="input-max-uses"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Expires At (optional)</label>
                      <Input
                        type="datetime-local"
                        value={newCode.expiresAt}
                        onChange={(e) => setNewCode({ ...newCode, expiresAt: e.target.value })}
                        data-testid="input-expires-at"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    className="w-full bg-[#0a4a82] hover:bg-[#083a6a]"
                    data-testid="button-submit-promo"
                  >
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Create Promo Code
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {promoCodes.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
            <Tag className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No promo codes yet</h3>
            <p className="text-slate-500 mt-1">Create your first promotional discount code</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {promoCodes.map((promo) => {
              const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
              const isMaxed = promo.maxUses && (promo.currentUses || 0) >= promo.maxUses;
              return (
                <div
                  key={promo.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl p-5 shadow-md border transition-all ${
                    promo.isActive && !isExpired && !isMaxed
                      ? "border-slate-100 dark:border-slate-700"
                      : "border-slate-200 dark:border-slate-600 opacity-60"
                  }`}
                  data-testid={`card-promo-${promo.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-[#0a4a82]/10 rounded-xl p-3">
                        <Ticket className="h-6 w-6 text-[#0a4a82]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-slate-900 dark:text-white" data-testid={`text-code-${promo.id}`}>
                            {promo.code}
                          </span>
                          {promo.isActive && !isExpired && !isMaxed ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                          ) : (
                            <Badge variant="secondary">
                              {isExpired ? "Expired" : isMaxed ? "Maxed Out" : "Inactive"}
                            </Badge>
                          )}
                        </div>
                        {promo.description && (
                          <p className="text-sm text-slate-500 mt-0.5">{promo.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {promo.discountType === "percentage" ? `${promo.discountValue}% off` : `$${promo.discountValue} off`}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {promo.currentUses || 0}{promo.maxUses ? `/${promo.maxUses}` : ""} uses
                          </span>
                          {promo.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(promo.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {promo.applicableTiers && promo.applicableTiers.length > 0 && (
                          <div className="flex gap-1 mt-1 justify-end">
                            {promo.applicableTiers.map((t) => (
                              <Badge key={t} variant="outline" className="text-xs capitalize">{t}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMutation.mutate({ id: promo.id, isActive: !promo.isActive })}
                          data-testid={`button-toggle-${promo.id}`}
                        >
                          {promo.isActive ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-slate-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this promo code?")) {
                              deleteMutation.mutate(promo.id);
                            }
                          }}
                          data-testid={`button-delete-${promo.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
