import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Inbox,
  MessageSquare,
  Send,
  ArrowLeft,
  Loader2,
  Clock,
  Gavel,
  Circle,
  ShieldCheck,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface InboxThread {
  type: "quote";
  threadId: number;
  subject: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  otherUserId: string;
  unreadCount: number;
  otherUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    accountType: string | null;
    linkedBusinessId: number | null;
    businessName: string | null;
  } | null;
}

interface MessageItem {
  id: number;
  senderId: string;
  message: string;
  createdAt: string;
  senderFirstName: string | null;
  senderLastName: string | null;
  senderAccountType: string | null;
  readAt: string | null;
}

export function DashboardInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<InboxThread | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isContactAdminOpen, setIsContactAdminOpen] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminSubject, setAdminSubject] = useState("");
  const [adminMessage, setAdminMessage] = useState("");

  const { data: inbox, isLoading: inboxLoading } = useQuery<InboxThread[]>({
    queryKey: ["/api/messages/inbox"],
    refetchInterval: 15000,
  });

  const { data: threadMessages, isLoading: messagesLoading } = useQuery<MessageItem[]>({
    queryKey: ["/api/quotes", selectedThread?.threadId, "messages"],
    queryFn: async () => {
      if (!selectedThread) return [];
      const res = await fetch(`/api/quotes/${selectedThread.threadId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/user/message-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
      return data;
    },
    enabled: selectedThread !== null,
    refetchInterval: 8000,
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedThread) throw new Error("No thread selected");
      const res = await apiRequest("POST", `/api/quotes/${selectedThread.threadId}/messages`, { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", selectedThread?.threadId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/message-counts"] });
      setNewMessage("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
  });

  const contactAdminMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; subject: string; message: string }) => {
      const res = await apiRequest("POST", "/api/admin-submissions", data);
      return res.json();
    },
    onSuccess: () => {
      setIsContactAdminOpen(false);
      setAdminName("");
      setAdminEmail("");
      setAdminSubject("");
      setAdminMessage("");
      toast({ title: "Submitted!", description: "Your message has been sent to the admin team. We'll get back to you soon." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMutation.mutate(newMessage.trim());
  };

  const handleContactAdmin = () => {
    if (!adminName.trim() || !adminEmail.trim() || !adminSubject.trim() || !adminMessage.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    contactAdminMutation.mutate({
      name: adminName.trim(),
      email: adminEmail.trim(),
      subject: adminSubject.trim(),
      message: adminMessage.trim(),
    });
  };

  const getDisplayName = (thread: InboxThread) => {
    if (thread.otherUser?.businessName) return thread.otherUser.businessName;
    if (thread.otherUser?.firstName) return `${thread.otherUser.firstName} ${thread.otherUser.lastName || ""}`.trim();
    return "Unknown User";
  };

  const getInitials = (thread: InboxThread) => {
    if (thread.otherUser?.businessName) return thread.otherUser.businessName.charAt(0);
    if (thread.otherUser?.firstName) return thread.otherUser.firstName.charAt(0);
    return "?";
  };

  if (selectedThread) {
    return (
      <Card className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10 h-[600px] flex flex-col">
        <CardHeader className="pb-3 border-b border-[#0a4a82]/10 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedThread(null)}
              className="h-8 w-8 p-0 hover:bg-[#0a4a82]/10"
              data-testid="button-back-to-inbox"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar className="h-9 w-9 border border-[#0a4a82]/20">
              <AvatarImage src={selectedThread.otherUser?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-[#0a4a82]/10 text-[#0a4a82] text-sm font-semibold">
                {getInitials(selectedThread)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#1a1a2e] text-sm truncate" data-testid="text-thread-name">
                {getDisplayName(selectedThread)}
              </h3>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <Gavel className="h-3 w-3" />
                {selectedThread.subject || "Quote Discussion"}
              </p>
            </div>
            <Badge variant="outline" className="text-xs border-[#d4a373] text-[#d4a373]">
              Quote
            </Badge>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {messagesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#0a4a82]" />
            </div>
          ) : threadMessages && threadMessages.length > 0 ? (
            threadMessages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    isMe
                      ? "bg-[#0a4a82] text-white rounded-br-md"
                      : "bg-white text-[#1a1a2e] border border-slate-200 rounded-bl-md"
                  }`}>
                    {!isMe && (
                      <p className={`text-xs font-medium mb-1 text-[#0a4a82]`}>
                        {msg.senderFirstName || "User"} {msg.senderLastName?.charAt(0) || ""}.
                        {msg.senderAccountType === "business" && (
                          <span className="ml-1 text-[#d4a373]">Business</span>
                        )}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    {msg.createdAt && (
                      <p className={`text-[10px] mt-1.5 ${isMe ? "text-white/50" : "text-slate-400"}`}>
                        {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-400">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="p-3 border-t border-[#0a4a82]/10 bg-white shrink-0 flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-xl bg-slate-50 border-slate-200"
            style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
            data-testid="input-thread-message"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sendMutation.isPending || !newMessage.trim()}
            className="bg-[#0a4a82] hover:bg-[#083a6a] rounded-xl px-4"
            data-testid="button-send-thread-message"
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-[#1a1a2e]">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0a4a82] to-[#0a4a82]/70 flex items-center justify-center">
                  <Inbox className="h-4 w-4 text-white" />
                </div>
                Quote Messages
              </CardTitle>
              <CardDescription className="mt-1">Your conversations from quote requests</CardDescription>
            </div>
            <Button
              onClick={() => {
                setIsContactAdminOpen(true);
                if (user) {
                  setAdminName(`${user.firstName || ""} ${user.lastName || ""}`.trim());
                  setAdminEmail(user.email || "");
                }
              }}
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5 border-[#0a4a82]/20 text-[#0a4a82] hover:bg-[#0a4a82]/5"
              data-testid="button-contact-admin"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Contact Admin
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {inboxLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !inbox || inbox.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-[#0a4a82]/5 flex items-center justify-center mx-auto mb-4">
                <Inbox className="h-8 w-8 text-[#0a4a82]/40" />
              </div>
              <h3 className="font-semibold text-[#1a1a2e] mb-1">No quote messages yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Submit or receive a quote to start messaging with businesses.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {inbox.map((thread) => {
                const isUnread = thread.unreadCount > 0;
                return (
                  <button
                    key={`quote-${thread.threadId}`}
                    onClick={() => setSelectedThread(thread)}
                    className={`w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center gap-3 group rounded-xl ${
                      isUnread ? "bg-[#0a4a82]/[0.03]" : ""
                    }`}
                    data-testid={`thread-quote-${thread.threadId}`}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10 border border-slate-200">
                        <AvatarImage src={thread.otherUser?.profileImageUrl || undefined} />
                        <AvatarFallback className="bg-[#0a4a82]/10 text-[#0a4a82] text-sm font-semibold">
                          {getInitials(thread)}
                        </AvatarFallback>
                      </Avatar>
                      {isUnread && (
                        <Circle className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 fill-[#0a4a82] text-[#0a4a82]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${isUnread ? "font-bold text-[#1a1a2e]" : "font-medium text-slate-700"}`}>
                          {getDisplayName(thread)}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {thread.lastMessageAt && formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Gavel className="h-3 w-3 text-[#d4a373] shrink-0" />
                        <p className={`text-xs truncate ${isUnread ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                          {thread.subject && <span className="text-slate-400">{thread.subject}: </span>}
                          {thread.lastSenderId === user?.id ? "You: " : ""}
                          {thread.lastMessage}
                        </p>
                      </div>
                    </div>
                    {isUnread && (
                      <Badge className="bg-[#0a4a82] text-white text-[10px] h-5 min-w-5 px-1.5 rounded-full shrink-0">
                        {thread.unreadCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isContactAdminOpen} onOpenChange={setIsContactAdminOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1a1a2e]">
              <ShieldCheck className="h-5 w-5 text-[#0a4a82]" />
              Contact Admin
            </DialogTitle>
            <DialogDescription>
              Send a message to the LocalList365 admin team. We'll respond as soon as possible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Input
              placeholder="Your name"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="rounded-xl bg-white"
              style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
              data-testid="input-admin-name"
            />
            <Input
              placeholder="Your email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="rounded-xl bg-white"
              style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
              data-testid="input-admin-email"
            />
            <Input
              placeholder="Subject"
              value={adminSubject}
              onChange={(e) => setAdminSubject(e.target.value)}
              className="rounded-xl bg-white"
              style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
              data-testid="input-admin-subject"
            />
            <Textarea
              placeholder="Write your message..."
              value={adminMessage}
              onChange={(e) => setAdminMessage(e.target.value)}
              className="rounded-xl min-h-[120px] resize-none bg-white"
              style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
              data-testid="input-admin-message"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsContactAdminOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleContactAdmin}
              disabled={contactAdminMutation.isPending}
              className="bg-[#0a4a82] hover:bg-[#083a6a] rounded-xl gap-1.5"
              data-testid="button-send-admin-message"
            >
              {contactAdminMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
