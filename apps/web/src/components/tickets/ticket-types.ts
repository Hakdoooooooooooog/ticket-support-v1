export interface TicketComment {
  id: string;
  content: string;
  /** Staff-only note. The API never returns these to customers. */
  isInternal?: boolean;
  createdAt: string;
  hasAttachment?: boolean;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentOriginalSize?: number | null;
  attachmentStorageKey?: string | null;
  attachmentStorageType?: string | null;
  author?: {
    id: string;
    fullName: string;
    email: string;
    role?: 'ADMIN' | 'AGENT' | 'CUSTOMER';
    specialties?: string[];
  } | null;
}

export type Department = 'TECHNICAL_SUPPORT' | 'GENERAL';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'NEEDS_INFO' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  department?: Department;
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
    specialties?: string[];
  } | null;
  hasAttachment?: boolean;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentOriginalSize?: number | null;
  attachmentStorageKey?: string | null;
  attachmentStorageType?: string | null;
  autoEscalated?: boolean;
  escalationReason?: string | null;
  comments?: TicketComment[];
  csatRating?: number | null;
  csatComment?: string | null;
  csatRatedAt?: string | null;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  firstRespondedAt?: string | null;
  resolvedAt?: string | null;
  slaPausedAt?: string | null;
  firstResponseWarnedAt?: string | null;
  resolutionWarnedAt?: string | null;
  firstResponseBreachedAt?: string | null;
  resolutionBreachedAt?: string | null;
  updatedAt?: string;
}
