import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: pg.Pool;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/ticketsupport?schema=public';

    const pool = new pg.Pool({ connectionString });

    // Serialize concurrent queries on checked-out transaction clients for pg@9.0 compatibility
    const origConnect = pool.connect.bind(pool);
    pool.connect = (async (...args: unknown[]) => {
      const client = await (origConnect as (...a: unknown[]) => Promise<pg.PoolClient>)(...args);
      const taggedClient = client as pg.PoolClient & { _serializedQuery?: boolean };
      if (taggedClient && !taggedClient._serializedQuery) {
        const origQuery = taggedClient.query.bind(taggedClient);
        let queue: Promise<unknown> = Promise.resolve();
        taggedClient.query = ((...queryArgs: unknown[]) => {
          const next = queue.then(
            () => (origQuery as (...a: unknown[]) => unknown)(...queryArgs),
            () => (origQuery as (...a: unknown[]) => unknown)(...queryArgs),
          );
          queue = next;
          return next;
        }) as typeof taggedClient.query;
        taggedClient._serializedQuery = true;
      }
      return client;
    }) as typeof pool.connect;

    const adapter = new PrismaPg(pool, { disposeExternalPool: true });
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
