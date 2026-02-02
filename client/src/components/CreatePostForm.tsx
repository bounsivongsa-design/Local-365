import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertPostSchema } from "@shared/schema";
import { useCreatePost } from "@/hooks/use-posts";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Schema for the form
const formSchema = insertPostSchema.pick({ content: true, imageUrl: true });
type FormValues = z.infer<typeof formSchema>;

export function CreatePostForm() {
  const { user, isAuthenticated } = useAuth();
  const createPost = useCreatePost();
  const { toast } = useToast();

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
