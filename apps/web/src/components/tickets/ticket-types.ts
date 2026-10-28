export interface TicketComment {
  id: string;
  content: string;
  createdAt: string;
  hasAttachment?: boolean;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentOriginalSize?: number | null;
  author?: {
    id: string;
    fullName: string;
    email: string;
    role?: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  } | null;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'NEEDS_INFO' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  creatorId?: string;
  creator?: {
    id?: string;
    fullName: string;
    email: string;
    role?: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  } | null;
  assigneeId?: string | null;
  assignee?: {
    id: string;
    fullName: string;
    email: string;
    role?: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  } | null;
  hasAttachment?: boolean;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentOriginalSize?: number | null;
  comments?: TicketComment[];
  csatRating?: number | null;
  csatComment?: string | null;
  csatRatedAt?: string | null;
  updatedAt?: string;
}
