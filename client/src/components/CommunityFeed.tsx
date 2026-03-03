import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MapPin, Calendar, Trophy, Heart, TrendingUp, MessageCircle, CheckCircle2, Award, Crown, Gem, Users, Send, Sparkles, Flame, MessageSquare, HelpingHand, ChevronDown, ChevronUp } from "lucide-react";
import BestOfGrid from "./BestOfGrid";
import BestOfEditor from "./BestOfEditor";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CommentWithAuthor {
  id: number;
  postId: number;
  content: string;
  likes: number;
  createdAt: string;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    loyaltyTier: string | null;
    isValidated: boolean | null;
    engagementBadge: string | null;
  } | null;
}

interface PostWithAuthor {
  id: number;
  content: string;
  imageUrl: string | null;
  likes: number;
  commentCount: number;
  createdAt: string;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    loyaltyTier: string | null;
    isValidated: boolean | null;
    engagementBadge: string | null;
  } | null;
}

const tierConfig: Record<string, { label: string; color: string; icon: typeof Users; gradient: string }> = {
  member: { label: 'Member', color: 'bg-slate-500', icon: Users, gradient: 'from-slate-500 to-slate-600' },
  silver: { label: 'Silver', color: 'bg-gray-400', icon: Award, gradient: 'from-gray-300 to-gray-500' },
  gold: { label: 'Gold', color: 'bg-amber-500', icon: Star, gradient: 'from-amber-400 to-amber-600' },
  platinum: { label: 'Platinum', color: 'bg-cyan-500', icon: Crown, gradient: 'from-cyan-400 to-cyan-600' },
  ambassador: { label: 'Ambassador', color: 'bg-purple-500', icon: Gem, gradient: 'from-purple-400 to-purple-600' },
};

const engagementBadgeConfig: Record<string, { label: string; icon: typeof Sparkles; gradient: string; description: string }> = {
  top_contributor: { 
    label: 'Top Contributor', 
    icon: Sparkles, 
    gradient: 'from-amber-500 to-orange-500',
    description: '50+ comments or 20+ posts'
  },
  conversation_starter: { 
    label: 'Conversation Starter', 
    icon: MessageSquare, 
    gradient: 'from-blue-500 to-indigo-500',
    description: '10+ posts created'
  },
  rising_star: { 
    label: 'Rising Star', 
    icon: Flame, 
    gradient: 'from-rose-500 to-pink-500',
    description: '20+ comments or 5+ posts'
  },
  helpful_neighbor: { 
    label: 'Helpful Neighbor', 
    icon: HelpingHand, 
    gradient: 'from-green-500 to-emerald-500',
    description: '5+ helpful comments'
  },
};

