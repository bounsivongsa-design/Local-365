import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Building2,
  Crown,
  Star,
  Medal,
  Eye,
  Trash2,
  Image,
  FileText,
  Video,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

type AdminEvent = {
  id: number;
  title: string;
  description: string;
  date: string;
  eventDates: string[] | null;
  location: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  imageUrl: string | null;
  flyerUrl: string | null;
  promoVideoUrl: string | null;
  adSize: string | null;
  businessId: number | null;
  status: string | null;
  adminNote: string | null;
  createdAt: string | null;
  businessName: string | null;
  businessMembershipTier: string | null;
};

const tierConfig: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  premium: { label: "Gold", color: "bg-yellow-500", icon: Crown },
  standard: { label: "Silver", color: "bg-slate-400", icon: Star },
  basic: { label: "Bronze", color: "bg-amber-700", icon: Medal },
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "bg-amber-500", icon: Clock },
  approved: { label: "Approved", color: "bg-green-600", icon: CheckCircle2 },
  denied: { label: "Denied", color: "bg-red-500", icon: XCircle },
};

export default function AdminEvents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [reviewEvent, setReviewEvent] = useState<AdminEvent | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<AdminEvent | null>(null);

  const { data: events, isLoading } = useQuery<AdminEvent[]>({
    queryKey: ["/api/admin/events"],
    enabled: !!user?.isAdmin,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/events/${id}`, { status, adminNote });
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/events"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: vars.status === "approved" ? "Event Approved" : vars.status === "denied" ? "Event Denied" : "Status Updated",
        description: `Event has been ${vars.status}.`,
      });
      setReviewEvent(null);
      setAdminNote("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/events/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/events"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event Deleted", description: "Event has been permanently removed." });
      setDeleteConfirm(null);
    },
  });

  if (!user?.isAdmin) {
    return (
      <div className="container mx-auto py-20 text-center">
        <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>
        <p className="text-slate-300 mt-2">Admin privileges required.</p>
      </div>
    );
  }

  const filtered = events?.filter(e => filter === "all" || e.status === filter) || [];
  const pendingCount = events?.filter(e => e.status === "pending").length || 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors mb-4" data-testid="link-back-admin">
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Dashboard
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3" data-testid="heading-admin-events">
              <Calendar className="h-8 w-8 text-[#0a4a82]" />
              Event Moderation
            </h1>
            <p className="text-slate-300 mt-1">
              Review, approve, or deny event submissions
              {pendingCount > 0 && (
                <Badge className="ml-2 bg-amber-500 text-white border-0">{pendingCount} pending</Badge>
              )}
            </p>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px] bg-white/95 text-[#1a1a2e] border-0 rounded-xl" data-testid="select-event-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-white/95 rounded-2xl shadow-sm border-0 text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No {filter !== "all" ? filter : ""} events found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(event => {
            const sc = statusConfig[event.status || "pending"] || statusConfig.pending;
            const StatusIcon = sc.icon;
            const tc = event.businessMembershipTier ? tierConfig[event.businessMembershipTier] : null;

            return (
              <Card key={event.id} className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border-0 overflow-hidden" data-testid={`card-admin-event-${event.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-lg font-bold text-[#1a1a2e] truncate">{event.title}</h3>
                        <Badge className={`${sc.color} text-white border-0 text-xs`} data-testid={`badge-event-status-${event.id}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {sc.label}
                        </Badge>
                        {tc && (
                          <Badge className={`${tc.color} text-white border-0 text-xs`}>
                            {tc.label}
                          </Badge>
                        )}
                        {event.adSize && (
                          <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">
                            {event.adSize} ad
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mb-2">
                        {event.businessName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {event.businessName}
                          </span>
                        )}
                        {!event.businessName && !event.businessId && (
                          <span className="flex items-center gap-1 text-red-500 font-medium">
                            <Shield className="h-3.5 w-3.5" />
                            Admin-created
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location}, {event.city || "Moyock"} {event.zipCode}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {event.eventDates && event.eventDates.length > 0
                            ? event.eventDates.map(d => format(new Date(d), "MMM d")).join(", ")
                            : format(new Date(event.date), "MMM d, yyyy")
                          }
                        </span>
                      </div>

                      {event.description && (
                        <p className="text-sm text-slate-600 line-clamp-2 mb-2">{event.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {event.imageUrl && <span className="flex items-center gap-1"><Image className="h-3 w-3" /> Cover photo</span>}
                        {event.flyerUrl && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Flyer</span>}
                        {event.promoVideoUrl && <span className="flex items-center gap-1"><Video className="h-3 w-3" /> Video</span>}
                        {event.createdAt && <span>Submitted {format(new Date(event.createdAt), "MMM d, h:mm a")}</span>}
                      </div>

                      {event.adminNote && (
                        <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                          <p className="text-xs text-slate-500 font-medium">Admin Note:</p>
                          <p className="text-sm text-slate-700">{event.adminNote}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {event.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white rounded-xl gap-1"
                            onClick={() => updateMutation.mutate({ id: event.id, status: "approved" })}
                            disabled={updateMutation.isPending}
                            data-testid={`button-approve-event-${event.id}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 rounded-xl gap-1"
                            onClick={() => { setReviewEvent(event); setAdminNote(""); }}
                            data-testid={`button-deny-event-${event.id}`}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Deny
                          </Button>
                        </>
                      )}
                      {event.status === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-xl gap-1"
                          onClick={() => updateMutation.mutate({ id: event.id, status: "pending" })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-unpublish-event-${event.id}`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Unpublish
                        </Button>
                      )}
                      {event.status === "denied" && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white rounded-xl gap-1"
                          onClick={() => updateMutation.mutate({ id: event.id, status: "approved" })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-reapprove-event-${event.id}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl gap-1"
                        onClick={() => setDeleteConfirm(event)}
                        data-testid={`button-delete-event-${event.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!reviewEvent} onOpenChange={() => setReviewEvent(null)}>
        <DialogContent className="bg-white rounded-2xl border-0 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-[#1a1a2e] flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Deny Event: {reviewEvent?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Reason (optional)</label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Let the business know why this event was denied..."
                className="bg-white border-slate-200 rounded-xl text-[#1a1a2e]"
                style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                rows={3}
                data-testid="input-deny-reason"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewEvent(null)} className="rounded-xl" data-testid="button-cancel-deny">
              Cancel
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
              onClick={() => reviewEvent && updateMutation.mutate({ id: reviewEvent.id, status: "denied", adminNote })}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-deny"
            >
              {updateMutation.isPending ? "Denying..." : "Deny Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-white rounded-2xl border-0 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-[#1a1a2e] flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Event
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to permanently delete <strong>{deleteConfirm?.title}</strong>? This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl" data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
