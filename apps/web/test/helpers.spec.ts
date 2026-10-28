import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  sanitizePayload,
  computeTicketKpis,
  computeTicketSlaStatus,
  parseTimelineComment,
  filterTickets,
  formatByteSize,
  formatShortTicketId,
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
  formatNotificationTime,
  getNotificationBadge,
  sanitizeAuthUser,
  getStoredSession,
  setStoredSession,
  clearStoredSession,
  interpolateCannedResponse,
} from '../src/lib/helpers';
import type { Ticket } from '../src/components/ticket-list';

describe('Web Helpers & Domain Functions', () => {
  describe('sanitizeText', () => {
    it('strips <script> and dangerous DOM events', () => {
      const malicious = '<script>alert("pwned")</script>Hello <img src="x" onerror="alert(1)" /> World';
      const clean = sanitizeText(malicious);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('onerror');
      expect(clean).toBe('Hello  World');
    });

    it('strips javascript: and data: URIs', () => {
      const input = 'Check this link: javascript:stealToken() or data:text/html,<script>evil</script>';
      const clean = sanitizeText(input);
      expect(clean).not.toContain('javascript:');
      expect(clean).not.toContain('data:text/html:');
    });

    it('preserves opaque crypto fields without modification', () => {
      const rawIv = '1234567890abcdef';
      expect(sanitizeText(rawIv, 'iv')).toBe(rawIv);
      const rawCipher = 'encrypted-ciphertext-string==';
      expect(sanitizeText(rawCipher, 'ciphertext')).toBe(rawCipher);
    });
  });

  describe('sanitizePayload', () => {
    it('recursively cleans nested string values in payload objects', () => {
      const payload = {
        title: 'Crash report <script>alert(1)</script>',
        metadata: {
          note: 'Follow-up <style>body{display:none}</style>urgent',
          count: 5,
          active: true,
        },
      };

      const cleaned = sanitizePayload(payload);
      expect(cleaned.title).toBe('Crash report');
      expect(cleaned.metadata.note).toBe('Follow-up urgent');
      expect(cleaned.metadata.count).toBe(5);
      expect(cleaned.metadata.active).toBe(true);
    });
  });

  describe('computeTicketKpis', () => {
    const mockTickets: Ticket[] = [
      {
        id: 't-1',
        title: 'Server down',
        description: 'Server not responding',
        status: 'OPEN',
        priority: 'URGENT',
        createdAt: '2026-10-27T10:00:00Z',
        updatedAt: '2026-10-27T10:00:00Z',
        creatorId: 'u-1',
        csatRating: null,
      },
      {
        id: 't-2',
        title: 'VPN issue',
        description: 'Cannot connect to VPN',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        createdAt: '2026-10-27T10:00:00Z',
        updatedAt: '2026-10-27T10:00:00Z',
        creatorId: 'u-2',
        csatRating: null,
      },
      {
        id: 't-3',
        title: 'Password reset',
        description: 'Forgot password',
        status: 'RESOLVED',
        priority: 'LOW',
        createdAt: '2026-10-27T10:00:00Z',
        updatedAt: '2026-10-27T10:00:00Z',
        creatorId: 'u-3',
        csatRating: 5,
      },
      {
        id: 't-4',
        title: 'Hardware replacement',
        description: 'Monitor broken',
        status: 'CLOSED',
        priority: 'MEDIUM',
        createdAt: '2026-10-27T10:00:00Z',
        updatedAt: '2026-10-27T10:00:00Z',
        creatorId: 'u-4',
        csatRating: 4,
      },
    ];

    it('accurately aggregates ticket queue metrics and CSAT telemetry', () => {
      const kpis = computeTicketKpis(mockTickets);
      expect(kpis.total).toBe(4);
      expect(kpis.open).toBe(1);
      expect(kpis.inProgress).toBe(1);
      expect(kpis.urgentHigh).toBe(2);
      expect(kpis.resolvedClosed).toBe(2);
      expect(kpis.csatCount).toBe(2);
      expect(kpis.csatAverage).toBe(4.5); // (5 + 4) / 2
    });

    it('handles empty ticket arrays gracefully', () => {
      const kpis = computeTicketKpis([]);
      expect(kpis.total).toBe(0);
      expect(kpis.csatAverage).toBeNull();
      expect(kpis.csatCount).toBe(0);
    });
  });

  describe('computeTicketSlaStatus', () => {
    it('marks resolved or closed tickets as resolved regardless of elapsed time', () => {
      const ticket: Ticket = {
        id: 't-1',
        title: 'Resolved ticket',
        description: 'desc',
        status: 'RESOLVED',
        priority: 'URGENT',
        createdAt: new Date(Date.now() - 100 * 3600 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const sla = computeTicketSlaStatus(ticket);
      expect(sla.isResolved).toBe(true);
      expect(sla.isBreached).toBe(false);
      expect(sla.label).toBe('SLA Met (2h target)');
    });

    it('detects SLA breach on urgent tickets exceeding 2 hours', () => {
      const ticket: Ticket = {
        id: 't-2',
        title: 'Urgent ticket',
        description: 'desc',
        status: 'OPEN',
        priority: 'URGENT',
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
        updatedAt: new Date().toISOString(),
      };

      const sla = computeTicketSlaStatus(ticket);
      expect(sla.isBreached).toBe(true);
      expect(sla.label).toContain('SLA Breached');
    });

    it('indicates remaining SLA time when within target window', () => {
      const ticket: Ticket = {
        id: 't-3',
        title: 'Medium ticket',
        description: 'desc',
        status: 'OPEN',
        priority: 'MEDIUM',
        createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), // 1 hour ago (SLA is 24h)
        updatedAt: new Date().toISOString(),
      };

      const sla = computeTicketSlaStatus(ticket);
      expect(sla.isBreached).toBe(false);
      expect(sla.label).toContain('left');
    });
  });

  describe('parseTimelineComment', () => {
    it('parses [FOLLOW-UP REQUESTED] comments correctly', () => {
      const content = '[FOLLOW-UP REQUESTED] Please attach your network trace logs.';
      const parsed = parseTimelineComment(content);
      expect(parsed.kind).toBe('FOLLOW_UP');
      expect(parsed.badgeLabel).toBe('Follow-Up Requested');
      expect(parsed.cleanText).toBe('Please attach your network trace logs.');
    });

    it('parses [CUSTOMER AMENDMENT] comments correctly', () => {
      const content = '[CUSTOMER AMENDMENT] Added error logs from terminal.';
      const parsed = parseTimelineComment(content);
      expect(parsed.kind).toBe('AMENDMENT');
      expect(parsed.badgeLabel).toBe('Customer Follow-Up / Amendment');
      expect(parsed.cleanText).toBe('Added error logs from terminal.');
    });

    it('defaults to standard support note', () => {
      const content = 'Investigating the database query latency now.';
      const parsed = parseTimelineComment(content);
      expect(parsed.kind).toBe('NOTE');
      expect(parsed.badgeLabel).toBe('Support Note');
      expect(parsed.cleanText).toBe('Investigating the database query latency now.');
    });
  });

  describe('filterTickets', () => {
    const sampleTickets: Ticket[] = [
      {
        id: 't-101',
        title: 'Printer offline',
        description: 'Second floor printer won\'t turn on',
        status: 'OPEN',
        priority: 'LOW',
        assigneeId: 'agent-1',
        createdAt: '2026-10-27T10:00:00Z',
        updatedAt: '2026-10-27T10:00:00Z',
      },
      {
        id: 't-102',
        title: 'Database connection timeout',
        description: 'Postgres rejecting connections',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        assigneeId: null,
        createdAt: '2026-10-27T10:00:00Z',
        updatedAt: '2026-10-27T10:00:00Z',
      },
    ];

    it('filters tickets by search query across title and description', () => {
      const results = filterTickets(sampleTickets, 'ALL', 'ALL', 'postgres');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('t-102');
    });

    it('filters tickets by status and priority', () => {
      const results = filterTickets(sampleTickets, 'IN_PROGRESS', 'URGENT');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('t-102');
    });

    it('filters tickets by department (TECHNICAL_SUPPORT vs GENERAL)', () => {
      const ticketsWithDepts: Ticket[] = [
        {
          id: 't-101',
          title: 'Printer offline',
          description: "Second floor printer won't turn on",
          status: 'OPEN',
          priority: 'LOW',
          department: 'TECHNICAL_SUPPORT',
          createdAt: '2026-10-27T10:00:00Z',
          updatedAt: '2026-10-27T10:00:00Z',
        },
        {
          id: 't-102',
          title: 'General inquiry about hours',
          description: 'What time is support open?',
          status: 'OPEN',
          priority: 'LOW',
          department: 'GENERAL',
          createdAt: '2026-10-27T10:00:00Z',
          updatedAt: '2026-10-27T10:00:00Z',
        },
      ];

      const techOnly = filterTickets(ticketsWithDepts, 'ALL', 'ALL', '', 'TECHNICAL_SUPPORT');
      expect(techOnly).toHaveLength(1);
      expect(techOnly[0].id).toBe('t-101');

      const genOnly = filterTickets(ticketsWithDepts, 'ALL', 'ALL', '', 'GENERAL');
      expect(genOnly).toHaveLength(1);
      expect(genOnly[0].id).toBe('t-102');

      const allDepts = filterTickets(ticketsWithDepts, 'ALL', 'ALL', '', 'ALL');
      expect(allDepts).toHaveLength(2);
    });

    it('filters tickets with default parameters', () => {
      const results = filterTickets(sampleTickets);
      expect(results).toHaveLength(2);
    });
  });

  describe('formatByteSize & formatShortTicketId', () => {
    it('formats bytes into KB and MB cleanly', () => {
      expect(formatByteSize(500)).toBe('500 B');
      expect(formatByteSize(2048)).toBe('2.0 KB');
      expect(formatByteSize(5 * 1024 * 1024)).toBe('5.00 MB');
    });

    it('formats ticket short IDs with # prefix', () => {
      expect(formatShortTicketId('c8f12345-6789-abcd-ef01-234567890abc')).toBe('#c8f12345');
      expect(formatShortTicketId(undefined)).toBe('#new');
    });
  });

  describe('Badge variant mapping', () => {
    it('maps priorities to correct badge variants', () => {
      expect(getPriorityBadgeVariant('URGENT')).toBe('destructive');
      expect(getPriorityBadgeVariant('HIGH')).toBe('warning');
      expect(getPriorityBadgeVariant('MEDIUM')).toBe('secondary');
      expect(getPriorityBadgeVariant('LOW')).toBe('outline');
    });

    it('maps statuses to correct badge variants', () => {
      expect(getStatusBadgeVariant('OPEN')).toBe('info');
      expect(getStatusBadgeVariant('IN_PROGRESS')).toBe('warning');
      expect(getStatusBadgeVariant('NEEDS_INFO')).toBe('destructive');
      expect(getStatusBadgeVariant('RESOLVED')).toBe('success');
      expect(getStatusBadgeVariant('CLOSED')).toBe('success');
    });
  });

  describe('Notifications formatting & badge helpers', () => {
    it('formats notification relative time correctly', () => {
      const now = new Date().toISOString();
      expect(formatNotificationTime(now)).toBe('Just now');

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      expect(formatNotificationTime(tenMinutesAgo)).toBe('10m ago');

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(formatNotificationTime(twoHoursAgo)).toBe('2h ago');

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatNotificationTime(twoDaysAgo)).toBe('2d ago');
    });

    it('returns appropriate badge metadata for all notification types', () => {
      expect(getNotificationBadge('TICKET_CREATED').label).toBe('NEW TICKET');
      expect(getNotificationBadge('TICKET_FOLLOW_UP_REQUESTED').label).toBe('NEEDS INFO');
      expect(getNotificationBadge('TICKET_CUSTOMER_AMENDED').label).toBe('CUSTOMER');
      expect(getNotificationBadge('TICKET_NOTE_POSTED').label).toBe('NOTE');
      expect(getNotificationBadge('TICKET_ASSIGNED').label).toBe('ASSIGNED');
      expect(getNotificationBadge('TICKET_STATUS_CHANGED').label).toBe('STATUS');
    });
  });

  describe('Session vault security and sanitization', () => {
    it('sanitizes auth user object and strips unauthorized keys', () => {
      const unsafeUser = {
        id: 'user-xyz',
        email: 'user@test.local',
        fullName: 'Test User',
        role: 'AGENT' as const,
        accessToken: 'should-not-be-in-user-object',
        passwordHash: 'secret-hash',
      };
      const clean = sanitizeAuthUser(unsafeUser);
      expect(clean).not.toBeNull();
      expect(clean?.id).toBe('user-xyz');
      expect(clean?.email).toBe('user@test.local');
      expect(clean?.fullName).toBe('Test User');
      expect(clean?.role).toBe('AGENT');
      expect((clean as any).accessToken).toBeUndefined();
      expect((clean as any).passwordHash).toBeUndefined();
    });

    it('encodes and decodes session in secure vault format without plaintext token', () => {
      const mockStorage: Record<string, string> = {};
      (globalThis as any).window = {
        localStorage: {
          getItem: (k: string) => mockStorage[k] || null,
          setItem: (k: string, v: string) => {
            mockStorage[k] = v;
          },
          removeItem: (k: string) => {
            delete mockStorage[k];
          },
        },
      };

      const session = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload.sig',
        user: {
          id: 'u-1',
          email: 'admin@test.local',
          fullName: 'Admin User',
          role: 'ADMIN' as const,
        },
      };

      setStoredSession(session);

      const storedRaw = mockStorage['ts_auth_s'];
      expect(storedRaw).toBeDefined();
      expect(storedRaw.startsWith('sec_v1:')).toBe(true);
      // Ensure raw JWT does NOT appear in plaintext
      expect(storedRaw).not.toContain('eyJhbGciOiJIUzI1Ni');
      expect(storedRaw).not.toContain('"accessToken"');

      // Decodes back accurately
      const restored = getStoredSession();
      expect(restored).not.toBeNull();
      expect(restored?.accessToken).toBe(session.accessToken);
      expect(restored?.user.id).toBe('u-1');
      expect(restored?.user.role).toBe('ADMIN');

      // Clears cleanly
      clearStoredSession();
      expect(mockStorage['ts_auth_s']).toBeUndefined();
    });
  });

  describe('interpolateCannedResponse', () => {
    it('interpolates all dynamic placeholder tokens correctly', () => {
      const template =
        'Hello {{customer_name}},\n\nRegarding ticket {{ticket_id}} ("{{ticket_title}}"), we are investigating.\n\nBest regards,\n{{agent_name}}';

      const interpolated = interpolateCannedResponse(template, {
        customerName: 'Sarah Connor',
        ticketId: '12345678-abcd',
        ticketTitle: 'Network latency spike',
        agentName: 'Alex Mercer',
      });

      expect(interpolated).toContain('Hello Sarah Connor,');
      expect(interpolated).toContain('Regarding ticket #12345678 ("Network latency spike")');
      expect(interpolated).toContain('Best regards,\nAlex Mercer');
    });

    it('falls back to sensible defaults when context fields are missing or empty', () => {
      const template =
        'Hello {{customer_name}}, regarding {{ticket_id}} ("{{ticket_title}}") from {{agent_name}}.';

      const interpolated = interpolateCannedResponse(template, {});

      expect(interpolated).toBe('Hello Customer, regarding #TICKET ("your support request") from IT Support Team.');
    });

    it('returns original template if no context is provided', () => {
      const template = 'Generic response text without parameters.';
      expect(interpolateCannedResponse(template)).toBe(template);
    });

    it('handles empty template string gracefully', () => {
      expect(interpolateCannedResponse('')).toBe('');
    });
  });
});
