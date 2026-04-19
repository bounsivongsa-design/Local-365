import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Mail,
  Send,
  Users,
  Clock,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AINewsletterAssist } from "@/components/AINewsletterAssist";

interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  source: string;
  optedInAt: string;
  createdAt: string;
}
interface Campaign {
  id: number;
  subject: string;
  bodyHtml: string;
  status: "draft" | "sending" | "sent" | "failed";
  recipientCount: number | null;
  successCount: number | null;
  failureCount: number | null;
  sentAt: string | null;
  createdAt: string;
}

export default function NewsletterPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const businessId = user?.linkedBusinessId ?? null;

  const [tab, setTab] = useState<string>("compose");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubEmail, setNewSubEmail] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const subsQuery = useQuery<{ subscribers: Subscriber[]; total: number }>({
    queryKey: ["/api/businesses", businessId, "newsletter/subscribers"],
    enabled: !!businessId,
  });

  const campaignsQuery = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["/api/businesses", businessId, "newsletter/campaigns"],
    enabled: !!businessId,
  });

  const addSubMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/businesses/${businessId}/newsletter/subscribers`,
        { email: newSubEmail.trim(), name: newSubName.trim() || undefined },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/businesses", businessId, "newsletter/subscribers"],
      });
      setNewSubEmail("");
      setNewSubName("");
      setShowAddSub(false);
      toast({ title: "Subscriber added" });
    },
    onError: (err: any) => {
      toast({ title: "Could not add subscriber", description: err?.message, variant: "destructive" });
    },
  });

  const removeSubMut = useMutation({
    mutationFn: async (subId: number) => {
      const res = await apiRequest(
        "DELETE",
        `/api/businesses/${businessId}/newsletter/subscribers/${subId}`,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/businesses", businessId, "newsletter/subscribers"],
      });
      toast({ title: "Subscriber removed" });
    },
  });

  const saveDraftMut = useMutation({
    mutationFn: async () => {
      if (draftId) {
        const res = await apiRequest(
          "PATCH",
          `/api/businesses/${businessId}/newsletter/campaigns/${draftId}`,
          { subject, bodyHtml },
        );
        return res.json();
      } else {
        const res = await apiRequest(
          "POST",
          `/api/businesses/${businessId}/newsletter/campaigns`,
          { subject, bodyHtml },
        );
        return res.json();
      }
    },
    onSuccess: (data: any) => {
      const id = data?.campaign?.id;
      if (id) setDraftId(id);
      queryClient.invalidateQueries({
        queryKey: ["/api/businesses", businessId, "newsletter/campaigns"],
      });
      toast({ title: "Draft saved" });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      let id = draftId;
      if (!id) {
        const created = await (await apiRequest(
          "POST",
          `/api/businesses/${businessId}/newsletter/campaigns`,
          { subject, bodyHtml },
        )).json();
        id = created?.campaign?.id;
      } else {
        await apiRequest(
          "PATCH",
          `/api/businesses/${businessId}/newsletter/campaigns/${id}`,
          { subject, bodyHtml },
        );
      }
      const res = await apiRequest(
        "POST",
        `/api/businesses/${businessId}/newsletter/campaigns/${id}/send`,
      );
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/businesses", businessId, "newsletter/campaigns"],
      });
      setSubject("");
      setBodyHtml("");
      setDraftId(null);
      setConfirmSendOpen(false);
      setTab("history");
      toast({
        title: "Newsletter sent!",
        description: `${data.sent ?? 0} delivered, ${data.failed ?? 0} failed.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err?.message, variant: "destructive" });
      setConfirmSendOpen(false);
    },
  });

  if (authLoading) {
    return <div className="container mx-auto p-8"><Skeleton className="h-64 w-full" /></div>;
  }
  if (!isAuthenticated || !businessId) {
    return (
      <div className="container mx-auto p-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Email Newsletter</CardTitle>
            <CardDescription>
              For Gold business owners. Replace Mailchimp by emailing your past customers
              right from Local List 365.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              You need to be logged in as a business owner to use the newsletter tool.
            </p>
            <Button asChild data-testid="button-newsletter-signin">
              <Link to="/auth">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeSubs = subsQuery.data?.subscribers ?? [];
  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const canSend = subject.trim().length >= 2 && bodyHtml.trim().length >= 10 && activeSubs.length > 0;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2 text-[#0a4a82]">
          <Mail className="h-7 w-7" />
          Email Newsletter
        </h1>
        <p className="text-muted-foreground mt-1">
          Stay in front of your past customers — for free as part of your Gold membership.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="compose" data-testid="tab-compose">
            <Send className="h-4 w-4 mr-1" /> Compose
          </TabsTrigger>
          <TabsTrigger value="subscribers" data-testid="tab-subscribers">
            <Users className="h-4 w-4 mr-1" /> Subscribers ({activeSubs.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="h-4 w-4 mr-1" /> History
          </TabsTrigger>
        </TabsList>

        {/* COMPOSE */}
        <TabsContent value="compose" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle>New Newsletter</CardTitle>
                  <CardDescription>
                    Will send to {activeSubs.length} active subscriber{activeSubs.length === 1 ? "" : "s"}.
                  </CardDescription>
                </div>
                <AINewsletterAssist
                  businessId={businessId}
                  onAccept={(d) => { setSubject(d.subject); setBodyHtml(d.bodyHtml); }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="news-subject">Subject</Label>
                <Input
                  id="news-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="A spring tune-up special for our regulars"
                  maxLength={200}
                  data-testid="input-news-subject"
                />
              </div>
              <div>
                <Label htmlFor="news-body">Email body (HTML allowed)</Label>
                <Textarea
                  id="news-body"
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  placeholder="Hi neighbor,&#10;&#10;Spring is here, and we're booking up fast..."
                  rows={12}
                  className="font-mono text-sm"
                  data-testid="input-news-body"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use simple HTML like &lt;p&gt;, &lt;strong&gt;, &lt;a href="..."&gt;. We'll add your
                  business address &amp; an unsubscribe link automatically.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewing(true)}
                  disabled={!bodyHtml.trim()}
                  data-testid="button-preview-news"
                >
                  Preview
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => saveDraftMut.mutate()}
                  disabled={!subject.trim() || !bodyHtml.trim() || saveDraftMut.isPending}
                  data-testid="button-save-draft"
                >
                  {saveDraftMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save draft
                </Button>
                <Button
                  type="button"
                  onClick={() => setConfirmSendOpen(true)}
                  disabled={!canSend || sendMut.isPending}
                  data-testid="button-send-news"
                  className="bg-[#0a4a82] hover:bg-[#0d5a9e]"
                >
                  {sendMut.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" />Send now</>
                  )}
                </Button>
              </div>
              {activeSubs.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>You don't have any subscribers yet. As customers request quotes or
                  leave reviews they'll be added automatically — or add some manually in the
                  <strong> Subscribers </strong> tab.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUBSCRIBERS */}
        <TabsContent value="subscribers" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Subscribers</CardTitle>
                  <CardDescription>
                    Auto-built from people who've requested quotes from you or left a
                    review. CAN-SPAM compliant — every email has an unsubscribe link.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAddSub(true)}
                  data-testid="button-add-subscriber"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {subsQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : activeSubs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No subscribers yet. They'll appear here as customers interact with your business.
                </p>
              ) : (
                <div className="divide-y border rounded-lg">
                  {activeSubs.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3"
                      data-testid={`row-subscriber-${s.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate" data-testid={`text-sub-email-${s.id}`}>
                          {s.email}
                        </div>
                        {s.name && <div className="text-xs text-muted-foreground truncate">{s.name}</div>}
                      </div>
                      <Badge variant="secondary" className="mr-3 capitalize text-xs">
                        {s.source.replace("_", " ")}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSubMut.mutate(s.id)}
                        disabled={removeSubMut.isPending}
                        data-testid={`button-remove-sub-${s.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Past Newsletters</CardTitle>
              <CardDescription>Every campaign you've sent.</CardDescription>
            </CardHeader>
            <CardContent>
              {campaignsQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nothing sent yet. Compose your first newsletter in the Compose tab.
                </p>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((c) => (
                    <div
                      key={c.id}
                      className="border rounded-lg p-3 flex items-center justify-between gap-3"
                      data-testid={`row-campaign-${c.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" data-testid={`text-campaign-subject-${c.id}`}>
                          {c.subject}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {c.sentAt
                            ? new Date(c.sentAt).toLocaleString()
                            : `Draft created ${new Date(c.createdAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.status === "sent" && (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {c.successCount ?? 0} sent
                          </Badge>
                        )}
                        {c.status === "draft" && <Badge variant="secondary">Draft</Badge>}
                        {c.status === "sending" && <Badge variant="secondary">Sending…</Badge>}
                        {c.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add subscriber dialog */}
      <Dialog open={showAddSub} onOpenChange={setShowAddSub}>
        <DialogContent data-testid="dialog-add-subscriber">
          <DialogHeader><DialogTitle>Add a subscriber</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="add-sub-email">Email</Label>
              <Input
                id="add-sub-email"
                type="email"
                value={newSubEmail}
                onChange={(e) => setNewSubEmail(e.target.value)}
                placeholder="customer@example.com"
                data-testid="input-add-sub-email"
              />
            </div>
            <div>
              <Label htmlFor="add-sub-name">Name (optional)</Label>
              <Input
                id="add-sub-name"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                data-testid="input-add-sub-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSub(false)}>Cancel</Button>
            <Button
              onClick={() => addSubMut.mutate()}
              disabled={!newSubEmail.trim() || addSubMut.isPending}
              data-testid="button-confirm-add-sub"
            >
              {addSubMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent className="max-w-2xl" data-testid="dialog-preview">
          <DialogHeader><DialogTitle>{subject || "(no subject)"}</DialogTitle></DialogHeader>
          <div
            className="border rounded-lg p-4 prose prose-sm max-w-none bg-white dark:bg-zinc-900"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
          <p className="text-xs text-muted-foreground">
            (Footer with your business address &amp; unsubscribe link is added on send.)
          </p>
        </DialogContent>
      </Dialog>

      {/* Send-confirm dialog */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent data-testid="dialog-confirm-send">
          <DialogHeader><DialogTitle>Send this newsletter?</DialogTitle></DialogHeader>
          <p className="text-sm">
            This will email <strong>{activeSubs.length}</strong> active subscriber
            {activeSubs.length === 1 ? "" : "s"}. You can't undo a send.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSendOpen(false)}>Cancel</Button>
            <Button
              onClick={() => sendMut.mutate()}
              disabled={sendMut.isPending}
              className="bg-[#0a4a82] hover:bg-[#0d5a9e]"
              data-testid="button-confirm-send"
            >
              {sendMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send to {activeSubs.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
