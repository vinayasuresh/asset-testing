import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { authenticatedRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";

interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

interface TicketCommentDialogProps {
  ticketId: string;
  ticketNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketCommentDialog({ ticketId, ticketNumber, open, onOpenChange }: TicketCommentDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");

  const { data: comments = [], isLoading } = useQuery<TicketComment[]>({
    queryKey: [`/api/tickets/${ticketId}/comments`],
    queryFn: async () => {
      const response = await authenticatedRequest("GET", `/api/tickets/${ticketId}/comments`);
      return response.json();
    },
    enabled: open && !!ticketId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await authenticatedRequest("POST", `/api/tickets/${ticketId}/comments`, {
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}/comments`] });
      setNewComment("");
      toast({
        title: "Comment added",
        description: "Your comment has been successfully added.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to add comment",
        description: "There was an error adding your comment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!newComment.trim()) {
      toast({
        title: "Empty comment",
        description: "Please enter a comment before submitting.",
        variant: "destructive",
      });
      return;
    }
    addCommentMutation.mutate(newComment);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super-admin":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "admin":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "it-manager":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "technician":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const formatRole = (role?: string) => {
    if (!role) return 'Unknown Role';
    return role.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments - Ticket #{ticketNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 min-h-0">
          {/* Comments List */}
          <ScrollArea className="flex-1 pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No comments yet</p>
                <p className="text-sm">Be the first to comment on this ticket</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div 
                    key={comment.id} 
                    className="bg-surface/50 border border-white/10 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary">
                          {comment.authorName}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getRoleBadgeColor(comment.authorRole)}`}>
                          {formatRole(comment.authorRole)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-text-secondary whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Add Comment Form */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <Textarea
              placeholder="Write your comment here..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[100px] resize-none"
              disabled={addCommentMutation.isPending}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={addCommentMutation.isPending || !newComment.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                {addCommentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Post Comment
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
