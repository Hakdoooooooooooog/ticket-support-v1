export type PriorityBadgeVariant =
  | 'destructive'
  | 'warning'
  | 'secondary'
  | 'outline';

export type StatusBadgeVariant =
  | 'success'
  | 'warning'
  | 'default';

/**
 * Maps ticket priority strings to appropriate badge visual styling.
 */
export function getPriorityBadgeVariant(priority: string): PriorityBadgeVariant {
  switch (priority) {
    case 'URGENT':
      return 'destructive';
    case 'HIGH':
      return 'warning';
    case 'MEDIUM':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Maps ticket status strings to appropriate badge visual styling.
 */
export function getStatusBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'success';
    case 'IN_PROGRESS':
      return 'warning';
    default:
      return 'default';
  }
}
