import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root or local .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/ticketsupport?schema=public';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const OFFICIAL_2026_PH_HOLIDAYS = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-17', name: 'Chinese New Year' },
  { date: '2026-04-02', name: 'Maundy Thursday' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-04', name: 'Black Saturday' },
  { date: '2026-04-09', name: 'Araw ng Kagitingan' },
  { date: '2026-05-01', name: 'Labor Day' },
  { date: '2026-06-12', name: 'Independence Day' },
  { date: '2026-08-21', name: 'Ninoy Aquino Day' },
  { date: '2026-08-31', name: 'National Heroes Day' },
  { date: '2026-11-01', name: "All Saints' Day" },
  { date: '2026-11-02', name: "All Saints' Day Eve" },
  { date: '2026-11-30', name: 'Bonifacio Day' },
  { date: '2026-12-08', name: 'Feast of the Immaculate Conception' },
  { date: '2026-12-24', name: 'Christmas Eve' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-30', name: 'Rizal Day' },
  { date: '2026-12-31', name: 'Last Day of the Year' },
];

async function main() {
  console.log('--- TicketSupport Database Seed ---');

  // 1. Resolve Seed Accounts
  const candidatePaths = [
    path.resolve(process.cwd(), 'seed.local.json'),
    path.resolve(process.cwd(), 'apps/api/seed.local.json'),
    path.resolve(__dirname, '../seed.local.json'),
    path.resolve(__dirname, '../../../seed.local.json'),
  ];

  let rawAccounts = [];
  for (const p of candidatePaths) {
    if (existsSync(p)) {
      try {
        rawAccounts = JSON.parse(readFileSync(p, 'utf-8'));
        console.log(`Loaded accounts from: ${p}`);
        break;
      } catch {
        // Skip unparseable candidate
      }
    }
  }

  // Fallback defaults if seed.local.json is missing on a fresh clone
  if (rawAccounts.length === 0) {
    rawAccounts = [
      {
        email: 'admin@ticketsupport.local',
        fullName: 'Alex Rivera (IT Admin)',
        password: 'LocalDevAdminPassword123!',
        role: 'ADMIN',
      },
      {
        email: 'agent@ticketsupport.local',
        fullName: 'Sam Chen (Support Engineer)',
        password: 'LocalDevAgentPassword123!',
        role: 'AGENT',
      },
      {
        email: 'customer@ticketsupport.local',
        fullName: 'Jane Doe',
        password: 'LocalDevCustomerPassword123!',
        role: 'CUSTOMER',
      },
    ];
    console.log('Using default development accounts');
  }

  // 2. Seed Users
  for (const acc of rawAccounts) {
    const email = String(acc.email).toLowerCase().trim();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(acc.password, salt);
    const defaultSpecialties =
      acc.role === 'AGENT'
        ? ['NETWORK', 'IDENTITY', 'SOFTWARE']
        : acc.role === 'ADMIN'
          ? ['NETWORK', 'IDENTITY', 'BILLING', 'HARDWARE', 'SOFTWARE']
          : [];

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        fullName: acc.fullName,
        role: acc.role,
        passwordHash,
        specialties: defaultSpecialties,
      },
      create: {
        email,
        fullName: acc.fullName,
        role: acc.role,
        passwordHash,
        specialties: defaultSpecialties,
      },
    });

    console.log(`✓ User [${acc.role}]: ${user.email}`);
  }

  // 3. Seed Philippines Business Calendar
  let phCalendar = await prisma.businessCalendar.findFirst({
    where: { name: 'Philippines Standard' },
  });

  if (!phCalendar) {
    phCalendar = await prisma.businessCalendar.create({
      data: {
        name: 'Philippines Standard',
        timezone: 'Asia/Manila',
        isDefault: true,
        workingWindows: {
          create: [1, 2, 3, 4, 5].flatMap((weekday) => [
            { weekday, startMinute: 480, endMinute: 720 },
            { weekday, startMinute: 780, endMinute: 1020 },
          ]),
        },
        holidays: {
          create: OFFICIAL_2026_PH_HOLIDAYS.map((h) => ({
            date: h.date,
            name: h.name,
          })),
        },
      },
    });
    console.log('✓ Business Calendar: Philippines Standard (with 2026 holidays)');
  } else {
    console.log('✓ Business Calendar: Philippines Standard already exists');
  }

  // 4. Seed Default SLA Policies
  const existingPoliciesCount = await prisma.slaPolicy.count();
  if (existingPoliciesCount === 0) {
    await prisma.slaPolicy.createMany({
      data: [
        {
          name: 'Urgent Priority (24/7)',
          priority: 'URGENT',
          department: null,
          firstResponseMinutes: 30,
          resolutionMinutes: 240,
          warnAtPercent: 75,
          is24x7: true,
          enabled: true,
          calendarId: null,
        },
        {
          name: 'High Priority (Business Hours)',
          priority: 'HIGH',
          department: null,
          firstResponseMinutes: 120,
          resolutionMinutes: 480,
          warnAtPercent: 75,
          is24x7: false,
          enabled: true,
          calendarId: phCalendar.id,
        },
        {
          name: 'Medium Priority (Business Hours)',
          priority: 'MEDIUM',
          department: null,
          firstResponseMinutes: 480,
          resolutionMinutes: 1440,
          warnAtPercent: 75,
          is24x7: false,
          enabled: true,
          calendarId: phCalendar.id,
        },
        {
          name: 'Low Priority (Business Hours)',
          priority: 'LOW',
          department: null,
          firstResponseMinutes: 1440,
          resolutionMinutes: 4320,
          warnAtPercent: 75,
          is24x7: false,
          enabled: true,
          calendarId: phCalendar.id,
        },
      ],
    });
    console.log('✓ SLA Policies: URGENT (24/7), HIGH, MEDIUM, LOW seeded');
  } else {
    console.log('✓ SLA Policies: already configured');
  }

  await prisma.$disconnect();
  await pool.end();
  console.log('--- Seed Completed Successfully ---');
}

main().catch((err) => {
  console.error('Failed to seed database:', err);
  process.exit(1);
});
