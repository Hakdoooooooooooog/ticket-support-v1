import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiClient } from './api-client';
import type { Ticket } from '@components/ticket-list';

// ============================================================================
// 1. UI Class Name Helper
// ============================================================================

/**
 * Merges conditional Tailwind CSS classes cleanly without style conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const RAW_OPAQUE_FIELDS = new Set([
  'password',
  'passwordHash',
  'ciphertext',
  'iv',
  'accessToken',
  'attachmentCompressed',
]);

/**
 * Sanitizes a user or API string by stripping control characters, <script>/<style> blocks,
 * HTML tags, dangerous URI schemes, and inline DOM event handlers.
 */
export function sanitizeText(value: string, fieldKey?: string): string {
  if (fieldKey && RAW_OPAQUE_FIELDS.has(fieldKey)) {
    return value;
  }

  return value
    .normalize('NFC')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\b(javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, '')
    .replace(/\bon[a-z]+\s*=/gi, '')
    .trim();
}

/**
 * Recursively sanitizes all string fields in an outbound request payload or inbound API response.
 */
export function sanitizePayload<T>(payload: T, fieldKey?: string): T {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    return sanitizeText(payload, fieldKey) as unknown as T;
  }

  if (payload instanceof Date) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item, fieldKey)) as unknown as T;
  }

  if (typeof payload === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      out[k] = sanitizePayload(v, k);
    }
    return out as T;
  }

  return payload;
}

// ============================================================================
// 2. Authentication, Session Storage & API Error Helpers
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  createdAt?: string;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

const AUTH_STORAGE_KEY = 'ts_auth_s';

export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function verifyPassportSession(
  accessToken: string,
): Promise<AuthUser | null> {
  try {
    const res = await apiClient.get<AuthUser>('/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.data;
  } catch {
    return null;
  }
}

export function getWorkspacePathForRole(
  role?: AuthUser['role'],
): '/admin' | '/portal' {
  return role === 'ADMIN' || role === 'AGENT' ? '/admin' : '/portal';
}

export function extractApiErrorMessage(
  err: unknown,
  fallbackMessage = 'An unexpected error occurred',
): string {
  const apiErr = (
    err as {
      response?: {
        data?: { message?: string; errors?: Array<{ message: string }> };
      };
    }
  )?.response?.data;
  if (apiErr?.errors && Array.isArray(apiErr.errors)) {
    return apiErr.errors.map((e) => e.message).join('. ');
  }
  return apiErr?.message || fallbackMessage;
}

// ============================================================================
// 3. Badge Variant Mapping Helpers
// ============================================================================

export type PriorityBadgeVariant =
  | 'destructive'
  | 'warning'
  | 'secondary'
  | 'outline';

export type StatusBadgeVariant = 'success' | 'warning' | 'default' | 'destructive';

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

export function getStatusBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'success';
    case 'IN_PROGRESS':
      return 'warning';
    case 'NEEDS_INFO':
      return 'destructive';
    default:
      return 'default';
  }
}

// ============================================================================
// 4. Date, Timestamp & Byte Formatting Helpers
// ============================================================================

export function formatLastUpdatedTimestamp(
  dataUpdatedAt?: number,
  lastUpdatedAt?: string | null,
): string | null {
  const rawTimestamp =
    dataUpdatedAt && dataUpdatedAt > 0
      ? new Date(dataUpdatedAt)
      : lastUpdatedAt
        ? new Date(lastUpdatedAt)
        : null;

  if (!rawTimestamp || Number.isNaN(rawTimestamp.getTime())) {
    return null;
  }

  return rawTimestamp.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTicketDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString();
}

export function formatTicketDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString();
}

export function formatCommentTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatByteSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

// ============================================================================
// 5. Ticket Filtering (Including ID Search), KPI Calculation & Display Helpers
// ============================================================================

export interface TicketKpiSummary {
  total: number;
  open: number;
  inProgress: number;
  needsInfo: number;
  urgentHigh: number;
  resolvedClosed: number;
  csatAverage: number | null;
  csatCount: number;
}

/**
 * Filters tickets by status, priority, and free-text query matching
 * Ticket ID (with or without leading `#`), title, description, or creator name/email.
 */
