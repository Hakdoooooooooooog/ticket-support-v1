import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

    it('POST /auth/login -> should authenticate valid user and return accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'SecurePassword123!',
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.passwordHash).toBeUndefined();
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

    it('PATCH /tickets/:id -> should update ticket status and priority', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .send({
          status: 'IN_PROGRESS',
          priority: 'HIGH',
        })
        .expect(200);

      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.priority).toBe('HIGH');
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
});
