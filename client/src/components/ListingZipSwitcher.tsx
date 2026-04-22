import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, MapPin, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type OwnedListing = {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  isPrimary?: boolean;
  isAdditionalZip?: boolean | null;
  status?: string | null;
  effectiveTier?: string;
};

type AvailableZip = { zipCode: string; city: string; state: string; region: string };

export function ListingZipSwitcher({ activeBusinessId }: { activeBusinessId: number | null }) {
  const { toast } = useToast();
  const [addZipOpen, setAddZipOpen] = useState(false);
  const [pickedZip, setPickedZip] = useState<string>("");

  const { data: listings = [], isLoading } = useQuery<OwnedListing[]>({
    queryKey: ["/api/my-businesses"],
    enabled: !!activeBusinessId,
  });

  const active = listings.find((l) => l.id === activeBusinessId) ?? null;

  const { data: availableZips = [] } = useQuery<AvailableZip[]>({
    queryKey: ["/api/businesses", activeBusinessId, "available-zips"],
    queryFn: async () => {
      const res = await fetch(`/api/businesses/${activeBusinessId}/available-zips`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: addZipOpen && !!activeBusinessId,
  });

  const switchMutation = useMutation({
    mutationFn: async (businessId: number) => {
      const res = await apiRequest("POST", "/api/my-businesses/switch", { businessId });
      return res.json();
    },
    onSuccess: () => {
      // Refetch everything that's keyed off the active listing.
      queryClient.invalidateQueries();
      // Force a clean reload so all dashboard tabs re-scope cleanly.
      window.location.reload();
    },
    onError: (err: any) => {
      toast({ title: "Couldn't switch listing", description: err?.message || "Try again", variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (zipCode: string) => {
      const res = await apiRequest("POST", `/api/businesses/${activeBusinessId}/add-zip-checkout`, { zipCode });
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Checkout error", description: "No checkout URL returned", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Couldn't start checkout", description: err?.message || "Try again", variant: "destructive" });
    },
  });

  if (isLoading || !active) return null;

  const hasMultiple = listings.length > 1;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap" data-testid="zip-switcher">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/95 border-[#0a4a82]/30 hover:bg-white"
              data-testid="button-zip-switcher"
            >
              <MapPin className="h-4 w-4 mr-1.5 text-[#0a4a82]" />
              <span className="font-medium">
                {active.city || "—"} {active.zipCode}
              </span>
              {hasMultiple && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">
                  {listings.length} listings
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 ml-1.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Your listings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {listings.map((l) => (
              <DropdownMenuItem
                key={l.id}
                disabled={l.id === activeBusinessId || switchMutation.isPending}
                onClick={() => switchMutation.mutate(l.id)}
                data-testid={`menuitem-listing-${l.id}`}
                className="flex items-start gap-2 py-2"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    {l.city}, {l.state} {l.zipCode}
                    {l.id === activeBusinessId && <Check className="h-3.5 w-3.5 text-green-600" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {l.isAdditionalZip ? "Additional zip" : "Primary listing"}
                    {l.effectiveTier && l.effectiveTier !== "none" && ` · ${l.effectiveTier}`}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setAddZipOpen(true)}
              data-testid="menuitem-add-zip"
              className="text-[#0a4a82] font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add this listing to another zip
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={addZipOpen} onOpenChange={setAddZipOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-add-zip">
          <DialogHeader>
            <DialogTitle>Add another zip to {active.name}</DialogTitle>
            <DialogDescription>
              Each zip is a separate listing with its own analytics, reviews, quotes, and ads.
              Billed monthly at the rate discounted by your current tier. No 30-day Gold trial on
              additional zips — billing starts day 1.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium">Pick a covered zip</label>
            <Select value={pickedZip} onValueChange={setPickedZip}>
              <SelectTrigger data-testid="select-add-zip">
                <SelectValue placeholder={availableZips.length ? "Choose a zip…" : "Loading zips…"} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableZips.map((z) => (
                  <SelectItem key={z.zipCode} value={z.zipCode} data-testid={`option-zip-${z.zipCode}`}>
                    {z.city}, {z.state} {z.zipCode} · {z.region}
                  </SelectItem>
                ))}
                {availableZips.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">
                    You already have a listing in every covered zip.
                  </div>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              We'll copy this listing's content (categories, hours, photos, credentials, social) into
              the new zip. You can edit it independently afterwards.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddZipOpen(false)} data-testid="button-cancel-add-zip">
              Cancel
            </Button>
            <Button
              onClick={() => pickedZip && checkoutMutation.mutate(pickedZip)}
              disabled={!pickedZip || checkoutMutation.isPending}
              className="bg-[#0a4a82] hover:bg-[#083a6a]"
              data-testid="button-confirm-add-zip"
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redirecting…
                </>
              ) : (
                "Continue to checkout"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