export function filterTickets(
  tickets: Ticket[],
  statusFilter = 'ALL',
  priorityFilter = 'ALL',
  searchQuery = '',
): Ticket[] {
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();
  const idQuery = normalizedQuery.replace(/^#/, '');

  return tickets.filter((ticket) => {
    if (statusFilter !== 'ALL' && ticket.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && ticket.priority !== priorityFilter) return false;
    if (normalizedQuery) {
      const matchId =
        idQuery.length > 0 && ticket.id.toLowerCase().includes(idQuery);
      const matchTitle = ticket.title.toLowerCase().includes(normalizedQuery);
      const matchDesc = ticket.description.toLowerCase().includes(normalizedQuery);
      const matchAuthor = ticket.creator?.fullName
        ?.toLowerCase()
        .includes(normalizedQuery);
      const matchEmail = ticket.creator?.email
        ?.toLowerCase()
        .includes(normalizedQuery);
      if (!matchId && !matchTitle && !matchDesc && !matchAuthor && !matchEmail) {
        return false;
      }
    }
    return true;
  });
}

export function computeTicketKpis(tickets: Ticket[]): TicketKpiSummary {
  const ratedTickets = tickets.filter(
    (t) => typeof t.csatRating === 'number' && t.csatRating > 0,
  );
  const csatSum = ratedTickets.reduce((sum, t) => sum + (t.csatRating || 0), 0);
  const csatAverage =
    ratedTickets.length > 0 ? Number((csatSum / ratedTickets.length).toFixed(1)) : null;

  return {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'OPEN').length,
    inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
    needsInfo: tickets.filter((t) => t.status === 'NEEDS_INFO').length,
    urgentHigh: tickets.filter(
      (t) => t.priority === 'URGENT' || t.priority === 'HIGH',
    ).length,
    resolvedClosed: tickets.filter(
      (t) => t.status === 'RESOLVED' || t.status === 'CLOSED',
    ).length,
    csatAverage,
    csatCount: ratedTickets.length,
  };
}

export function formatShortTicketId(id?: string): string {
  return `#${id?.slice(0, 8) || 'new'}`;
}

export function resolveTicketAssigneeId(ticket: Ticket): string {
  return ticket.assigneeId || ticket.assignee?.id || '';
}

export interface ParsedTimelineComment {
  kind: 'FOLLOW_UP' | 'AMENDMENT' | 'NOTE';
  badgeLabel: string;
  cleanText: string;
}

export function parseTimelineComment(content: string): ParsedTimelineComment {
  const trimmed = (content || '').trim();
  if (trimmed.startsWith('[FOLLOW-UP REQUESTED]')) {
    return {
      kind: 'FOLLOW_UP',
      badgeLabel: 'Follow-Up Requested',
      cleanText:
        trimmed.replace(/^\[FOLLOW-UP REQUESTED\]\s*/i, '').trim() ||
        'Additional details or screenshot requested.',
    };
  }
  if (trimmed.startsWith('[CUSTOMER AMENDMENT]')) {
    return {
      kind: 'AMENDMENT',
      badgeLabel: 'Customer Follow-Up / Amendment',
      cleanText:
        trimmed.replace(/^\[CUSTOMER AMENDMENT\]\s*/i, '').trim() ||
        'Submitted updated details.',
    };
  }
  return {
    kind: 'NOTE',
    badgeLabel: 'Support Note',
    cleanText: trimmed,
  };
}

export function countTicketAttachments(ticket: Ticket): number {
  let total = ticket.hasAttachment ? 1 : 0;
  if (Array.isArray(ticket.comments)) {
    for (const c of ticket.comments) {
      if (c.hasAttachment) total += 1;
    }
  }
  return total;
}

export interface TicketSlaStatus {
  label: string;
  isBreached: boolean;
  isResolved: boolean;
}

export function computeTicketSlaStatus(ticket: Ticket): TicketSlaStatus {
  const slaHoursByPriority: Record<Ticket['priority'], number> = {
    URGENT: 2,
    HIGH: 8,
    MEDIUM: 24,
    LOW: 72,
  };
  const targetHours = slaHoursByPriority[ticket.priority] ?? 24;

  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    return {
      label: `SLA Met (${targetHours}h target)`,
      isBreached: false,
      isResolved: true,
    };
  }

  const createdMs = new Date(ticket.createdAt).getTime();
  if (Number.isNaN(createdMs)) {
    return {
      label: `${targetHours}h SLA`,
      isBreached: false,
      isResolved: false,
    };
  }

  const deadlineMs = createdMs + targetHours * 60 * 60 * 1000;
  const remainingMs = deadlineMs - Date.now();

  if (remainingMs <= 0) {
    const overdueHours = Math.max(1, Math.round(Math.abs(remainingMs) / (60 * 60 * 1000)));
    return {
      label: `SLA Breached (${overdueHours}h overdue)`,
      isBreached: true,
      isResolved: false,
    };
  }

  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  return {
    label: `SLA: ${remainingHours}h left`,
    isBreached: false,
    isResolved: false,
  };
}

