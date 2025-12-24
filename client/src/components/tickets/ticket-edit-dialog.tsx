import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { authenticatedRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Ticket } from "@shared/schema";
import { TicketForm } from "./ticket-form";

interface TicketEditDialogProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketEditDialog({ ticket, open, onOpenChange }: TicketEditDialogProps) {
  const { toast } = useToast();

  const updateTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!ticket) return;
      const response = await authenticatedRequest("PUT", `/api/tickets/${ticket.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({
        title: "Ticket updated",
        description: "The ticket has been successfully updated.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update ticket. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSuccess = (updatedTicket: any) => {
    updateTicketMutation.mutate(updatedTicket);
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Ticket #{ticket.ticketNumber}</DialogTitle>
        </DialogHeader>
        <TicketForm
          mode="edit"
          ticketId={ticket.id}
          defaultValues={{
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority,
            category: ticket.category,
            assetId: ticket.assetId || undefined,
          }}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
