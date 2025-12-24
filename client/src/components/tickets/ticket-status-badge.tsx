import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TicketStatus = "open" | "in-progress" | "resolved" | "closed";

interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  const getStatusConfig = (status: TicketStatus) => {
    switch (status) {
      case "open":
        return {
          label: "Open",
          variant: "secondary" as const,
          className: "bg-blue-100 text-blue-800 hover:bg-blue-100/80",
        };
      case "in-progress":
        return {
          label: "In Progress",
          variant: "secondary" as const,
          className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80",
        };
      case "resolved":
        return {
          label: "Resolved",
          variant: "secondary" as const,
          className: "bg-green-100 text-green-800 hover:bg-green-100/80",
        };
      case "closed":
        return {
          label: "Closed",
          variant: "secondary" as const,
          className: "bg-gray-100 text-gray-800 hover:bg-gray-100/80",
        };
      default:
        return {
          label: status,
          variant: "secondary" as const,
          className: "bg-gray-100 text-gray-800 hover:bg-gray-100/80",
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      variant={config.variant}
      className={cn(config.className, className)}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}