function CommentSection({ postId, commentCount }: { postId: number; commentCount: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments, isLoading: commentsLoading } = useQuery<CommentWithAuthor[]>({
    queryKey: ["/api/posts", postId, "comments"],
    queryFn: () => fetch(`/api/posts/${postId}/comments`).then(res => res.json()),
    enabled: isExpanded,
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", `/api/posts/${postId}/comments`, { content });
      return response.json();
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: "Comment posted",
        description: "Your comment has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to post comment. You must be verified to comment.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment.trim());
  };

  const getEngagementBadge = (badge: string | null | undefined) => {
    if (!badge) return null;
    const config = engagementBadgeConfig[badge];
    if (!config) return null;
    const IconComponent = config.icon;
    return (
      <Badge className={`bg-gradient-to-r ${config.gradient} text-white border-0 text-xs font-semibold shadow-sm`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="border-t border-slate-100 dark:border-slate-800">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        data-testid={`button-toggle-comments-${postId}`}
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            {commentCount} {commentCount === 1 ? 'Comment' : 'Comments'}
          </span>
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {isAuthenticated && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-[#0a4a82] to-[#083a6a] text-white text-xs">
                  {user?.firstName?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="resize-none text-sm min-h-[60px]"
                  data-testid={`input-comment-${postId}`}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || createCommentMutation.isPending}
                    data-testid={`button-submit-comment-${postId}`}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {createCommentMutation.isPending ? "Posting..." : "Comment"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isAuthenticated && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Sign in to join the conversation
            </p>
          )}

          {commentsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => {
                const authorName = comment.author 
                  ? `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || 'Anonymous'
                  : 'Anonymous';
                const initials = comment.author 
                  ? `${comment.author.firstName?.[0] || ''}${comment.author.lastName?.[0] || ''}`.toUpperCase()
                  : 'A';
                
                return (
                  <div key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.author?.profileImageUrl || undefined} alt={authorName} />
                        <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-500 text-white text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      {comment.author?.isValidated && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#0a4a82] rounded-full flex items-center justify-center ring-1 ring-white dark:ring-slate-800">
                          <CheckCircle2 className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">{authorName}</span>
                          {getEngagementBadge(comment.author?.engagementBadge)}
                        </div>
                        <p className="text-sm text-foreground">{comment.content}</p>
                      </div>
                      <div className="flex items-center gap-4 mt-1 px-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                        <button className="text-xs text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          Like
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Be the first to share your thoughts!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CommunityFeed() {
  const [activeTab, setActiveTab] = useState<'feed' | 'bestof' | 'events'>('feed');
  const { isAuthenticated } = useAuth();

  const { data: posts, isLoading: postsLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ["/api/posts"],
  });

  const upcomingEvents = [
    { title: "Community Farmers Market", date: "Feb 7, 2026", location: "Town Square, Moyock", description: "Fresh veggies, local crafts, and live music.", image: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&h=300&fit=crop" },
    { title: "Currituck Home & Garden Show", date: "Feb 15, 2026", location: "Currituck Community Center", description: "Meet local contractors and home service providers.", image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop" },
    { title: "Wright Brothers Day", date: "Dec 17, 2026", location: "Wright Brothers Memorial", description: "Celebrate the anniversary of powered flight.", image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300&fit=crop" },
  ];

  const getTierBadge = (tier: string | null) => {
    if (!tier || tier === 'member') return null;
    const config = tierConfig[tier] || tierConfig.member;
    const IconComponent = config.icon;
    return (
      <Badge className={`bg-gradient-to-r ${config.gradient} text-white border-0 text-xs font-semibold shadow-sm`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getEngagementBadge = (badge: string | null | undefined) => {
    if (!badge) return null;
    const config = engagementBadgeConfig[badge];
    if (!config) return null;
    const IconComponent = config.icon;
    return (
      <Badge className={`bg-gradient-to-r ${config.gradient} text-white border-0 text-xs font-semibold shadow-sm`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="py-8">
      <div className="flex items-center gap-6 border-b mb-6 pb-2 bg-white dark:bg-card rounded-xl px-4 py-3 shadow-sm">
        <button 
          onClick={() => setActiveTab('feed')} 
          data-testid="tab-feed"
          className={`flex items-center gap-2 pb-2 border-b-2 transition ${activeTab === 'feed' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <TrendingUp className="h-4 w-4" />
          Community Feed
        </button>
        <button 
          onClick={() => setActiveTab('bestof')} 
          data-testid="tab-bestof"
          className={`flex items-center gap-2 pb-2 border-b-2 transition ${activeTab === 'bestof' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Trophy className="h-4 w-4" />
          Best of Currituck
        </button>
        <button 
          onClick={() => setActiveTab('events')} 
          data-testid="tab-events"
          className={`flex items-center gap-2 pb-2 border-b-2 transition ${activeTab === 'events' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Calendar className="h-4 w-4" />
          Events
        </button>
      </div>

      {activeTab === 'feed' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <h2 className="text-2xl font-bold text-foreground bg-white dark:bg-card rounded-lg px-4 py-2 inline-block shadow-sm">What's Happening in Currituck</h2>
          
          {postsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-6">
              {posts.map((post) => {
                const authorName = post.author 
                  ? `${post.author.firstName || ''} ${post.author.lastName || ''}`.trim() || 'Anonymous'
                  : 'Anonymous';
                const initials = post.author 
                  ? `${post.author.firstName?.[0] || ''}${post.author.lastName?.[0] || ''}`.toUpperCase()
                  : 'A';
                
                return (
                  <Card key={post.id} className="overflow-hidden shadow-lg shadow-black/5 hover:shadow-xl transition-shadow duration-300" data-testid={`post-${post.id}`}>
                    <div className="p-5 pb-4">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-slate-800 shadow-md">
                            <AvatarImage src={post.author?.profileImageUrl || undefined} alt={authorName} />
                            <AvatarFallback className="bg-gradient-to-br from-[#0a4a82] to-[#083a6a] text-white font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          {post.author?.isValidated && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#0a4a82] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground">{authorName}</span>
                            {post.author?.isValidated && (
                              <span className="text-[#0a4a82] text-xs font-medium">Verified</span>
                            )}
                            {getTierBadge(post.author?.loyaltyTier || null)}
                            {getEngagementBadge(post.author?.engagementBadge)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      
                      <p className="text-foreground mt-4 leading-relaxed">{post.content}</p>
                    </div>
                    
                    {post.imageUrl && (
                      <div className="relative">
                        <img 
                          src={post.imageUrl} 
                          alt="Post image" 
                          className="w-full h-64 object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-6">
                      <button className="flex items-center gap-2 text-muted-foreground hover:text-rose-500 transition-colors group" data-testid={`button-like-${post.id}`}>
                        <Heart className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">{post.likes}</span>
                      </button>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <MessageCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">{post.commentCount || 0}</span>
                      </span>
                    </div>
                    
                    <CommentSection postId={post.id} commentCount={post.commentCount || 0} />
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No posts yet</h3>
              <p className="text-muted-foreground">Be the first to share something with the community!</p>
            </Card>
          )}
          
          <h3 className="text-xl font-bold mt-8 mb-4 text-foreground bg-white dark:bg-card rounded-lg px-4 py-2 inline-block shadow-sm">Local Gems</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="overflow-hidden shadow-lg shadow-black/5">
              <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=400" alt="Green Leaf Market" className="w-full h-32 object-cover" />
              <div className="p-4">
                <h4 className="font-bold">Currituck Pier</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Moyock
                  <Star className="h-3 w-3 ml-2 text-yellow-500" /> 4.8
                </p>
              </div>
            </Card>
            <Card className="overflow-hidden shadow-lg shadow-black/5">
              <img src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400" alt="The Daily Grind" className="w-full h-32 object-cover" />
              <div className="p-4">
                <h4 className="font-bold">Duck Donuts</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Duck
                  <Star className="h-3 w-3 ml-2 text-yellow-500" /> 4.9
                </p>
              </div>
            </Card>
            <Card className="overflow-hidden shadow-lg shadow-black/5">
              <img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400" alt="Yoga Studio" className="w-full h-32 object-cover" />
              <div className="p-4">
                <h4 className="font-bold">Serenity Wellness</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Duck
                  <Star className="h-3 w-3 ml-2 text-yellow-500" /> 4.7
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'bestof' && (
        <div className="py-8 animate-in fade-in duration-300">
          <h2 className="text-3xl font-bold mb-6">Best of Currituck 2026</h2>
          <p className="mb-8 text-muted-foreground">Celebrating the top local businesses based on verified reviews & performance.</p>
          <BestOfGrid />
          
          {isAuthenticated && (
            <div className="mt-12 pt-8 border-t">
              <BestOfEditor />
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="animate-in fade-in duration-300">
          <h2 className="text-2xl font-bold mb-6">Upcoming Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event, index) => (
              <Card key={index} className="overflow-hidden shadow-lg shadow-black/5">
                <img src={event.image} alt={event.title} className="w-full h-40 object-cover" />
                <div className="p-4">
                  <div className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
                    <Calendar className="h-4 w-4" />
                    {event.date}
                  </div>
                  <h4 className="font-bold text-lg">{event.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {event.location}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityFeed;
