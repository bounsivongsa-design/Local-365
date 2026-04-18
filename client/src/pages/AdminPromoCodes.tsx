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
  DialogDescription,
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
  Pencil,
  Copy,
  RefreshCw,
  Gift,
  Megaphone,
  Crown,
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

function generateCode(prefix = "LL365"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = prefix + "-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getExpirationDate(period: string): string {
  const now = new Date();
  if (period === "1week") {
    now.setDate(now.getDate() + 7);
  } else if (period === "1month") {
    now.setMonth(now.getMonth() + 1);
  } else if (period === "2months") {
    now.setMonth(now.getMonth() + 2);
  }
  now.setHours(23, 59, 59, 999);
  return now.toISOString();
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  bronze: { label: "Bronze", color: "bg-amber-700 text-white" },
  silver: { label: "Silver", color: "bg-slate-400 text-white" },
  gold: { label: "Gold", color: "bg-yellow-500 text-white" },
};

export default function AdminPromoCodes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    membershipTier: "bronze",
    expiresPeriod: "1month",
  });
  const [newCode, setNewCode] = useState({
    code: generateCode(),
    description: "",
    membershipTier: "bronze",
    expiresPeriod: "1month",
  });
  const [mktDialogOpen, setMktDialogOpen] = useState(false);
  const [newMktCode, setNewMktCode] = useState({
    code: generateCode("MKT365"),
    description: "",
    membershipTier: "bronze",
    expiresPeriod: "1month",
  });
  const [goldTrialDialogOpen, setGoldTrialDialogOpen] = useState(false);
  const [newGoldTrialCode, setNewGoldTrialCode] = useState({
    code: generateCode("GOLD"),
    description: "",
    durationDays: "60",
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
      setNewCode({ code: generateCode(), description: "", membershipTier: "bronze", expiresPeriod: "1month" });
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

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/promo-codes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-codes"] });
      setEditDialogOpen(false);
      setEditingPromo(null);
      toast({ title: "Promo code updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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

  const getTierFromPromo = (promo: PromoCode): string => {
    if (promo.applicableTiers && promo.applicableTiers.length === 1) return promo.applicableTiers[0];
    if (promo.description) {
      const desc = promo.description.toLowerCase();
      if (desc.includes("gold")) return "gold";
      if (desc.includes("silver")) return "silver";
      if (desc.includes("bronze")) return "bronze";
    }
    return "bronze";
  };

  const openEditDialog = (promo: PromoCode) => {
    setEditingPromo(promo);
    setEditForm({
      description: promo.description || "",
      membershipTier: getTierFromPromo(promo),
      expiresPeriod: "1month",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = () => {
    if (!editingPromo) return;
    const isGoldTrial = editingPromo.discountType === "gold_trial";
    const tierLabel = TIER_LABELS[editForm.membershipTier]?.label || "Bronze";
    const periodLabel = editForm.expiresPeriod === "1month" ? "1 month" : "2 months";
    const autoDesc = editForm.description
      || (isGoldTrial
        ? `Gold trial - ${editingPromo.discountValue || 60} days`
        : `Free ${tierLabel} membership - ${periodLabel}`);
    const data: any = {
      description: autoDesc,
      maxUses: 1,
      expiresAt: getExpirationDate(editForm.expiresPeriod),
    };
    if (!isGoldTrial) {
      data.discountType = "percentage";
      data.discountValue = 100;
      data.applicableTiers = [editForm.membershipTier];
    }
    editMutation.mutate({ id: editingPromo.id, data });
  };

  const handleCreate = () => {
    if (!newCode.code) {
      toast({ title: "Error", description: "Code is required", variant: "destructive" });
      return;
    }
    const tierLabel = TIER_LABELS[newCode.membershipTier]?.label || "Bronze";
    const periodLabel = newCode.expiresPeriod === "1month" ? "1 month" : "2 months";
    const autoDesc = newCode.description || `Free ${tierLabel} membership - ${periodLabel}`;
    createMutation.mutate({
      code: newCode.code,
      description: autoDesc,
      discountType: "percentage",
      discountValue: 100,
      applicableTiers: [newCode.membershipTier],
      maxUses: 1,
      expiresAt: getExpirationDate(newCode.expiresPeriod),
    });
  };

  const handleCreateMarketing = () => {
    if (!newMktCode.code) {
      toast({ title: "Error", description: "Code is required", variant: "destructive" });
      return;
    }
    const tierLabel = TIER_LABELS[newMktCode.membershipTier]?.label || "Bronze";
    const periodLabel = newMktCode.expiresPeriod === "1month" ? "1 month" : "2 months";
    const autoDesc = newMktCode.description || `Marketing ${tierLabel} membership - ${periodLabel}`;
    createMutation.mutate({
      code: newMktCode.code,
      description: autoDesc,
      discountType: "percentage",
      discountValue: 100,
      applicableTiers: [newMktCode.membershipTier],
      maxUses: 1,
      expiresAt: getExpirationDate(newMktCode.expiresPeriod),
    });
    setMktDialogOpen(false);
    setNewMktCode({
      code: generateCode("MKT365"),
      description: "",
      membershipTier: "bronze",
      expiresPeriod: "1month",
    });
  };

  const handleCreateGoldTrial = () => {
    if (!newGoldTrialCode.code) {
      toast({ title: "Error", description: "Code is required", variant: "destructive" });
      return;
    }
    const days = parseInt(newGoldTrialCode.durationDays);
    const autoDesc = newGoldTrialCode.description || `Gold trial - ${days} days`;
    createMutation.mutate({
      code: newGoldTrialCode.code,
      description: autoDesc,
      discountType: "gold_trial",
      discountValue: 0,
      applicableTiers: ["gold"],
      maxUses: 1,
      durationDays: days,
      expiresAt: getExpirationDate("2months"),
    });
    setGoldTrialDialogOpen(false);
    setNewGoldTrialCode({
      code: generateCode("GOLD"),
      description: "",
      durationDays: "60",
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `Code "${code}" copied to clipboard` });
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
              <p className="text-white/70 mt-1">Create single-use free membership codes to send to customers</p>
            </div>
            <div className="flex gap-3">
            <Dialog open={goldTrialDialogOpen} onOpenChange={(open) => {
              setGoldTrialDialogOpen(open);
              if (open) setNewGoldTrialCode({ code: generateCode("GOLD"), description: "", durationDays: "60" });
            }}>
              <DialogTrigger asChild>
                <Button className="bg-yellow-500 hover:bg-yellow-600 text-white" data-testid="button-create-gold-trial">
                  <Crown className="h-4 w-4 mr-2" />
                  Gold Trial Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Gold Trial Code</DialogTitle>
                  <DialogDescription>Give a business temporary Gold-tier access. They can redeem this from their dashboard.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Code</label>
                    <div className="flex gap-2">
                      <Input
                        value={newGoldTrialCode.code}
                        readOnly
                        className="font-mono font-bold tracking-wider bg-slate-50"
                        style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                        data-testid="input-gold-trial-code"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => copyCode(newGoldTrialCode.code)} title="Copy code" data-testid="button-copy-gold-trial-code">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" onClick={() => setNewGoldTrialCode({ ...newGoldTrialCode, code: generateCode("GOLD") })} title="Generate new code" data-testid="button-regenerate-gold-trial-code">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description (optional)</label>
                    <Input
                      placeholder="e.g. VIP welcome gift for Jane"
                      value={newGoldTrialCode.description}
                      onChange={(e) => setNewGoldTrialCode({ ...newGoldTrialCode, description: e.target.value })}
                      style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                      className="bg-white"
                      data-testid="input-gold-trial-description"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Gold Access Duration</label>
                    <div className="mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300" data-testid="text-gold-trial-duration">
                      60 Days (all new signups already get 30 days free)
                    </div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Gold Trial Summary</span>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Access Level:</span>
                        <span className="font-medium text-yellow-700">Full Gold Membership</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span className="font-medium">{newGoldTrialCode.durationDays} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span>After Expiry:</span>
                        <span className="font-medium">Reverts to previous plan</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Redeemed from:</span>
                        <span className="font-medium">Business Dashboard</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateGoldTrial}
                    disabled={createMutation.isPending}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                    data-testid="button-submit-gold-trial"
                  >
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                    Create Gold Trial Code
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={mktDialogOpen} onOpenChange={(open) => {
              setMktDialogOpen(open);
              if (open) setNewMktCode({ code: generateCode("MKT365"), description: "", membershipTier: "bronze", expiresPeriod: "1month" });
            }}>
              <DialogTrigger asChild>
                <Button className="bg-[#8a9a5b] hover:bg-[#7a8a4b] text-white" data-testid="button-create-marketing">
                  <Megaphone className="h-4 w-4 mr-2" />
                  Marketing Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Marketing Membership Code</DialogTitle>
                  <DialogDescription>Single-use code for marketing campaigns. Copy and send to the customer.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Code</label>
                    <div className="flex gap-2">
                      <Input
                        value={newMktCode.code}
                        readOnly
                        className="font-mono font-bold tracking-wider bg-slate-50"
                        style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                        data-testid="input-mkt-code"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => copyCode(newMktCode.code)} title="Copy code" data-testid="button-copy-mkt-code">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" onClick={() => setNewMktCode({ ...newMktCode, code: generateCode("MKT365") })} title="Generate new code" data-testid="button-regenerate-mkt-code">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description (optional)</label>
                    <Input
                      placeholder="e.g. Summer Event 2026 promo"
                      value={newMktCode.description}
                      onChange={(e) => setNewMktCode({ ...newMktCode, description: e.target.value })}
                      style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                      className="bg-white"
                      data-testid="input-mkt-description"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Membership Tier</label>
                    <div className="flex gap-2">
                      {(["bronze", "silver", "gold"] as const).map((tier) => (
                        <Button
                          key={tier}
                          type="button"
                          size="sm"
                          variant={newMktCode.membershipTier === tier ? "default" : "outline"}
                          onClick={() => setNewMktCode({ ...newMktCode, membershipTier: tier })}
                          className={newMktCode.membershipTier === tier ? TIER_LABELS[tier].color : ""}
                          data-testid={`button-mkt-tier-${tier}`}
                        >
                          {TIER_LABELS[tier].label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Free For</label>
                    <Select value={newMktCode.expiresPeriod} onValueChange={(v) => setNewMktCode({ ...newMktCode, expiresPeriod: v })}>
                      <SelectTrigger data-testid="select-mkt-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1month">1 Month</SelectItem>
                        <SelectItem value="2months">2 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-[#8a9a5b]/10 rounded-lg p-4 border border-[#8a9a5b]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Megaphone className="h-4 w-4 text-[#8a9a5b]" />
                      <span className="text-sm font-semibold text-[#8a9a5b]">Code Summary</span>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span>Tier:</span>
                        <span className="font-medium">{TIER_LABELS[newMktCode.membershipTier]?.label} membership</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span className="font-medium">{newMktCode.expiresPeriod === "1month" ? "1 month" : "2 months"} free</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Usage:</span>
                        <span className="font-medium">Single use</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateMarketing}
                    disabled={createMutation.isPending}
                    className="w-full bg-[#8a9a5b] hover:bg-[#7a8a4b]"
                    data-testid="button-submit-mkt"
                  >
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
                    Create Marketing Code
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (open) setNewCode({ code: generateCode(), description: "", membershipTier: "bronze", expiresPeriod: "1month" });
            }}>
              <DialogTrigger asChild>
                <Button className="bg-[#d4a373] hover:bg-[#c49363] text-white" data-testid="button-create-promo">
                  <Plus className="h-4 w-4 mr-2" />
                  New Promo Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Free Membership Code</DialogTitle>
                  <DialogDescription>Single-use code for a free membership. Copy and send to the customer.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Code</label>
                    <div className="flex gap-2">
                      <Input
                        value={newCode.code}
                        readOnly
                        className="font-mono font-bold tracking-wider bg-slate-50"
                        style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                        data-testid="input-promo-code"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyCode(newCode.code)}
                        title="Copy code"
                        data-testid="button-copy-code"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setNewCode({ ...newCode, code: generateCode() })}
                        title="Generate new code"
                        data-testid="button-regenerate-code"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description (optional)</label>
                    <Input
                      placeholder="e.g. Welcome gift for John"
                      value={newCode.description}
                      onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                      style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                      className="bg-white"
                      data-testid="input-promo-description"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Membership Tier</label>
                    <div className="flex gap-2">
                      {(["bronze", "silver", "gold"] as const).map((tier) => (
                        <Button
                          key={tier}
                          type="button"
                          size="sm"
                          variant={newCode.membershipTier === tier ? "default" : "outline"}
                          onClick={() => setNewCode({ ...newCode, membershipTier: tier })}
                          className={newCode.membershipTier === tier ? TIER_LABELS[tier].color : ""}
                          data-testid={`button-tier-${tier}`}
                        >
                          {TIER_LABELS[tier].label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Free For</label>
                    <Select value={newCode.expiresPeriod} onValueChange={(v) => setNewCode({ ...newCode, expiresPeriod: v })}>
                      <SelectTrigger data-testid="select-expires-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1month">1 Month</SelectItem>
                        <SelectItem value="2months">2 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-[#0a4a82]/5 rounded-lg p-4 border border-[#0a4a82]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="h-4 w-4 text-[#0a4a82]" />
                      <span className="text-sm font-semibold text-[#0a4a82]">Code Summary</span>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span>Tier:</span>
                        <span className="font-medium">{TIER_LABELS[newCode.membershipTier]?.label} membership</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span className="font-medium">{newCode.expiresPeriod === "1month" ? "1 month" : "2 months"} free</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Usage:</span>
                        <span className="font-medium">Single use</span>
                      </div>
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
      </div>

      <div className="container py-8">
        {promoCodes.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
            <Tag className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No promo codes yet</h3>
            <p className="text-slate-500 mt-1">Create your first free membership code</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {promoCodes.map((promo) => {
              const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
              const isUsed = (promo.currentUses || 0) >= (promo.maxUses || 1);
              const tierName = getTierFromPromo(promo);
              const isMarketing = promo.code.startsWith("MKT365");
              const isGoldTrial = promo.discountType === "gold_trial";
              return (
                <div
                  key={promo.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl p-5 shadow-md border transition-all ${
                    promo.isActive && !isExpired && !isUsed
                      ? "border-slate-100 dark:border-slate-700"
                      : "border-slate-200 dark:border-slate-600 opacity-60"
                  }`}
                  data-testid={`card-promo-${promo.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-xl p-3 ${isGoldTrial ? "bg-yellow-100" : isMarketing ? "bg-[#8a9a5b]/10" : "bg-[#0a4a82]/10"}`}>
                        {isGoldTrial ? <Crown className="h-6 w-6 text-yellow-600" /> : isMarketing ? <Megaphone className="h-6 w-6 text-[#8a9a5b]" /> : <Ticket className="h-6 w-6 text-[#0a4a82]" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-slate-900 dark:text-white" data-testid={`text-code-${promo.id}`}>
                            {promo.code}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => copyCode(promo.code)}
                            title="Copy code"
                            data-testid={`button-copy-${promo.id}`}
                          >
                            <Copy className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          {isGoldTrial && (
                            <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-300">Gold Trial</Badge>
                          )}
                          {isMarketing && !isGoldTrial && (
                            <Badge className="bg-[#8a9a5b]/20 text-[#8a9a5b] border border-[#8a9a5b]/30">Marketing</Badge>
                          )}
                          <Badge className={TIER_LABELS[tierName]?.color || "bg-slate-400 text-white"}>
                            {isMarketing && promo.applicableTiers && promo.applicableTiers.length > 1
                              ? "All Tiers"
                              : TIER_LABELS[tierName]?.label || "Bronze"}
                          </Badge>
                          {promo.isActive && !isExpired && !isUsed ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                          ) : (
                            <Badge variant="secondary">
                              {isUsed ? "Used" : isExpired ? "Expired" : "Inactive"}
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
                          {isGoldTrial ? "Gold Trial" : "Free Membership"}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Gift className="h-3 w-3" />
                            {isUsed ? "Redeemed" : "Unused"}
                          </span>
                          {promo.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expires {new Date(promo.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(promo)}
                          data-testid={`button-edit-${promo.id}`}
                        >
                          <Pencil className="h-4 w-4 text-[#0a4a82]" />
                        </Button>
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Promo Code: {editingPromo?.code}</DialogTitle>
            <DialogDescription>Update membership tier and duration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description (optional)</label>
              <Input
                placeholder="e.g. Welcome gift for John"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                className="bg-white"
                data-testid="input-edit-description"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Membership Tier</label>
              <div className="flex gap-2">
                {(["bronze", "silver", "gold"] as const).map((tier) => (
                  <Button
                    key={tier}
                    type="button"
                    size="sm"
                    variant={editForm.membershipTier === tier ? "default" : "outline"}
                    onClick={() => setEditForm({ ...editForm, membershipTier: tier })}
                    className={editForm.membershipTier === tier ? TIER_LABELS[tier].color : ""}
                    data-testid={`button-edit-tier-${tier}`}
                  >
                    {TIER_LABELS[tier].label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Free For</label>
              <Select value={editForm.expiresPeriod} onValueChange={(v) => setEditForm({ ...editForm, expiresPeriod: v })}>
                <SelectTrigger data-testid="select-edit-expires-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1month">1 Month</SelectItem>
                  <SelectItem value="2months">2 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleEdit}
              disabled={editMutation.isPending}
              className="w-full bg-[#0a4a82] hover:bg-[#083a6a]"
              data-testid="button-submit-edit"
            >
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
