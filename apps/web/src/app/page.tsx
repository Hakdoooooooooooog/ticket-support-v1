import { TicketForm } from '@components/forms/ticket-form';
import { TicketList } from '@components/ticket-list';

export default function Home() {
  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 rounded-full dark:bg-blue-950 dark:text-blue-300">
            Next.js 16 + React 19 + NestJS 12
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-slate-900 dark:text-white">
            TicketSupport Desk
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Enterprise monorepo featuring Tailwind CSS v4, shadcn/ui, TanStack Query, React Hook Form, and Prisma 7 PostgreSQL.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <TicketForm />
          <TicketList />
        </div>
      </div>
    </main>
  );
}
