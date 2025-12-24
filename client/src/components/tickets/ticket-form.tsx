import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, Plus, User, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { authenticatedRequest } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { insertTicketSchema, type InsertTicket, type Asset } from "@shared/schema";
import { z } from "zod";

const ticketFormSchema = insertTicketSchema.pick({
  title: true,
  description: true,
  category: true,
  priority: true,
  assetId: true,
}).extend({
  // Admin-only fields for creating tickets on behalf of users
  requestorId: z.string().optional(),
  assignedToId: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketFormSchema>;

interface TicketFormProps {
  onSuccess?: (ticket: any) => void;
  onCancel?: () => void;
  defaultValues?: Partial<TicketFormData>;
  mode?: "create" | "edit";
  ticketId?: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface AssetSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  dataTestId: string;
}

function AssetSelect({ value, onValueChange, placeholder, dataTestId }: AssetSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ['/api/assets'],
  });

  const selectedAsset = assets.find(asset => asset.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid={dataTestId}
        >
          {selectedAsset ? `${selectedAsset.name} (${selectedAsset.serialNumber})` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search assets..." />
          <CommandList>
            <CommandEmpty>No assets found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                No asset selected
              </CommandItem>
              {assets.map((asset) => (
                <CommandItem
                  key={asset.id}
                  value={asset.id}
                  onSelect={() => {
                    onValueChange(asset.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === asset.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{asset.name}</span>
                    <span className="text-xs text-muted-foreground">{asset.serialNumber}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface UserSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  dataTestId: string;
  roleFilter?: string[];
  showRoleBadge?: boolean;
}

function UserSelect({ value, onValueChange, placeholder, dataTestId, roleFilter, showRoleBadge }: UserSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const filteredUsers = roleFilter
    ? users.filter(user => roleFilter.includes(user.role))
    : users;

  const selectedUser = filteredUsers.find(user => user.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid={dataTestId}
        >
          {selectedUser ? (
            <div className="flex items-center gap-2">
              <span>{`${selectedUser.firstName} ${selectedUser.lastName}`}</span>
              {showRoleBadge && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {selectedUser.role}
                </Badge>
              )}
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search users..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                Not assigned
              </CommandItem>
              {filteredUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  onSelect={() => {
                    onValueChange(user.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === user.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-2">
                      <span>{`${user.firstName} ${user.lastName}`}</span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {user.role}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TicketForm({ onSuccess, onCancel, defaultValues, mode = "create", ticketId }: TicketFormProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Check if current user can create tickets on behalf of others
  const isAdmin = currentUser && ['super-admin', 'admin', 'it-manager'].includes(currentUser.role);

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "general",
      priority: "medium",
      assetId: "",
      requestorId: "",
      assignedToId: "",
      ...defaultValues,
    },
  });

  const createTicketMutation = useMutation<any, Error, TicketFormData>({
    mutationFn: async (data: TicketFormData) => {
      // Prepare ticket data
      const ticketData: any = { ...data };
      
      // Remove assetId if empty and add assetName for the backend
      if (!ticketData.assetId) {
        delete ticketData.assetId;
        delete ticketData.assetName;
      } else {
        // Find the selected asset to get its name
        const assets = queryClient.getQueryData<Asset[]>(['/api/assets']) || [];
        const selectedAsset = assets.find((asset: Asset) => asset.id === ticketData.assetId);
        if (selectedAsset) {
          ticketData.assetName = selectedAsset.name;
        }
      }

      // If admin is creating on behalf of someone, add requestor details
      if (isAdmin && ticketData.requestorId) {
        const users = queryClient.getQueryData<User[]>(['/api/users']) || [];
        const requestor = users.find((u: User) => u.id === ticketData.requestorId);
        if (requestor) {
          ticketData.requestorName = `${requestor.firstName} ${requestor.lastName}`;
          ticketData.requestorEmail = requestor.email;
        }
      } else {
        // Remove requestorId if not set (will use current user on backend)
        delete ticketData.requestorId;
      }

      // If assigning to a technician, add their details
      if (ticketData.assignedToId) {
        const users = queryClient.getQueryData<User[]>(['/api/users']) || [];
        const assignee = users.find((u: User) => u.id === ticketData.assignedToId);
        if (assignee) {
          ticketData.assignedToName = `${assignee.firstName} ${assignee.lastName}`;
        }
      } else {
        delete ticketData.assignedToId;
        delete ticketData.assignedToName;
      }

      // Use PUT for edit mode, POST for create mode
      const method = mode === "edit" ? "PUT" : "POST";
      const url = mode === "edit" ? `/api/tickets/${ticketId}` : "/api/tickets";
      const response = await authenticatedRequest(method, url, ticketData);
      return response.json();
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      form.reset();
      const actionText = mode === "edit" ? "updated" : "created";
      toast({
        title: `Ticket ${actionText}`,
        description: `Ticket #${ticket.ticketNumber} has been ${actionText} successfully.`,
      });
      onSuccess?.(ticket);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create ticket. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TicketFormData) => {
    createTicketMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Admin-only fields for creating tickets on behalf of users */}
        {isAdmin && (
          <div className="space-y-6 p-4 border border-blue-500/20 rounded-lg bg-blue-500/5">
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
              <User className="h-4 w-4" />
              Administrative Options
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="requestorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Create For User (Optional)</FormLabel>
                    <FormControl>
                      <UserSelect
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        placeholder="Select user (defaults to yourself)"
                        dataTestId="select-ticket-requestor"
                        showRoleBadge={true}
                      />
                    </FormControl>
                    <FormDescription>
                      Leave empty to create ticket as yourself.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To Technician (Optional)</FormLabel>
                    <FormControl>
                      <UserSelect
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        placeholder="Select technician"
                        dataTestId="select-ticket-assignee"
                        roleFilter={['technician']}
                        showRoleBadge={false}
                      />
                    </FormControl>
                    <FormDescription>
                      Assign to a technician immediately.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Brief description of the issue" 
                  {...field} 
                  data-testid="input-ticket-title"
                />
              </FormControl>
              <FormDescription>
                Provide a clear, concise title for your support request.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Detailed description of the issue, steps to reproduce, and any error messages"
                  className="min-h-[120px]"
                  {...field} 
                  data-testid="textarea-ticket-description"
                />
              </FormControl>
              <FormDescription>
                Provide as much detail as possible to help us resolve your issue quickly.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-ticket-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="hardware">Hardware</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="network">Network</SelectItem>
                    <SelectItem value="access">Access & Permissions</SelectItem>
                    <SelectItem value="general">General Support</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Select the category that best describes your issue.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-ticket-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low - Minor issue, no impact on work</SelectItem>
                    <SelectItem value="medium">Medium - Some impact, workaround available</SelectItem>
                    <SelectItem value="high">High - Significant impact, urgent attention needed</SelectItem>
                    <SelectItem value="urgent">Urgent - Critical issue, work completely blocked</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Select the urgency level of your request.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="assetId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Related Asset (Optional)</FormLabel>
              <FormControl>
                <AssetSelect
                  value={field.value || ""}
                  onValueChange={field.onChange}
                  placeholder="Select an asset if this issue is related to specific equipment"
                  dataTestId="select-ticket-asset"
                />
              </FormControl>
              <FormDescription>
                If this issue is related to a specific piece of equipment, select it here.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              data-testid="button-ticket-cancel"
            >
              Cancel
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={createTicketMutation.isPending}
            data-testid="button-ticket-submit"
          >
            {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
          </Button>
        </div>
      </form>
    </Form>
  );
}