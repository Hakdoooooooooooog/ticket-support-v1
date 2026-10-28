import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  CreateCannedResponseInput,
  UpdateCannedResponseInput,
  CannedResponseResponse,
} from './dto/canned-response.dto.js';

export const INITIAL_DEFAULT_TEMPLATES: Array<{
  category: string;
  label: string;
  content: string;
}> = [
  {
    category: 'Troubleshooting',
    label: 'Hardware Power Cycle',
    content:
      'Hello {{customer_name}},\n\nPlease perform a full power cycle on your device: shut down the system, disconnect the power cable for 30 seconds, reconnect, and restart. Please confirm if ticket {{ticket_id}} persists after reboot.',
  },
  {
    category: 'Troubleshooting',
    label: 'VPN & DNS Cache Flush',
    content:
      'Hello {{customer_name}},\n\nPlease disconnect from the corporate VPN, open Command Prompt or Terminal, execute "ipconfig /flushdns" (or "sudo dscacheutil -flushcache" on macOS), and reconnect. Let us know if internal services are accessible.',
  },
  {
    category: 'Troubleshooting',
    label: 'Clear Browser Cache & Cookies',
    content:
      'Please clear your browser cookies and cached images/files (or try in a private/incognito browsing window). Afterwards, refresh the page to see if the issue with "{{ticket_title}}" clears.',
  },
  {
    category: 'Information Request',
    label: 'Request Screenshot / Error Log',
    content:
      'Hello {{customer_name}},\n\nCould you please attach a full-screen screenshot showing the exact error message or dialogue for ticket {{ticket_id}}, along with the browser console log (F12 > Console tab) if applicable?',
  },
  {
    category: 'Information Request',
    label: 'Request Step-by-Step Reproduction',
    content:
      'To help us isolate the root cause of "{{ticket_title}}", could you share the exact steps to reproduce this behavior (e.g., URL visited, buttons clicked, expected vs actual outcome)?',
  },
  {
    category: 'Status & Escalation',
    label: 'Escalate to Tier 2 Engineering',
    content:
      'Hello {{customer_name}},\n\nTicket {{ticket_id}} has been escalated to Tier 2 Infrastructure & Backend Engineering for detailed telemetry and log analysis. We will follow up with an update within 4 hours.\n\nBest regards,\n{{agent_name}}',
  },
  {
    category: 'Status & Escalation',
    label: 'Upstream Vendor / Provider Escalation',
    content:
      'We have opened an urgent upstream support incident with the service provider regarding ticket {{ticket_id}}. We are monitoring the vendor SLA and will update you as soon as new status is reported.',
  },
  {
    category: 'Resolution',
    label: 'Resolution Applied / Verification',
    content:
      'Hello {{customer_name}},\n\nWe have applied the configuration fix for "{{ticket_title}}". Please verify normal operation and let us know if everything is functioning as expected!\n\nBest regards,\n{{agent_name}}',
  },
  {
    category: 'Resolution',
    label: 'Issue Resolved / Ready to Close',
    content:
      'The reported issue on ticket {{ticket_id}} has been diagnosed and resolved. If no further issues occur, you may confirm resolution in the customer portal. Feel free to reply if you need any further assistance!\n\nThank you,\n{{agent_name}}',
  },
];

@Injectable()
export class CannedResponsesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const count = await this.prisma.cannedResponse.count();
      if (count === 0) {
        for (const template of INITIAL_DEFAULT_TEMPLATES) {
          await this.prisma.cannedResponse.create({
            data: {
              category: template.category,
              label: template.label,
              content: template.content,
              createdById: null,
            },
          });
        }
      }
    } catch {
      // Non-blocking in case migration is running
    }
  }

  async findAll(): Promise<CannedResponseResponse[]> {
    const list = await this.prisma.cannedResponse.findMany({
      orderBy: [{ category: 'asc' }, { label: 'asc' }],
    });

    return list.map((item) => ({
      id: item.id,
      category: item.category,
      label: item.label,
      content: item.content,
      isSystem: !item.createdById,
      createdById: item.createdById,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async create(input: CreateCannedResponseInput, userId?: string): Promise<CannedResponseResponse> {
    const created = await this.prisma.cannedResponse.create({
      data: {
        category: input.category.trim(),
        label: input.label.trim(),
        content: input.content.trim(),
        createdById: userId || null,
      },
    });

    return {
      id: created.id,
      category: created.category,
      label: created.label,
      content: created.content,
      isSystem: !created.createdById,
      createdById: created.createdById,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async update(id: string, input: UpdateCannedResponseInput): Promise<CannedResponseResponse> {
    const existing = await this.prisma.cannedResponse.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Canned response template with ID ${id} not found`);
    }

    const updated = await this.prisma.cannedResponse.update({
      where: { id },
      data: {
        ...(input.category ? { category: input.category.trim() } : {}),
        ...(input.label ? { label: input.label.trim() } : {}),
        ...(input.content ? { content: input.content.trim() } : {}),
      },
    });

    return {
      id: updated.id,
      category: updated.category,
      label: updated.label,
      content: updated.content,
      isSystem: !updated.createdById,
      createdById: updated.createdById,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async delete(id: string): Promise<{ success: boolean; id: string }> {
    const existing = await this.prisma.cannedResponse.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Canned response template with ID ${id} not found`);
    }

    await this.prisma.cannedResponse.delete({ where: { id } });
    return { success: true, id };
  }
}
