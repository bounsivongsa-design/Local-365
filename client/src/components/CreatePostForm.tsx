import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertPostSchema } from "@shared/schema";
import { useCreatePost } from "@/hooks/use-posts";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Image as ImageIcon, ShieldAlert, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

// Schema for the form
const formSchema = insertPostSchema.pick({ content: true, imageUrl: true });
type FormValues = z.infer<typeof formSchema>;

interface ValidationStatus {
  isValidated: boolean;
}

export function CreatePostForm() {
  const { user, isAuthenticated } = useAuth();
  const createPost = useCreatePost();
  const { toast } = useToast();

  const { data: validationData } = useQuery<ValidationStatus>({
    queryKey: ["/api/user/validation-status"],
    enabled: isAuthenticated,
  });

  const isValidated = validationData?.isValidated || false;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
      imageUrl: "",
    },
  });

  const onSubmit = (data: FormValues) => {
    if (!isAuthenticated) return;
    
    createPost.mutate(data, {
      onSuccess: () => {
        form.reset();
        toast({
          title: "Posted!",
          description: "Your update has been shared with the community.",
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  if (!isAuthenticated) return null;

  // Show verification required message if not validated
  if (!isValidated) {
    return (
      <Card className="mb-8 border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 shadow-sm overflow-hidden" data-testid="card-verification-required">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                Verification Required
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                To post in the community, please verify your account by uploading a receipt or proof of purchase from a local Moyock business. Note: To leave a review for a specific business, you'll need to upload a receipt from that business.
              </p>
              <Link to="/dashboard">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="button-verify-account">
                  Verify Your Account
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8 border-border/60 shadow-sm overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="flex gap-4">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {user?.firstName?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-4">
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <Textarea
                placeholder="What's happening in the community?"
                className="min-h-[100px] resize-none border-none bg-muted/30 focus-visible:ring-0 px-0 text-base placeholder:text-muted-foreground/70"
                {...form.register("content")}
                data-testid="textarea-post-content"
              />
              
              <div className="flex items-center justify-between pt-2 border-t mt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-primary rounded-full"
                  onClick={() => toast({ title: "Coming soon", description: "Image uploads will be available soon!" })}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Add Photo
                </Button>
                
                <Button 
                  type="submit" 
                  disabled={createPost.isPending || !form.watch("content")}
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-post-update"
                >
                  {createPost.isPending ? "Posting..." : (
                    <>
                      Post Update
                      <Send className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
