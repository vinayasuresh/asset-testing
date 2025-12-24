import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authenticatedRequest } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { insertTicketCommentSchema } from "@shared/schema";
import { z } from "zod";

const commentFormSchema = insertTicketCommentSchema.pick({
  content: true,
});

type CommentFormData = z.infer<typeof commentFormSchema>;

interface CommentFormProps {
  ticketId: string;
  onSuccess?: () => void;
  placeholder?: string;
  className?: string;
}

export function CommentForm({ 
  ticketId, 
  onSuccess, 
  placeholder = "Add a comment...",
  className 
}: CommentFormProps) {
  const { toast } = useToast();

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: {
      content: "",
    },
  });

  const addCommentMutation = useMutation<any, Error, CommentFormData>({
    mutationFn: async (data: CommentFormData) => {
      const response = await authenticatedRequest("POST", `/api/tickets/${ticketId}/comments`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] }); // Refresh ticket list
      form.reset();
      toast({
        title: "Comment added",
        description: "Your comment has been added to the ticket.",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CommentFormData) => {
    if (!data.content.trim()) {
      return;
    }
    addCommentMutation.mutate(data);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <div className={className}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder={placeholder}
                    className="min-h-[80px] resize-none"
                    onKeyDown={handleKeyDown}
                    {...field}
                    data-testid="textarea-comment-content"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Press Ctrl+Enter to submit
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={addCommentMutation.isPending || !form.watch("content").trim()}
              data-testid="button-submit-comment"
            >
              {addCommentMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {addCommentMutation.isPending ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}