// ============================================================================
// 6. Image Attachment Compression, In-Transit AES-256-GCM Encryption & On-Demand Decryption
// ============================================================================

export interface EncryptedAttachmentPayload {
  ciphertext: string;
  iv: string;
  fileName: string;
  mimeType: string;
  originalSize: number;
}

export interface DecryptedAttachmentResult {
  ticketId: string;
  fileName: string;
  mimeType: string;
  originalSize: number;
  dataUrl: string;
}

const ATTACHMENT_TRANSPORT_SECRET = process.env.NEXT_PUBLIC_ATTACHMENT_KEY;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveBrowserAesKey(): Promise<CryptoKey> {
  if (!ATTACHMENT_TRANSPORT_SECRET || !ATTACHMENT_TRANSPORT_SECRET.trim()) {
    throw new Error(
      'NEXT_PUBLIC_ATTACHMENT_KEY environment variable is required and not configured',
    );
  }
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.digest(
    'SHA-256',
    encoder.encode(ATTACHMENT_TRANSPORT_SECRET.trim()),
  );
  return window.crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Downscales and compresses an image file on an offscreen HTML5 canvas (WebP/JPEG)
 * before encrypting it in-transit with AES-256-GCM via the Web Crypto API.
 */
async function compressImageToDataUrl(
  file: File,
): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: String(reader.result),
            mimeType: file.type || 'image/png',
          });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const targetMime = 'image/webp';
        const compressedDataUrl = canvas.toDataURL(targetMime, 0.8);
        resolve({
          dataUrl: compressedDataUrl,
          mimeType: compressedDataUrl.startsWith('data:image/webp')
            ? 'image/webp'
            : file.type || 'image/jpeg',
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses a user-selected image on the client and encrypts the resulting payload
 * using AES-256-GCM so the image is encrypted in-transit before reaching the API.
 */
export async function compressAndEncryptImageFile(
  file: File,
): Promise<EncryptedAttachmentPayload> {
  const { dataUrl, mimeType } = await compressImageToDataUrl(file);
  const key = await deriveBrowserAesKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(dataUrl);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainBytes,
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: bytesToBase64(iv),
    fileName: file.name,
    mimeType,
    originalSize: file.size,
  };
}

/**
 * Requests on-demand Brotli decompression from `GET /tickets/:id/attachment`
 * and decrypts the AES-256-GCM transit payload in the browser.
 */
export async function fetchAndDecryptTicketAttachment(
  ticketId: string,
): Promise<DecryptedAttachmentResult> {
  const res = await apiClient.get<{
    ticketId: string;
    fileName: string;
    mimeType: string;
    originalSize: number;
    encrypted: { ciphertext: string; iv: string };
  }>(`/tickets/${ticketId}/attachment`);

  const { encrypted, fileName, mimeType, originalSize } = res.data;
  const key = await deriveBrowserAesKey();
  const iv = base64ToBytes(encrypted.iv);
  const cipherBytes = base64ToBytes(encrypted.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipherBytes as BufferSource,
  );

  const dataUrl = new TextDecoder().decode(decryptedBuffer);

  return {
    ticketId,
    fileName,
    mimeType,
    originalSize,
    dataUrl,
  };
}

export async function fetchAndDecryptCommentAttachment(
  ticketId: string,
  commentId: string,
): Promise<DecryptedAttachmentResult> {
  const res = await apiClient.get<{
    ticketId: string;
    fileName: string;
    mimeType: string;
    originalSize: number;
    encrypted: { ciphertext: string; iv: string };
  }>(`/tickets/${ticketId}/comments/${commentId}/attachment`);

  const { encrypted, fileName, mimeType, originalSize } = res.data;
  const key = await deriveBrowserAesKey();
  const iv = base64ToBytes(encrypted.iv);
  const cipherBytes = base64ToBytes(encrypted.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipherBytes as BufferSource,
  );

  const dataUrl = new TextDecoder().decode(decryptedBuffer);

  return {
    ticketId,
    fileName,
    mimeType,
    originalSize,
    dataUrl,
  };
}

// ============================================================================
// 10. In-App Notifications & Canned Responses
// ============================================================================

export interface AppNotification {
  id: string;
  userId: string;
  ticketId: string;
  type:
    | 'TICKET_CREATED'
    | 'TICKET_FOLLOW_UP_REQUESTED'
    | 'TICKET_CUSTOMER_AMENDED'
    | 'TICKET_NOTE_POSTED'
    | 'TICKET_ASSIGNED'
    | 'TICKET_STATUS_CHANGED';
  title: string;
  message: string;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export function formatNotificationTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recent';
  }
}

