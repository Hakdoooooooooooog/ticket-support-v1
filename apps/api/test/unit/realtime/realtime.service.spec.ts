import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeService } from '../../../src/realtime/realtime.service.js';

describe('RealtimeService', () => {
  let service: RealtimeService;

  beforeEach(() => {
    service = new RealtimeService();
  });

  it('broadcasts events to users matching recipient roles', async () => {
    const adminUser = { id: 'admin-1', role: 'ADMIN' as const, email: 'admin@example.com' };
    const customerUser = { id: 'cust-1', role: 'CUSTOMER' as const, email: 'cust@example.com' };

    const adminStream = service.getUserStream(adminUser);
    const customerStream = service.getUserStream(customerUser);

    const receivedAdminEvents: any[] = [];
    const receivedCustomerEvents: any[] = [];

    const sub1 = adminStream.subscribe((msg) => receivedAdminEvents.push(JSON.parse(msg.data as string)));
    const sub2 = customerStream.subscribe((msg) => receivedCustomerEvents.push(JSON.parse(msg.data as string)));

    // Emit event intended only for ADMIN and AGENT
    service.emit({
      type: 'TICKET_CREATED',
      recipientRoles: ['ADMIN', 'AGENT'],
      payload: { id: 'ticket-99', title: 'Server crash' },
    });

    sub1.unsubscribe();
    sub2.unsubscribe();

    expect(receivedAdminEvents).toHaveLength(1);
    expect(receivedAdminEvents[0].type).toBe('TICKET_CREATED');
    expect(receivedAdminEvents[0].payload.id).toBe('ticket-99');

    // Customer should not have received this operational event
    expect(receivedCustomerEvents).toHaveLength(0);
  });

  it('delivers events matching specific recipient user IDs', async () => {
    const targetUser = { id: 'user-42', role: 'CUSTOMER' as const, email: 'target@example.com' };
    const otherUser = { id: 'user-99', role: 'CUSTOMER' as const, email: 'other@example.com' };

    const targetStream = service.getUserStream(targetUser);
    const otherStream = service.getUserStream(otherUser);

    const receivedTargetEvents: any[] = [];
    const receivedOtherEvents: any[] = [];

    const sub1 = targetStream.subscribe((msg) => receivedTargetEvents.push(JSON.parse(msg.data as string)));
    const sub2 = otherStream.subscribe((msg) => receivedOtherEvents.push(JSON.parse(msg.data as string)));

    // Emit notification specifically for user-42
    service.emit({
      type: 'NOTIFICATION',
      recipientUserIds: ['user-42'],
      payload: { title: 'Ticket Resolved', message: 'Your issue has been resolved' },
    });

    sub1.unsubscribe();
    sub2.unsubscribe();

    expect(receivedTargetEvents).toHaveLength(1);
    expect(receivedTargetEvents[0].type).toBe('NOTIFICATION');
    expect(receivedTargetEvents[0].payload.title).toBe('Ticket Resolved');

    expect(receivedOtherEvents).toHaveLength(0);
  });
});
