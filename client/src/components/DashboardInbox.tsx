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
  Search,
  PenSquare,
  Loader2,
  Clock,
  Gavel,
  User,
  Building2,
  Mail,
  Circle,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface InboxThread {
  type: "quote" | "direct";
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

interface SearchUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  accountType: string | null;
  linkedBusinessId: number | null;
  businessName: string | null;
}

export function DashboardInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<InboxThread | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [composeRecipient, setComposeRecipient] = useState<SearchUser | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [filterType, setFilterType] = useState<"all" | "quote" | "direct">("all");

  const { data: inbox, isLoading: inboxLoading } = useQuery<InboxThread[]>({
    queryKey: ["/api/messages/inbox"],
    refetchInterval: 15000,
  });

  const filteredInbox = inbox?.filter(t => filterType === "all" || t.type === filterType) || [];

  const { data: threadMessages, isLoading: messagesLoading } = useQuery<MessageItem[]>({
    queryKey: selectedThread?.type === "direct"
      ? ["/api/messages/direct", selectedThread?.threadId]
      : ["/api/quotes", selectedThread?.threadId, "messages"],
    queryFn: async () => {
      if (!selectedThread) return [];
      const url = selectedThread.type === "direct"
        ? `/api/messages/direct/${selectedThread.threadId}`
        : `/api/quotes/${selectedThread.threadId}/messages`;
      const res = await fetch(url, { credentials: "include" });
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
      const url = selectedThread.type === "direct"
        ? `/api/messages/direct/${selectedThread.threadId}`
        : `/api/quotes/${selectedThread.threadId}/messages`;
      const res = await apiRequest("POST", url, { message });
      return res.json();
    },
    onSuccess: () => {
      const key = selectedThread?.type === "direct"
        ? ["/api/messages/direct", selectedThread?.threadId]
        : ["/api/quotes", selectedThread?.threadId, "messages"];
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/message-counts"] });
      setNewMessage("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
  });

  const { data: searchResults } = useQuery<SearchUser[]>({
    queryKey: ["/api/messages/users/search", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const res = await fetch(`/api/messages/users/search?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const composeMutation = useMutation({
    mutationFn: async (data: { recipientId: string; subject: string; message: string }) => {
      const res = await apiRequest("POST", "/api/messages/new", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/message-counts"] });
      setIsComposeOpen(false);
      setComposeRecipient(null);
      setComposeSubject("");
      setComposeMessage("");
      setSearchQuery("");
      toast({ title: "Message sent!", description: "Your message has been delivered." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMutation.mutate(newMessage.trim());
  };

  const handleCompose = () => {
    if (!composeRecipient || !composeMessage.trim()) return;
    composeMutation.mutate({
      recipientId: composeRecipient.id,
      subject: composeSubject.trim(),
      message: composeMessage.trim(),
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
              <p className="text-xs text-muted-foreground truncate">
                {selectedThread.type === "quote" ? (
                  <span className="flex items-center gap-1">
                    <Gavel className="h-3 w-3" />
                    {selectedThread.subject || "Quote Discussion"}
                  </span>
                ) : (
                  selectedThread.subject || "Direct Message"
                )}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`text-xs ${selectedThread.type === "quote" ? "border-[#d4a373] text-[#d4a373]" : "border-[#0a4a82] text-[#0a4a82]"}`}
            >
              {selectedThread.type === "quote" ? "Quote" : "Direct"}
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
                      <p className={`text-xs font-medium mb-1 ${isMe ? "text-white/70" : "text-[#0a4a82]"}`}>
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
                Messages
              </CardTitle>
              <CardDescription className="mt-1">Your conversations with customers and businesses</CardDescription>
            </div>
            <Button
              onClick={() => setIsComposeOpen(true)}
              size="sm"
              className="bg-[#0a4a82] hover:bg-[#083a6a] rounded-xl gap-1.5"
              data-testid="button-compose-message"
            >
              <PenSquare className="h-3.5 w-3.5" />
              New Message
            </Button>
          </div>

          <div className="flex gap-1.5 mt-3">
            {(["all", "direct", "quote"] as const).map((type) => (
              <Button
                key={type}
                variant={filterType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType(type)}
                className={`rounded-full text-xs h-7 ${
                  filterType === type
                    ? "bg-[#0a4a82] hover:bg-[#083a6a]"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                data-testid={`button-filter-${type}`}
              >
                {type === "all" ? (
                  <><Mail className="h-3 w-3 mr-1" /> All</>
                ) : type === "direct" ? (
                  <><MessageSquare className="h-3 w-3 mr-1" /> Direct</>
                ) : (
                  <><Gavel className="h-3 w-3 mr-1" /> Quotes</>
                )}
              </Button>
            ))}
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
          ) : filteredInbox.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-[#0a4a82]/5 flex items-center justify-center mx-auto mb-4">
                <Inbox className="h-8 w-8 text-[#0a4a82]/40" />
              </div>
              <h3 className="font-semibold text-[#1a1a2e] mb-1">No messages yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {filterType === "all"
                  ? "Start a conversation or submit a quote to begin messaging."
                  : filterType === "direct"
                  ? "No direct messages yet. Send one to get started!"
                  : "No quote conversations yet. Submit or receive a quote to start."}
              </p>
              <Button
                onClick={() => setIsComposeOpen(true)}
                variant="outline"
                className="rounded-xl border-[#0a4a82]/20 text-[#0a4a82]"
                data-testid="button-compose-empty"
              >
                <PenSquare className="h-4 w-4 mr-2" />
                Send a Message
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredInbox.map((thread) => {
                const isUnread = thread.unreadCount > 0;
                return (
                  <button
                    key={`${thread.type}-${thread.threadId}`}
                    onClick={() => setSelectedThread(thread)}
                    className={`w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center gap-3 group rounded-xl ${
                      isUnread ? "bg-[#0a4a82]/[0.03]" : ""
                    }`}
                    data-testid={`thread-${thread.type}-${thread.threadId}`}
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
                        {thread.type === "quote" && (
                          <Gavel className="h-3 w-3 text-[#d4a373] shrink-0" />
                        )}
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

      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1a1a2e]">
              <PenSquare className="h-5 w-5 text-[#0a4a82]" />
              New Message
            </DialogTitle>
            <DialogDescription>
              Send a direct message to a customer or business
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!composeRecipient ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-xl"
                    style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                    data-testid="input-search-recipient"
                  />
                </div>
                {searchResults && searchResults.length > 0 && (
                  <div className="border rounded-xl overflow-hidden divide-y">
                    {searchResults.filter(u => u.id !== user?.id).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setComposeRecipient(u);
                          setSearchQuery("");
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 flex items-center gap-3"
                        data-testid={`recipient-${u.id}`}
                      >
                        <Avatar className="h-8 w-8 border">
                          <AvatarFallback className="bg-[#0a4a82]/10 text-[#0a4a82] text-xs">
                            {u.firstName?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-[#1a1a2e]">
                            {u.firstName} {u.lastName}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {u.businessName && (
                              <span className="text-xs text-[#d4a373] flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {u.businessName}
                              </span>
                            )}
                            {!u.businessName && u.accountType && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {u.accountType === "business" ? "Business" : "Customer"}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && searchResults && searchResults.filter(u => u.id !== user?.id).length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-4">No users found</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <Avatar className="h-8 w-8 border">
                    <AvatarFallback className="bg-[#0a4a82]/10 text-[#0a4a82] text-xs">
                      {composeRecipient.firstName?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {composeRecipient.firstName} {composeRecipient.lastName}
                    </p>
                    {composeRecipient.businessName && (
                      <p className="text-xs text-[#d4a373]">{composeRecipient.businessName}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setComposeRecipient(null)}
                    className="text-xs text-slate-400"
                    data-testid="button-change-recipient"
                  >
                    Change
                  </Button>
                </div>
                <Input
                  placeholder="Subject (optional)"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="rounded-xl"
                  style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                  data-testid="input-compose-subject"
                />
                <Textarea
                  placeholder="Write your message..."
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  className="rounded-xl min-h-[120px] resize-none"
                  style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                  data-testid="input-compose-message"
                />
              </>
            )}
          </div>

          {composeRecipient && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsComposeOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCompose}
                disabled={composeMutation.isPending || !composeMessage.trim()}
                className="bg-[#0a4a82] hover:bg-[#083a6a] rounded-xl gap-1.5"
                data-testid="button-send-compose"
              >
                {composeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
