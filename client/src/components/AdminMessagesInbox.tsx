import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldCheck,
  Send,
  Loader2,
  Inbox,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AdminMsg {
  id: number;
  businessId: number;
  senderUserId: string;
  senderRole: "admin" | "business";
  body: string;
  createdAt: string;
  readAt: string | null;
}

interface AdminThread {
  businessId: number;
  businessName: string;
  messages: AdminMsg[];
  lastMessageAt: string;
  unreadCount: number;
}

// Owner-side inbox card for messages from the Local List 365 admin team.
// Lives next to DashboardInbox on the business owner's dashboard. One thread
// per owned business (most owners have 1; multi-zip owners have one card per
// business listing). Card stays collapsed until the owner expands it; we
// auto-expand the first time a thread has unread messages.
export function AdminMessagesInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState<Record<number, string>>({});
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  const { data: threads, isLoading } = useQuery<AdminThread[]>({
    queryKey: ["/api/my/admin-messages"],
    refetchInterval: 20000,
  });

  // Auto-expand any thread that has unread messages on first load — and also
  // mark them read on the server so the unread badge doesn't keep showing
  // after the owner has plainly seen the messages.
  useEffect(() => {
    if (!threads) return;
    const next = new Set(openIds);
    let changed = false;
    for (const t of threads) {
      if (t.unreadCount > 0 && !next.has(t.businessId)) {
        next.add(t.businessId);
        changed = true;
        markReadMutation.mutate(t.businessId);
      }
    }
    if (changed) setOpenIds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads]);

  const replyMutation = useMutation({
    mutationFn: async (vars: { businessId: number; body: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/my/admin-messages/${vars.businessId}`,
        { body: vars.body },
      );
      return res.json();
    },
    onSuccess: (_data, vars) => {
      setReply((r) => ({ ...r, [vars.businessId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/my/admin-messages"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/my/admin-messages/unread-count"],
      });
    },
    onError: () => {
      toast({
        title: "Couldn't send reply",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (businessId: number) => {
      await apiRequest(
        "POST",
        `/api/my/admin-messages/${businessId}/read`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/admin-messages"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/my/admin-messages/unread-count"],
      });
    },
  });

  const toggleOpen = (t: AdminThread) => {
    const next = new Set(openIds);
    if (next.has(t.businessId)) {
      next.delete(t.businessId);
    } else {
      next.add(t.businessId);
      // Mark read whenever the owner opens a thread that has unread msgs.
      if (t.unreadCount > 0) markReadMutation.mutate(t.businessId);
    }
    setOpenIds(next);
  };

  const totalUnread =
    threads?.reduce((sum, t) => sum + t.unreadCount, 0) ?? 0;

  // Hide the card entirely until there's at least one thread or it's loading.
  // Owners with no admin contact yet shouldn't see an empty section.
  if (!isLoading && (!threads || threads.length === 0)) return null;

  return (
    <Card
      className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10"
      data-testid="card-admin-messages-inbox"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg text-[#1a1a2e]">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0a4a82] to-[#0a4a82]/70 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              Messages from Admin
              {totalUnread > 0 && (
                <Badge
                  className="bg-[#0a4a82] text-white text-[11px] h-5 px-2 rounded-full"
                  data-testid="badge-admin-messages-unread"
                >
                  {totalUnread} new
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Direct messages from the Local List 365 team
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : (
          threads!.map((t) => {
            const isOpen = openIds.has(t.businessId);
            const lastMsg = t.messages[t.messages.length - 1];
            return (
              <div
                key={t.businessId}
                className={`rounded-xl border ${t.unreadCount > 0 ? "border-[#0a4a82]/30 bg-[#0a4a82]/[0.03]" : "border-slate-200 bg-white"}`}
                data-testid={`admin-thread-${t.businessId}`}
              >
                <button
                  onClick={() => toggleOpen(t)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 rounded-xl transition-colors"
                  data-testid={`button-toggle-admin-thread-${t.businessId}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm truncate ${t.unreadCount > 0 ? "font-bold text-[#1a1a2e]" : "font-semibold text-slate-700"}`}
                      >
                        {t.businessName}
                      </span>
                      {t.unreadCount > 0 && (
                        <Badge className="bg-[#0a4a82] text-white text-[10px] h-5 min-w-5 px-1.5 rounded-full">
                          {t.unreadCount}
                        </Badge>
                      )}
                    </div>
                    {lastMsg && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        <span className="text-slate-400">
                          {lastMsg.senderRole === "admin"
                            ? "Admin: "
                            : "You: "}
                        </span>
                        {lastMsg.body}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatDistanceToNow(new Date(t.lastMessageAt), {
                      addSuffix: true,
                    })}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-2 bg-slate-50/40 rounded-b-xl">
                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                      {t.messages.map((m) => {
                        const fromAdmin = m.senderRole === "admin";
                        return (
                          <div
                            key={m.id}
                            className={`flex ${fromAdmin ? "justify-start" : "justify-end"}`}
                            data-testid={`admin-msg-${m.id}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm ${
                                fromAdmin
                                  ? "bg-white text-[#1a1a2e] border border-slate-200 rounded-bl-md"
                                  : "bg-[#0a4a82] text-white rounded-br-md"
                              }`}
                            >
                              {fromAdmin && (
                                <p className="text-[11px] font-semibold mb-0.5 text-[#0a4a82]">
                                  Local List 365 Admin
                                </p>
                              )}
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                {m.body}
                              </p>
                              <p
                                className={`text-[10px] mt-1 ${fromAdmin ? "text-slate-400" : "text-white/60"}`}
                              >
                                {format(new Date(m.createdAt), "MMM d, h:mm a")}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const body = (reply[t.businessId] ?? "").trim();
                        if (!body) return;
                        replyMutation.mutate({
                          businessId: t.businessId,
                          body,
                        });
                      }}
                      className="flex gap-2 pt-1"
                    >
                      <Textarea
                        value={reply[t.businessId] ?? ""}
                        onChange={(e) =>
                          setReply((r) => ({
                            ...r,
                            [t.businessId]: e.target.value,
                          }))
                        }
                        placeholder="Reply to admin…"
                        rows={2}
                        className="rounded-xl bg-white border-slate-200 resize-none text-sm"
                        style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                        data-testid={`input-admin-reply-${t.businessId}`}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={
                          replyMutation.isPending ||
                          !(reply[t.businessId] ?? "").trim()
                        }
                        className="bg-[#0a4a82] hover:bg-[#083a6a] rounded-xl px-3 self-stretch"
                        data-testid={`button-send-admin-reply-${t.businessId}`}
                      >
                        {replyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
