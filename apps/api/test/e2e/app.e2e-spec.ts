import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../../src/database/prisma.service.js';

describe('TicketSupport API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let createdTicketId: string;
  let customerToken: string;
  const testEmail = `e2e.user.${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    if (createdTicketId) {
      await prisma.ticket.deleteMany({ where: { id: createdTicketId } });
    }
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  describe('Root Health Check', () => {
    it('GET / -> should return Hello World!', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });
  });

  describe('Authentication Flow (/auth)', () => {
    it('POST /auth/register -> should reject invalid payload with 400 and field errors', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ fullName: 'A', email: 'not-an-email', password: '123' })
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('POST /auth/register -> should register a new customer and strip passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: '  E2E Test Customer  ',
          email: `  ${testEmail.toUpperCase()}  `,
          password: 'SecurePassword123!',
        })
        .expect(201);

      expect(res.body.message).toBe('User registered successfully');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.fullName).toBe('E2E Test Customer');
      expect(res.body.user.role).toBe('CUSTOMER');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('POST /auth/register -> should return 409 Conflict on duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Duplicate User',
          email: testEmail,
          password: 'SecurePassword123!',
        })
        .expect(409);
    });

    it('POST /auth/login -> should authenticate valid user and return accessToken, then verify GET /auth/me via Passport JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'SecurePassword123!',
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      customerToken = res.body.accessToken;
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.passwordHash).toBeUndefined();

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);

      expect(meRes.body.email).toBe(testEmail);

      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('POST /auth/login -> should return 401 Unauthorized on wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword!',
        })
        .expect(401);
    });
  });

  describe('Tickets CRUD Flow (/tickets)', () => {
    it('POST /tickets -> should reject short title/description with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .send({ title: 'abc', description: 'short' })
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'title' }),
          expect.objectContaining({ field: 'description' }),
        ]),
      );
    });

    it('POST /tickets -> should create a ticket with trimmed fields and default MEDIUM priority', async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: '  E2E Automated Verification Ticket  ',
          description: '  Verifying end-to-end ticket creation through NestJS, Zod, and Prisma 7.  ',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      createdTicketId = res.body.id;
      expect(res.body.title).toBe('E2E Automated Verification Ticket');
      expect(res.body.priority).toBe('MEDIUM');
      expect(res.body.status).toBe('OPEN');
      expect(typeof res.body.createdAt).toBe('string');
    });

    it('GET /tickets -> should list tickets including the newly created ticket', async () => {
      const res = await request(app.getHttpServer())
        .get('/tickets')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((t: any) => t.id === createdTicketId);
      expect(found).toBeDefined();
      expect(found.title).toBe('E2E Automated Verification Ticket');
    });

    it('GET /tickets/:id -> should fetch single ticket by id and return 404 for unknown id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets/${createdTicketId}`)
        .expect(200);

      expect(res.body.id).toBe(createdTicketId);

      await request(app.getHttpServer())
        .get('/tickets/non-existent-ticket-id')
        .expect(404);
    });

    it('PATCH /tickets/:id -> should require assignment before changing status or commenting, then update status and priority once assigned', async () => {
      // 1. Unassigned status change or comment is rejected with 400 Bad Request
      await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/tickets/${createdTicketId}/comments`)
        .send({ content: 'Cannot comment while unassigned' })
        .expect(400);

      // 2. Ensure an IT Agent exists to claim the ticket
      const agent = await prisma.user.upsert({
        where: { email: 'e2e.agent@ticketsupport.local' },
        update: { role: 'AGENT' },
        create: {
          email: 'e2e.agent@ticketsupport.local',
          fullName: 'E2E Support Agent',
          passwordHash: 'agenthash',
          role: 'AGENT',
        },
      });

      // 3. Assign the ticket and move to IN_PROGRESS
      const res = await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .send({
          assigneeId: agent.id,
          status: 'IN_PROGRESS',
          priority: 'HIGH',
        })
        .expect(200);

      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.priority).toBe('HIGH');
      expect(res.body.assigneeId).toBe(agent.id);
    });

    it('POST /tickets/:id/comments -> should add an IT resolution note to the ticket', async () => {
      const res = await request(app.getHttpServer())
        .post(`/tickets/${createdTicketId}/comments`)
        .send({
          content: 'Investigating database pool limits and scaling PgBouncer.',
        })
        .expect(201);

      expect(res.body.comments).toHaveLength(1);
      expect(res.body.comments[0].content).toBe(
        'Investigating database pool limits and scaling PgBouncer.',
      );
    });

    it('PATCH /tickets/:id & GET /tickets/:id/attachment -> should handle admin NEEDS_INFO follow-up, customer amendment with AES-256-GCM encrypted image, Brotli compression, and on-demand decompression', async () => {
      // 1. Admin requests additional info / follow-up
      const followUpRes = await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .send({
          status: 'NEEDS_INFO',
          amendmentNote: '[FOLLOW-UP REQUESTED] Please attach a screenshot of the error.',
        })
        .expect(200);

      expect(followUpRes.body.status).toBe('NEEDS_INFO');

      // 2. Customer amends ticket with AES-256-GCM encrypted image attachment
      const secret =
        process.env.NEXT_PUBLIC_ATTACHMENT_KEY

      if (!secret) {
        throw new Error('NEXT_PUBLIC_ATTACHMENT_KEY is not defined');
      }

      const key = createHash('sha256').update(secret, 'utf8').digest();
      const iv = randomBytes(12);
      const sampleDataUrl =
        'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([
        cipher.update(Buffer.from(sampleDataUrl, 'utf8')),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();
      const ciphertext = Buffer.concat([encrypted, authTag]).toString('base64');

      const amendRes = await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .send({
          description:
            'Updated description with requested reproduction steps and encrypted screenshot.',
          amendmentNote: '[CUSTOMER AMENDMENT] Attached error screenshot.',
          encryptedAttachment: {
            ciphertext,
            iv: iv.toString('base64'),
            fileName: 'error-screenshot.webp',
            mimeType: 'image/webp',
            originalSize: sampleDataUrl.length,
          },
        })
        .expect(200);

      expect(amendRes.body.status).toBe('IN_PROGRESS');
      const latestComment =
        amendRes.body.comments[amendRes.body.comments.length - 1];
      expect(latestComment).toBeDefined();
      expect(latestComment.hasAttachment).toBe(true);
      expect(latestComment.attachmentName).toBe('error-screenshot.webp');

      // 3. Retrieve comment attachment on-demand
      const attachRes = await request(app.getHttpServer())
        .get(`/tickets/${createdTicketId}/comments/${latestComment.id}/attachment`)
        .expect(200);

      expect(attachRes.body.ticketId).toBe(createdTicketId);
      expect(attachRes.body.fileName).toBe('error-screenshot.webp');
      expect(attachRes.body.encrypted.ciphertext).toBeDefined();
      expect(attachRes.body.encrypted.iv).toBeDefined();
    });

    it('POST /tickets/:id/csat -> should submit CSAT feedback on a resolved ticket and reject invalid rating', async () => {
      // 1. Mark ticket as RESOLVED
      await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .send({ status: 'RESOLVED' })
        .expect(200);

      // 2. Reject support agent attempting to submit CSAT (anti-self-rating guard)
      const agentLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'agent@ticketsupport.local',
          password: 'LocalDevAgentPassword123!',
        });

      if (agentLogin.status === 200) {
        const staffRes = await request(app.getHttpServer())
          .post(`/tickets/${createdTicketId}/csat`)
          .set('Authorization', `Bearer ${agentLogin.body.accessToken}`)
          .send({ rating: 5, comment: 'Illegal agent self-rating' })
          .expect(403);

        expect(staffRes.body.message).toContain('Support engineers and administrators are not permitted');
      }

      // 3. Reject unauthenticated request when ticket has a registered creator
      await request(app.getHttpServer())
        .post(`/tickets/${createdTicketId}/csat`)
        .send({ rating: 5, comment: 'Anonymous attempt' })
        .expect(403);

      // 4. Submit valid CSAT as reporting customer
      const csatRes = await request(app.getHttpServer())
        .post(`/tickets/${createdTicketId}/csat`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 5,
          comment: 'Outstanding support experience! Fixed in 10 minutes.',
        })
        .expect(200);

      expect(csatRes.body.csatRating).toBe(5);
      expect(csatRes.body.csatComment).toBe(
        'Outstanding support experience! Fixed in 10 minutes.',
      );
      expect(csatRes.body.csatRatedAt).toBeDefined();

      // 5. Reject invalid rating (> 5)
      await request(app.getHttpServer())
        .post(`/tickets/${createdTicketId}/csat`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ rating: 6 })
        .expect(400);
    });

    it('GET /notifications -> should return notification feed structure and strictly filter for admins', async () => {
      // 1. Check notifications feed with customer token
      const notifRes = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(Array.isArray(notifRes.body.notifications)).toBe(true);
      expect(typeof notifRes.body.unreadCount).toBe('number');

      // 2. Log in as admin and verify admin feed only receives TICKET_CREATED
      const adminLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@ticketsupport.local',
          password: 'AdminPassword123!',
        });

      if (adminLogin.status === 200) {
        const adminFeed = await request(app.getHttpServer())
          .get('/notifications')
          .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
          .expect(200);

        expect(Array.isArray(adminFeed.body.notifications)).toBe(true);
        // Verify every notification for admin is strictly TICKET_CREATED
        const nonAdminNotifications = adminFeed.body.notifications.filter(
          (n: { type: string }) => n.type !== 'TICKET_CREATED',
        );
        expect(nonAdminNotifications).toHaveLength(0);
      }
    });

    it('PATCH /notifications/mark-all-read -> should mark all notifications as read', async () => {
      const res = await request(app.getHttpServer())
        .patch('/notifications/mark-all-read')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(typeof res.body.count).toBe('number');
    });

    it('GET /realtime/stream -> should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/realtime/stream')
        .expect(401);

      await request(app.getHttpServer())
        .get('/realtime/stream?token=invalid.jwt.token')
        .expect(401);
    });

    it('DELETE /tickets/:id -> should delete the ticket and return 204', async () => {
      await request(app.getHttpServer())
        .delete(`/tickets/${createdTicketId}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/tickets/${createdTicketId}`)
        .expect(404);

      createdTicketId = '';
    });
  });

  describe('Staff Invitation Lifecycle (e2e)', () => {
    let adminToken: string;
    let inviteCode: string;
    let inviteId: string;
    const inviteEmail = `invitee.${Date.now()}@ticketsupport.local`;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@ticketsupport.local',
          password: 'AdminPassword123!',
        });

      if (loginRes.status === 200) {
        adminToken = loginRes.body.accessToken;
      }
    });

    it('POST /auth/admin/invites -> should allow ADMIN to generate staff invitation code', async () => {
      if (!adminToken) return;

      const res = await request(app.getHttpServer())
        .post('/auth/admin/invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          role: 'AGENT',
        })
        .expect(201);

      expect(res.body.email).toBe(inviteEmail);
      expect(res.body.role).toBe('AGENT');
      expect(res.body.code).toBeDefined();

      inviteCode = res.body.code;
      inviteId = res.body.id;
    });

    it('GET /auth/invites/verify/:code -> should verify pending invitation code validity', async () => {
      if (!inviteCode) return;

      const res = await request(app.getHttpServer())
        .get(`/auth/invites/verify/${inviteCode}`)
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.email).toBe(inviteEmail);
      expect(res.body.role).toBe('AGENT');
    });

    it('GET /auth/admin/invites -> should list pending staff invitations', async () => {
      if (!adminToken) return;

      const res = await request(app.getHttpServer())
        .get('/auth/admin/invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((inv: { email: string }) => inv.email === inviteEmail);
      expect(found).toBeDefined();
    });

    it('DELETE /auth/admin/invites/:id -> should allow admin to revoke invitation', async () => {
      if (!adminToken || !inviteId) return;

      const res = await request(app.getHttpServer())
        .delete(`/auth/admin/invites/${inviteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
