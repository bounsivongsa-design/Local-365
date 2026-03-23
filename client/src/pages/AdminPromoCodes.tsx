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

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "LL365-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getExpirationDate(period: string): string {
  const now = new Date();
  if (period === "1month") {
    now.setMonth(now.getMonth() + 1);
  } else if (period === "2months") {
    now.setMonth(now.getMonth() + 2);
  }
  now.setHours(23, 59, 59, 999);
  return now.toISOString();
}

export default function AdminPromoCodes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    discountType: "percentage",
    discountValue: "",
    applicableTiers: [] as string[],
    expiresPeriod: "1month",
  });
  const [newCode, setNewCode] = useState({
    code: generateCode(),
    description: "",
    discountType: "percentage",
    discountValue: "",
    applicableTiers: [] as string[],
    expiresPeriod: "1month",
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
      setNewCode({ code: generateCode(), description: "", discountType: "percentage", discountValue: "", applicableTiers: [], expiresPeriod: "1month" });
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

  const openEditDialog = (promo: PromoCode) => {
    setEditingPromo(promo);
    setEditForm({
      description: promo.description || "",
      discountType: promo.discountType,
      discountValue: String(promo.discountValue),
      applicableTiers: promo.applicableTiers || [],
      expiresPeriod: "1month",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = () => {
    if (!editingPromo || !editForm.discountValue) {
      toast({ title: "Error", description: "Discount value is required", variant: "destructive" });
      return;
    }
    editMutation.mutate({
      id: editingPromo.id,
      data: {
        description: editForm.description || null,
        discountType: editForm.discountType,
        discountValue: parseInt(editForm.discountValue),
        applicableTiers: editForm.applicableTiers.length > 0 ? editForm.applicableTiers : [],
        maxUses: 1,
        expiresAt: getExpirationDate(editForm.expiresPeriod),
      },
    });
  };

  const handleEditTierToggle = (tier: string) => {
    setEditForm((prev) => ({
      ...prev,
      applicableTiers: prev.applicableTiers.includes(tier)
        ? prev.applicableTiers.filter((t) => t !== tier)
        : [...prev.applicableTiers, tier],
    }));
  };

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
      maxUses: 1,
      expiresAt: getExpirationDate(newCode.expiresPeriod),
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
              <p className="text-white/70 mt-1">Create and manage single-use promotional discount codes</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (open) setNewCode({ code: generateCode(), description: "", discountType: "percentage", discountValue: "", applicableTiers: [], expiresPeriod: "1month" });
            }}>
              <DialogTrigger asChild>
                <Button className="bg-[#d4a373] hover:bg-[#c49363] text-white" data-testid="button-create-promo">
                  <Plus className="h-4 w-4 mr-2" />
                  New Promo Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Promo Code</DialogTitle>
                  <DialogDescription>Single-use code. Copy and send to the customer.</DialogDescription>
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
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                    <Input
                      placeholder="e.g. 25% off first month"
                      value={newCode.description}
                      onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                      style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                      className="bg-white"
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
                        style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                        className="bg-white"
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
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Expires In</label>
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
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Usage:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">Single use (1 per customer)</span>
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
              const isUsed = (promo.currentUses || 0) >= (promo.maxUses || 1);
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
                      <div className="bg-[#0a4a82]/10 rounded-xl p-3">
                        <Ticket className="h-6 w-6 text-[#0a4a82]" />
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
                          {promo.discountType === "percentage" ? `${promo.discountValue}% off` : `$${promo.discountValue} off`}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {isUsed ? "Used" : "Unused"} (single-use)
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
            <DialogDescription>Update discount details and expiration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <Input
                placeholder="e.g. 25% off first month"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                className="bg-white"
                data-testid="input-edit-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Discount Type</label>
                <Select value={editForm.discountType} onValueChange={(v) => setEditForm({ ...editForm, discountType: v })}>
                  <SelectTrigger data-testid="select-edit-discount-type">
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
                  Discount Value {editForm.discountType === "percentage" ? "(%)" : "($)"}
                </label>
                <Input
                  type="number"
                  value={editForm.discountValue}
                  onChange={(e) => setEditForm({ ...editForm, discountValue: e.target.value })}
                  style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                  className="bg-white"
                  data-testid="input-edit-discount-value"
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
                    variant={editForm.applicableTiers.includes(tier) ? "default" : "outline"}
                    onClick={() => handleEditTierToggle(tier)}
                    className={editForm.applicableTiers.includes(tier) ? "bg-[#0a4a82]" : ""}
                    data-testid={`button-edit-tier-${tier}`}
                  >
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Expires In</label>
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
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Usage:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">Single use (1 per customer)</span>
              </div>
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
