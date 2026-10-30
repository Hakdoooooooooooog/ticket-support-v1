import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { calculateTargetDate, CalendarConfig } from './sla-calculator.util.js';
import {
  UpdateSlaPolicyDto,
  CreateBusinessCalendarDto,
  UpdateBusinessCalendarDto,
  AddHolidayDto,
} from './dto/sla.dto.js';
import { Department, TicketPriority, TicketStatus } from '@prisma/client';

export const OFFICIAL_2026_PH_HOLIDAYS = [
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

@Injectable()
export class SlaService implements OnModuleInit {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultsIfMissing();
  }

  async seedDefaultsIfMissing() {
    if (typeof this.prisma?.businessCalendar?.findFirst !== 'function') return;

    try {
      // 1. Ensure Philippines Standard Calendar exists
      let phCalendar = await this.prisma.businessCalendar.findFirst({
        where: { name: 'Philippines Standard' },
      });

      if (!phCalendar) {
        phCalendar = await this.prisma.businessCalendar.create({
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
        this.logger.log('Seeded default Philippines Standard business calendar with 2026 holidays');
      }

      // 2. Ensure Default SLA Policies exist
      const existingPoliciesCount = await this.prisma.slaPolicy.count();
      if (existingPoliciesCount === 0) {
        await this.prisma.slaPolicy.createMany({
          data: [
            {
              name: 'Urgent Priority (24/7)',
              priority: TicketPriority.URGENT,
              department: null,
              firstResponseMinutes: 30,
              resolutionMinutes: 240, // 4 hours
              warnAtPercent: 75,
              is24x7: true,
              enabled: true,
              calendarId: null,
            },
            {
              name: 'High Priority (Business Hours)',
              priority: TicketPriority.HIGH,
              department: null,
              firstResponseMinutes: 120, // 2 hours
              resolutionMinutes: 480, // 8 business hours
              warnAtPercent: 75,
              is24x7: false,
              enabled: true,
              calendarId: phCalendar.id,
            },
            {
              name: 'Medium Priority (Business Hours)',
              priority: TicketPriority.MEDIUM,
              department: null,
              firstResponseMinutes: 480, // 8 business hours
              resolutionMinutes: 1440, // 24 business hours (3 days)
              warnAtPercent: 75,
              is24x7: false,
              enabled: true,
              calendarId: phCalendar.id,
            },
            {
              name: 'Low Priority (Business Hours)',
              priority: TicketPriority.LOW,
              department: null,
              firstResponseMinutes: 1440, // 24 business hours
              resolutionMinutes: 4320, // 72 business hours
              warnAtPercent: 75,
              is24x7: false,
              enabled: true,
              calendarId: phCalendar.id,
            },
          ],
        });
        this.logger.log('Seeded default SLA policies for URGENT, HIGH, MEDIUM, LOW priorities');
      }
    } catch (err) {
      this.logger.warn(`Failed to seed SLA defaults: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Retrieves active SLA policy for ticket based on priority and optional department.
   */
  async findPolicyForTicket(priority: TicketPriority, department?: Department | null) {
    if (department) {
      const deptPolicy = await this.prisma.slaPolicy.findFirst({
        where: { priority, department, enabled: true },
        include: {
          calendar: {
            include: { workingWindows: true, holidays: true },
          },
        },
      });
      if (deptPolicy) return deptPolicy;
    }

    return this.prisma.slaPolicy.findFirst({
      where: { priority, department: null, enabled: true },
      include: {
        calendar: {
          include: { workingWindows: true, holidays: true },
        },
      },
    });
  }

  /**
   * Calculates firstResponseDueAt and resolutionDueAt for a ticket given its creation time.
   */
  async calculateTicketDueDates(
    createdAt: Date,
    priority: TicketPriority,
    department?: Department | null,
  ): Promise<{ firstResponseDueAt: Date; resolutionDueAt: Date } | null> {
    const policy = await this.findPolicyForTicket(priority, department);
    if (!policy) {
      return null;
    }

    const calendarConfig: CalendarConfig = {
      timezone: policy.calendar?.timezone || 'Asia/Manila',
      workingWindows: policy.calendar?.workingWindows || [],
      holidays: policy.calendar?.holidays || [],
    };

    const firstResponseDueAt = calculateTargetDate(
      createdAt,
      policy.firstResponseMinutes,
      calendarConfig,
      policy.is24x7,
    );

    const resolutionDueAt = calculateTargetDate(
      createdAt,
      policy.resolutionMinutes,
      calendarConfig,
      policy.is24x7,
    );

    return { firstResponseDueAt, resolutionDueAt };
  }

  /**
   * Called when a ticket is created or re-prioritized.
   */
  async applySlaToTicket(
    ticketId: string,
    priority: TicketPriority,
    department?: Department | null,
    createdAt: Date = new Date(),
    tx: PrismaService = this.prisma,
  ) {
    const dueDates = await this.calculateTicketDueDates(createdAt, priority, department);
    if (!dueDates) return null;

    return tx.ticket.update({
      where: { id: ticketId },
      data: {
        firstResponseDueAt: dueDates.firstResponseDueAt,
        resolutionDueAt: dueDates.resolutionDueAt,
      },
    });
  }

  /**
   * Handles pause/resume SLA clock behavior during status transitions.
   */
  async handleStatusChange(
    ticketId: string,
    oldStatus: TicketStatus,
    newStatus: TicketStatus,
    existingTicket: {
      slaPausedAt?: Date | null;
      firstResponseDueAt?: Date | null;
      resolutionDueAt?: Date | null;
      resolvedAt?: Date | null;
    },
    tx: PrismaService = this.prisma,
  ) {
    const now = new Date();
    const updateData: Record<string, unknown> = {};

    // 1. Entering NEEDS_INFO: pause the SLA clock
    if (newStatus === TicketStatus.NEEDS_INFO && oldStatus !== TicketStatus.NEEDS_INFO) {
      if (!existingTicket.slaPausedAt) {
        updateData.slaPausedAt = now;
      }
    }

    // 2. Leaving NEEDS_INFO: resume the SLA clock and push deadlines forward
    if (oldStatus === TicketStatus.NEEDS_INFO && newStatus !== TicketStatus.NEEDS_INFO) {
      if (existingTicket.slaPausedAt) {
        const pausedMs = now.getTime() - new Date(existingTicket.slaPausedAt).getTime();
        if (pausedMs > 0) {
          if (existingTicket.firstResponseDueAt) {
            updateData.firstResponseDueAt = new Date(
              new Date(existingTicket.firstResponseDueAt).getTime() + pausedMs,
            );
          }
          if (existingTicket.resolutionDueAt) {
            updateData.resolutionDueAt = new Date(
              new Date(existingTicket.resolutionDueAt).getTime() + pausedMs,
            );
          }
        }
        updateData.slaPausedAt = null;
      }
    }

    // 3. Entering terminal state RESOLVED or CLOSED: stamp resolvedAt
    if (
      (newStatus === TicketStatus.RESOLVED || newStatus === TicketStatus.CLOSED) &&
      !existingTicket.resolvedAt
    ) {
      updateData.resolvedAt = now;
    }

    // 4. Reopening from RESOLVED or CLOSED: clear resolvedAt
    if (
      (oldStatus === TicketStatus.RESOLVED || oldStatus === TicketStatus.CLOSED) &&
      newStatus !== TicketStatus.RESOLVED &&
      newStatus !== TicketStatus.CLOSED
    ) {
      updateData.resolvedAt = null;
    }

    if (Object.keys(updateData).length > 0) {
      return tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });
    }

    return null;
  }

  /**
   * Handles first response timestamp when a staff member posts a public comment.
   */
  async handleStaffPublicComment(
    ticketId: string,
    existingFirstRespondedAt: Date | null,
    tx: PrismaService = this.prisma,
  ) {
    if (!existingFirstRespondedAt) {
      return tx.ticket.update({
        where: { id: ticketId },
        data: { firstRespondedAt: new Date() },
      });
    }
    return null;
  }

  /**
   * Background sweeper scheduled to run every 1 minute.
   * Checks open tickets for impending SLA warnings and breaches.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepSlaDeadlines() {
    try {
      const activeTickets = await this.prisma.ticket.findMany({
        where: {
          status: {
            notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.NEEDS_INFO],
          },
          OR: [
            { firstResponseDueAt: { not: null }, firstRespondedAt: null },
            { resolutionDueAt: { not: null }, resolvedAt: null },
          ],
        },
        include: {
          assignee: true,
        },
        take: 200,
      });

      if (activeTickets.length === 0) return;

      const now = new Date();

      for (const ticket of activeTickets) {
        // Fetch policy warn threshold
        const policy = await this.findPolicyForTicket(ticket.priority, ticket.department);
        const warnPercent = (policy?.warnAtPercent || 75) / 100;

        // 1. First Response SLA
        if (ticket.firstResponseDueAt && !ticket.firstRespondedAt) {
          const totalMs = ticket.firstResponseDueAt.getTime() - ticket.createdAt.getTime();
          const warnMs = ticket.createdAt.getTime() + totalMs * warnPercent;

          // Check breach
          if (now.getTime() >= ticket.firstResponseDueAt.getTime() && !ticket.firstResponseBreachedAt) {
            await this.prisma.ticket.update({
              where: { id: ticket.id },
              data: { firstResponseBreachedAt: now },
            });

            await this.triggerSlaAlert({
              ticketId: ticket.id,
              ticketTitle: ticket.title,
              assigneeId: ticket.assigneeId,
              type: 'SLA_BREACHED',
              targetType: 'First Response',
              dueAt: ticket.firstResponseDueAt,
            });
          }
          // Check warning
          else if (now.getTime() >= warnMs && !ticket.firstResponseWarnedAt && !ticket.firstResponseBreachedAt) {
            await this.prisma.ticket.update({
              where: { id: ticket.id },
              data: { firstResponseWarnedAt: now },
            });

            await this.triggerSlaAlert({
              ticketId: ticket.id,
              ticketTitle: ticket.title,
              assigneeId: ticket.assigneeId,
              type: 'SLA_WARNING',
              targetType: 'First Response',
              dueAt: ticket.firstResponseDueAt,
            });
          }
        }

        // 2. Resolution SLA
        if (ticket.resolutionDueAt && !ticket.resolvedAt) {
          const totalMs = ticket.resolutionDueAt.getTime() - ticket.createdAt.getTime();
          const warnMs = ticket.createdAt.getTime() + totalMs * warnPercent;

          // Check breach
          if (now.getTime() >= ticket.resolutionDueAt.getTime() && !ticket.resolutionBreachedAt) {
            await this.prisma.ticket.update({
              where: { id: ticket.id },
              data: { resolutionBreachedAt: now },
            });

            await this.triggerSlaAlert({
              ticketId: ticket.id,
              ticketTitle: ticket.title,
              assigneeId: ticket.assigneeId,
              type: 'SLA_BREACHED',
              targetType: 'Resolution',
              dueAt: ticket.resolutionDueAt,
            });
          }
          // Check warning
          else if (now.getTime() >= warnMs && !ticket.resolutionWarnedAt && !ticket.resolutionBreachedAt) {
            await this.prisma.ticket.update({
              where: { id: ticket.id },
              data: { resolutionWarnedAt: now },
            });

            await this.triggerSlaAlert({
              ticketId: ticket.id,
              ticketTitle: ticket.title,
              assigneeId: ticket.assigneeId,
              type: 'SLA_WARNING',
              targetType: 'Resolution',
              dueAt: ticket.resolutionDueAt,
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error during SLA sweep: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async triggerSlaAlert(params: {
    ticketId: string;
    ticketTitle: string;
    assigneeId?: string | null;
    type: 'SLA_WARNING' | 'SLA_BREACHED';
    targetType: 'First Response' | 'Resolution';
    dueAt: Date;
  }) {
    const isBreach = params.type === 'SLA_BREACHED';
    const alertTitle = isBreach
      ? `SLA Breached: ${params.targetType} on "${params.ticketTitle}"`
      : `SLA Warning: ${params.targetType} deadline nearing on "${params.ticketTitle}"`;

    const alertMessage = isBreach
      ? `The ${params.targetType.toLowerCase()} deadline (${params.dueAt.toISOString()}) was breached.`
      : `The ${params.targetType.toLowerCase()} deadline is approaching (${params.dueAt.toISOString()}).`;

    // 1. Notify Assignee if exists
    if (params.assigneeId) {
      await this.notificationsService.createNotification({
        userId: params.assigneeId,
        ticketId: params.ticketId,
        type: params.type,
        title: alertTitle,
        message: alertMessage,
      });
    }

    // 2. Notify Admins
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    for (const admin of admins) {
      if (admin.id !== params.assigneeId) {
        await this.notificationsService.createNotification({
          userId: admin.id,
          ticketId: params.ticketId,
          type: params.type,
          title: alertTitle,
          message: alertMessage,
        });
      }
    }

    // 3. Record Audit Log
    try {
      await this.auditService.record(this.prisma, {
        actorId: null,
        actorEmail: 'system@ticketsupport.local',
        actorRole: 'ADMIN',
        action: isBreach ? 'SLA_BREACH_TRIGGERED' : 'SLA_WARNING_TRIGGERED',
        entityType: 'TICKET',
        entityId: params.ticketId,
        summary: alertTitle,
        changes: {
          targetType: params.targetType,
          dueAt: params.dueAt.toISOString(),
          type: params.type,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write SLA audit log: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- CRUD API Methods for Admin Management ---

  async getAllPolicies() {
    return this.prisma.slaPolicy.findMany({
      include: {
        calendar: {
          include: { workingWindows: true, holidays: true },
        },
      },
      orderBy: [{ priority: 'asc' }, { department: 'asc' }],
    });
  }

  async updatePolicy(
    id: string,
    dto: UpdateSlaPolicyDto,
    actor?: { id?: string; email: string; role: 'ADMIN' | 'AGENT' | 'CUSTOMER' },
  ) {
    const existing = await this.prisma.slaPolicy.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`SLA Policy with ID "${id}" not found`);
    }

    const updated = await this.prisma.slaPolicy.update({
      where: { id },
      data: {
        firstResponseMinutes: dto.firstResponseMinutes,
        resolutionMinutes: dto.resolutionMinutes,
        warnAtPercent: dto.warnAtPercent,
        is24x7: dto.is24x7,
        enabled: dto.enabled,
        calendarId: dto.calendarId,
      },
      include: {
        calendar: {
          include: { workingWindows: true, holidays: true },
        },
      },
    });

    if (actor) {
      await this.auditService.record(this.prisma, {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SLA_POLICY_UPDATED',
        entityType: 'SLA',
        entityId: id,
        summary: `Updated SLA policy "${existing.name}"`,
        changes: { before: existing, after: updated },
      });
    }

    return updated;
  }

  async getAllCalendars() {
    return this.prisma.businessCalendar.findMany({
      include: {
        workingWindows: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
        holidays: { orderBy: { date: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCalendar(dto: CreateBusinessCalendarDto) {
    return this.prisma.businessCalendar.create({
      data: {
        name: dto.name,
        timezone: dto.timezone || 'Asia/Manila',
        isDefault: dto.isDefault || false,
        workingWindows: {
          create: dto.workingWindows || [],
        },
      },
      include: {
        workingWindows: true,
        holidays: true,
      },
    });
  }

  async updateCalendar(id: string, dto: UpdateBusinessCalendarDto) {
    const existing = await this.prisma.businessCalendar.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Calendar with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.workingWindows) {
        await tx.businessWindow.deleteMany({ where: { calendarId: id } });
        await tx.businessWindow.createMany({
          data: dto.workingWindows.map((w) => ({ ...w, calendarId: id })),
        });
      }

      return tx.businessCalendar.update({
        where: { id },
        data: {
          name: dto.name,
          timezone: dto.timezone,
          isDefault: dto.isDefault,
        },
        include: {
          workingWindows: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
          holidays: { orderBy: { date: 'asc' } },
        },
      });
    });
  }

  async addHoliday(calendarId: string, dto: AddHolidayDto) {
    const existing = await this.prisma.businessCalendar.findUnique({ where: { id: calendarId } });
    if (!existing) {
      throw new NotFoundException(`Calendar with ID "${calendarId}" not found`);
    }

    return this.prisma.holiday.upsert({
      where: {
        calendarId_date: {
          calendarId,
          date: dto.date,
        },
      },
      create: {
        calendarId,
        date: dto.date,
        name: dto.name,
        isMovable: dto.isMovable || false,
      },
      update: {
        name: dto.name,
        isMovable: dto.isMovable || false,
      },
    });
  }

  async removeHoliday(calendarId: string, holidayId: string) {
    const holiday = await this.prisma.holiday.findFirst({
      where: { id: holidayId, calendarId },
    });
    if (!holiday) {
      throw new NotFoundException(`Holiday with ID "${holidayId}" not found in calendar`);
    }

    await this.prisma.holiday.delete({ where: { id: holidayId } });
    return { success: true };
  }
}