export function getNotificationBadge(type: AppNotification['type']): {
  label: string;
  badgeClass: string;
} {
  switch (type) {
    case 'TICKET_CREATED':
      return {
        label: 'NEW TICKET',
        badgeClass: 'border-blue-500/40 bg-blue-500/15 text-blue-300 font-bold',
      };
    case 'TICKET_FOLLOW_UP_REQUESTED':
      return {
        label: 'NEEDS INFO',
        badgeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold',
      };
    case 'TICKET_CUSTOMER_AMENDED':
      return {
        label: 'CUSTOMER',
        badgeClass: 'border-blue-500/40 bg-blue-500/15 text-blue-300 font-bold',
      };
    case 'TICKET_NOTE_POSTED':
      return {
        label: 'NOTE',
        badgeClass: 'border-purple-500/40 bg-purple-500/15 text-purple-300 font-bold',
      };
    case 'TICKET_ASSIGNED':
      return {
        label: 'ASSIGNED',
        badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-bold',
      };
    case 'TICKET_STATUS_CHANGED':
    default:
      return {
        label: 'STATUS',
        badgeClass: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300 font-bold',
      };
  }
}

export interface CannedResponseTemplate {
  id: string;
  category: 'Troubleshooting' | 'Information Request' | 'Status & Escalation' | 'Resolution';
  label: string;
  content: string;
}

export const CANNED_RESPONSES: CannedResponseTemplate[] = [
  {
    id: 'power-cycle',
    category: 'Troubleshooting',
    label: 'Hardware Power Cycle',
    content:
      'Please perform a full power cycle on your device: shut down the system, disconnect the power cable for 30 seconds, reconnect, and restart. Please confirm if the issue persists after reboot.',
  },
  {
    id: 'vpn-dns',
    category: 'Troubleshooting',
    label: 'VPN & DNS Cache Flush',
    content:
      'Please disconnect from the corporate VPN, open Command Prompt or Terminal, execute "ipconfig /flushdns" (or "sudo dscacheutil -flushcache" on macOS), and reconnect. Let us know if internal services are accessible.',
  },
  {
    id: 'browser-cache',
    category: 'Troubleshooting',
    label: 'Clear Browser Cache & Cookies',
    content:
      'Please clear your browser cookies and cached images/files (or try in a private/incognito browsing window). Afterwards, refresh the page to see if the error clears.',
  },
  {
    id: 'req-screenshot',
    category: 'Information Request',
    label: 'Request Screenshot / Error Log',
    content:
      'Could you please attach a full-screen screenshot showing the exact error message or dialogue, along with the browser console log (F12 > Console tab) if applicable?',
  },
  {
    id: 'req-reproduction',
    category: 'Information Request',
    label: 'Request Step-by-Step Reproduction',
    content:
      'To help us isolate the root cause, could you share the exact steps to reproduce this behavior (e.g., URL visited, buttons clicked, expected vs actual outcome)?',
  },
  {
    id: 'escalate-tier2',
    category: 'Status & Escalation',
    label: 'Escalate to Tier 2 Engineering',
    content:
      'This issue has been escalated to Tier 2 Infrastructure & Backend Engineering for detailed telemetry and log analysis. We will follow up with an update within 4 hours.',
  },
  {
    id: 'vendor-ticket',
    category: 'Status & Escalation',
    label: 'Upstream Vendor / Provider Escalation',
    content:
      'We have opened an urgent upstream support incident with the service provider. We are monitoring the vendor SLA and will update this ticket as soon as new status is reported.',
  },
  {
    id: 'resolution-applied',
    category: 'Resolution',
    label: 'Resolution Applied / Verification',
    content:
      'We have applied the configuration fix to your account/system. Please verify normal operation and let us know if everything is functioning as expected.',
  },
  {
    id: 'resolution-closing',
    category: 'Resolution',
    label: 'Issue Resolved / Ready to Close',
    content:
      'The reported issue has been diagnosed and resolved. If no further issues occur, you may confirm resolution in the portal. Feel free to reply if you need any further assistance!',
  },
];
