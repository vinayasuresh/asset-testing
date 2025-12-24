import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

interface TicketPriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
}

export function TicketPriorityBadge({ priority, className }: TicketPriorityBadgeProps) {
  const getPriorityConfig = (priority: TicketPriority) => {
    switch (priority) {
      case "low":
        return {
          label: "Low",
          variant: "secondary" as const,
          className: "bg-green-100 text-green-800 hover:bg-green-100/80",
        };
      case "medium":
        return {
          label: "Medium",
          variant: "secondary" as const,
          className: "bg-blue-100 text-blue-800 hover:bg-blue-100/80",
        };
      case "high":
        return {
          label: "High",
          variant: "secondary" as const,
          className: "bg-orange-100 text-orange-800 hover:bg-orange-100/80",
        };
      case "urgent":
        return {
          label: "Urgent",
          variant: "destructive" as const,
          className: "bg-red-100 text-red-800 hover:bg-red-100/80",
        };
      default:
        return {
          label: priority,
          variant: "secondary" as const,
          className: "bg-gray-100 text-gray-800 hover:bg-gray-100/80",
        };
    }
  };

  const config = getPriorityConfig(priority);

  return (
    <Badge 
      variant={config.variant}
      className={cn(config.className, className)}
      data-testid={`badge-priority-${priority}`}
    >
      {config.label}
    </Badge>
  );
}