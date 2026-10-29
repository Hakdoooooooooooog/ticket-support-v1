import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module.js';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../../src/database/prisma.service.js';

describe('TicketSupport API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let createdTicketId: string;
  let customerToken: string;
  let customerRefreshToken: string;
  let otherCustomerToken: string;
  let adminToken: string;
  const testEmail = `e2e.user.${Date.now()}@example.com`;
  const otherCustomerEmail = `e2e.other.${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
    await prisma.user.upsert({
      where: { email: 'admin@ticketsupport.local' },
      update: { role: 'ADMIN', passwordHash: adminPasswordHash },
      create: {
        email: 'admin@ticketsupport.local',
        fullName: 'IT Administrator',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
      },
    });

    const agentPasswordHash = await bcrypt.hash('AgentPassword123!', 10);
    await prisma.user.upsert({
      where: { email: 'e2e.agent@ticketsupport.local' },
      update: { role: 'AGENT', passwordHash: agentPasswordHash },
      create: {
        email: 'e2e.agent@ticketsupport.local',
        fullName: 'E2E Support Agent',
        passwordHash: agentPasswordHash,
        role: 'AGENT',
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@ticketsupport.local',
        password: 'AdminPassword123!',
      });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    if (createdTicketId) {
      await prisma.ticket.deleteMany({ where: { id: createdTicketId } });
    }
    await prisma.user.deleteMany({
      where: {
        email: { in: [testEmail, otherCustomerEmail, 'admin@ticketsupport.local', 'e2e.agent@ticketsupport.local'] },
      },
    });
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

  describe('Authentication & Session Flow (/auth)', () => {
    it('POST /auth/register -> should reject invalid payload with 400 and field errors', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ fullName: 'A', email: 'not-an-email', password: '123' })
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('POST /auth/register -> should register a new customer and set rt cookie', async () => {
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
      expect(res.body.accessToken).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const rtCookie = cookies?.find((c: string) => c.startsWith('rt='));
      expect(rtCookie).toBeDefined();
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

    it('POST /auth/login -> should authenticate and return 15m accessToken and set httpOnly rt cookie', async () => {
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

      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();
      const rtCookie = cookies.find((c: string) => c.startsWith('rt='));
      expect(rtCookie).toBeDefined();
      customerRefreshToken = rtCookie!.split(';')[0]; // e.g. "rt=rt_..."

      // Register second customer for cross-tenant isolation testing
      const otherRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Other Customer',
          email: otherCustomerEmail,
          password: 'OtherPassword123!',
        })
        .expect(201);
      otherCustomerToken = otherRes.body.accessToken;

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);

      expect(meRes.body.email).toBe(testEmail);

      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('POST /auth/refresh -> should rotate session with rt cookie and issue fresh access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [customerRefreshToken])
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);

      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();
      const newRtCookie = cookies.find((c: string) => c.startsWith('rt='));
      expect(newRtCookie).toBeDefined();
      customerRefreshToken = newRtCookie!.split(';')[0];
    });

    it('GET /auth/agents -> should forbid customer from reading staff personnel directory', async () => {
      await request(app.getHttpServer())
        .get('/auth/agents')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('Strict Authentication & Role Guards (/tickets)', () => {
    it('POST /tickets -> should reject unauthenticated creation with 401', async () => {
      await request(app.getHttpServer())
        .post('/tickets')
        .send({
          title: 'Unauthenticated Ticket',
          description: 'Should be rejected immediately',
        })
        .expect(401);
    });

    it('POST /tickets -> should create a ticket with authenticated customer ownership', async () => {
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

    it('GET /tickets -> should reject unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/tickets')
        .expect(401);
    });

    it('GET /tickets -> should scope list to authenticated customer only', async () => {
      // Customer 1 sees their ticket
      const res = await request(app.getHttpServer())
        .get('/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((t: any) => t.id === createdTicketId);
      expect(found).toBeDefined();

      // Customer 2 does NOT see Customer 1's ticket
      const otherRes = await request(app.getHttpServer())
        .get('/tickets')
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .expect(200);

      const crossTenantLeak = otherRes.body.find((t: any) => t.id === createdTicketId);
      expect(crossTenantLeak).toBeUndefined();
    });

    it('GET /tickets/:id -> should reject unauthenticated with 401 and other customer with 403', async () => {
      // 1. Unauthenticated gets 401
      await request(app.getHttpServer())
        .get(`/tickets/${createdTicketId}`)
        .expect(401);

      // 2. Other customer gets 403 Forbidden
      await request(app.getHttpServer())
        .get(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .expect(403);

      // 3. Creator customer gets 200 OK
      const res = await request(app.getHttpServer())
        .get(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdTicketId);
    });

    it('PATCH /tickets/:id -> should require staff assignment before status update, and update once assigned', async () => {
      // Ensure ticket is unassigned
      await prisma.ticket.update({
        where: { id: createdTicketId },
        data: { assigneeId: null },
      });

      // Unassigned status change by staff is rejected with 400 Bad Request
      await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(400);

      // Retrieve IT Agent created in beforeAll
      const agent = await prisma.user.findUniqueOrThrow({
        where: { email: 'e2e.agent@ticketsupport.local' },
      });

      // Assign ticket and transition to IN_PROGRESS
      const res = await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assigneeId: agent.id,
          status: 'IN_PROGRESS',
          priority: 'HIGH',
        })
        .expect(200);

      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.assigneeId).toBe(agent.id);
    });

    it('POST /tickets/:id/comments -> should allow staff to append resolution comment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/tickets/${createdTicketId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Investigating database pool limits and scaling PgBouncer.',
        })
        .expect(201);

      expect(res.body.comments).toHaveLength(1);
    });

    it('PATCH /tickets/:id & GET /tickets/:id/attachment -> should support follow-up and encrypted customer amendment', async () => {
      // 1. Staff requests follow-up
      await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'NEEDS_INFO',
          amendmentNote: '[FOLLOW-UP REQUESTED] Please attach a screenshot of the error.',
        })
        .expect(200);

      // 2. Customer amends ticket with encrypted attachment
      const secret = process.env.NEXT_PUBLIC_ATTACHMENT_KEY || 'default-test-key-32-chars-long!!';
      const key = createHash('sha256').update(secret, 'utf8').digest();
      const iv = randomBytes(12);
      const sampleDataUrl = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(Buffer.from(sampleDataUrl, 'utf8')), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const ciphertext = Buffer.concat([encrypted, authTag]).toString('base64');

      const amendRes = await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          description: 'Updated description with requested reproduction steps and encrypted screenshot.',
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
      const latestComment = amendRes.body.comments[amendRes.body.comments.length - 1];

      // 3. Unauthenticated attachment retrieval must get 401
      await request(app.getHttpServer())
        .get(`/tickets/${createdTicketId}/comments/${latestComment.id}/attachment`)
        .expect(401);

      // 4. Authorized customer retrieval gets 200
      const attachRes = await request(app.getHttpServer())
        .get(`/tickets/${createdTicketId}/comments/${latestComment.id}/attachment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(attachRes.body.ticketId).toBe(createdTicketId);
      expect(attachRes.body.fileName).toBe('error-screenshot.webp');
    });

    it('POST /tickets/:id/csat -> should enforce customer ownership and reject staff rating', async () => {
      // 1. Mark ticket as RESOLVED by staff
      await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' })
        .expect(200);

      // 2. Reject unauthenticated rating
      await request(app.getHttpServer())
        .post(`/tickets/${createdTicketId}/csat`)
        .send({ rating: 5, comment: 'Anonymous attempt' })
        .expect(401);

      // 3. Reject staff member rating (RolesGuard blocks non-customers with 403)
      await request(app.getHttpServer())
        .post(`/tickets/${createdTicketId}/csat`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 5, comment: 'Illegal agent self-rating' })
        .expect(403);

      // 4. Submit valid CSAT as reporting customer
      const csatRes = await request(app.getHttpServer())
        .post(`/tickets/${createdTicketId}/csat`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 5,
          comment: 'Outstanding support experience! Fixed quickly.',
        })
        .expect(200);

      expect(csatRes.body.csatRating).toBe(5);
    });

    it('DELETE /tickets/:id -> should forbid customer from deleting ticket and allow admin', async () => {
      // 1. Unauthenticated gets 401
      await request(app.getHttpServer())
        .delete(`/tickets/${createdTicketId}`)
        .expect(401);

      // 2. Customer gets 403 Forbidden
      await request(app.getHttpServer())
        .delete(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      // 3. Admin gets 204 No Content
      await request(app.getHttpServer())
        .delete(`/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      createdTicketId = '';
    });
  });

  describe('Database-Backed Knowledge Base (/knowledge-base)', () => {
    let createdArticleId: string;

    it('GET /knowledge-base -> should return published articles', async () => {
      const res = await request(app.getHttpServer())
        .get('/knowledge-base')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((a: any) => a.status === 'PUBLISHED')).toBe(true);
    });

    it('POST /knowledge-base -> should allow staff to draft an article and reject customer', async () => {
      // Customer gets 403
      await request(app.getHttpServer())
        .post('/knowledge-base')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Docker Engine Memory Optimization',
          summary: 'Guide to tune memory limits on WSL2 Docker containers.',
          department: 'TECHNICAL_SUPPORT',
        })
        .expect(403);

      // Admin drafts successfully
      const res = await request(app.getHttpServer())
        .post('/knowledge-base')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Docker Engine Memory Optimization',
          summary: 'Guide to tune memory limits on WSL2 Docker containers.',
          body: 'Detailed steps for docker memory limits...',
          steps: ['Open .wslconfig', 'Set memory=4GB', 'Restart LxssManager'],
          department: 'TECHNICAL_SUPPORT',
          tags: ['Docker', 'Memory', 'WSL'],
          keywords: ['docker', 'memory', 'wsl', 'ram'],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('DRAFT');
      createdArticleId = res.body.id;
    });

    it('GET /knowledge-base/:id -> should hide draft from customer and allow admin', async () => {
      // Customer gets 404
      await request(app.getHttpServer())
        .get(`/knowledge-base/${createdArticleId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);

      // Admin gets 200
      const res = await request(app.getHttpServer())
        .get(`/knowledge-base/${createdArticleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdArticleId);
      expect(res.body.status).toBe('DRAFT');
    });

    it('POST /knowledge-base/:id/publish -> should allow admin to publish article and then customer can view it', async () => {
      // Publish as admin
      const publishRes = await request(app.getHttpServer())
        .post(`/knowledge-base/${createdArticleId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(publishRes.body.status).toBe('PUBLISHED');

      // Now customer can view it
      const viewRes = await request(app.getHttpServer())
        .get(`/knowledge-base/${createdArticleId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(viewRes.body.id).toBe(createdArticleId);
    });

    it('POST /knowledge-base/:id/feedback -> should record customer helpful vote', async () => {
      const res = await request(app.getHttpServer())
        .post(`/knowledge-base/${createdArticleId}/feedback`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ helpful: true })
        .expect(201);

      expect(res.body.helpfulCount).toBeGreaterThanOrEqual(1);
    });

    it('DELETE /knowledge-base/:id -> should allow admin to clean up article', async () => {
      await request(app.getHttpServer())
        .delete(`/knowledge-base/${createdArticleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Reports & Export Flow (/reports)', () => {
    it('GET /reports/summary -> should reject customer access with 403 and return metrics for staff', async () => {
      // Customer gets 403 Forbidden
      await request(app.getHttpServer())
        .get('/reports/summary')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      // Staff gets 200 OK
      const res = await request(app.getHttpServer())
        .get('/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.kpis).toBeDefined();
      expect(typeof res.body.kpis.totalTickets).toBe('number');
      expect(res.body.departments).toBeDefined();
    });
  });
});
