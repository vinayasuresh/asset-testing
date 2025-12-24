import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { FloatingAIAssistant } from "@/components/ai/floating-ai-assistant";
import { TicketList } from "@/components/tickets/ticket-list";
import { TicketForm } from "@/components/tickets/ticket-form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Users, Wrench, Settings2 } from "lucide-react";
import { useLocation } from "wouter";

export default function Tickets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [location] = useLocation();

  // Check for ?action=create query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const canCreateTicket = user && ['super-admin', 'admin', 'it-manager'].includes(user.role);
    if (params.get('action') === 'create' && canCreateTicket) {
      setIsCreateDialogOpen(true);
      // Clean up URL
      window.history.replaceState({}, '', '/tickets');
    }
  }, [location, user]);

  const getPageContent = () => {
    switch (user?.role) {
      case "technician":
        return {
          title: "Assigned Tickets",
          description: "Manage tickets assigned to you and update their status",
          icon: <Wrench className="h-5 w-5" />,
          canCreate: false,
          filterByRole: "technician"
        };
      case "it-manager":
        return {
          title: "Team Tickets",
          description: "Create, assign, and manage all tickets in your organization",
          icon: <Settings2 className="h-5 w-5" />,
          canCreate: true,
          filterByRole: "it-manager"
        };
      case "admin":
        return {
          title: "All Tickets",
          description: "Complete ticket management and system administration",
          icon: <Settings2 className="h-5 w-5" />,
          canCreate: true,
          filterByRole: "admin"
        };
      case "super-admin":
        return {
          title: "All Tickets",
          description: "Complete ticket management and system administration",
          icon: <Settings2 className="h-5 w-5" />,
          canCreate: true,
          filterByRole: "super-admin"
        };
      default:
        return {
          title: "Support Tickets",
          description: "Ticket management system",
          icon: <Users className="h-5 w-5" />,
          canCreate: false,
          filterByRole: "technician"
        };
    }
  };

  const pageContent = getPageContent();

  const handleCreateTicket = () => {
    setIsCreateDialogOpen(true);
  };

  const handleTicketCreated = (ticket: any) => {
    setIsCreateDialogOpen(false);
    toast({
      title: "Ticket created",
      description: `Ticket #${ticket.id} has been created successfully.`,
    });
  };

  return (
    <div className="flex h-screen bg-background page-enter">
      <Sidebar />
      
      <main className="flex-1 md:ml-64 overflow-auto">
        <TopBar
          title={pageContent.title}
          description={pageContent.description}
          onAddClick={pageContent.canCreate ? handleCreateTicket : undefined}
          addButtonText="Create Ticket"
        />
        
        <div className="p-6">
          <TicketList 
            onCreateTicket={pageContent.canCreate ? handleCreateTicket : undefined}
            showCreateButton={pageContent.canCreate}
            title="Support Tickets"
          />
        </div>
      </main>
      
      {pageContent.canCreate && (
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Ticket
              </DialogTitle>
            </DialogHeader>
            <TicketForm
              onSuccess={handleTicketCreated}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
      
      {/* Global Floating AI Assistant */}
      <FloatingAIAssistant />
    </div>
  );
}