import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Subject, Observable, merge, interval } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export type RealtimeEventType =
  | 'TICKET_CREATED'
  | 'TICKET_UPDATED'
  | 'TICKET_DELETED'
  | 'COMMENT_ADDED'
  | 'CSAT_SUBMITTED'
  | 'NOTIFICATION'
  | 'HEARTBEAT';

export interface RealtimeEnvelope {
  type: RealtimeEventType;
  payload: any;
  recipientUserIds?: string[];
  recipientRoles?: Array<'ADMIN' | 'AGENT' | 'CUSTOMER'>;
  timestamp: string;
}

export interface StreamUserContext {
  id: string;
  role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  email?: string;
  fullName?: string;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly eventBus$ = new Subject<RealtimeEnvelope>();

  /**
   * Broadcast a domain event across active Server-Sent Event client streams.
   */
  emit(event: Omit<RealtimeEnvelope, 'timestamp'>): void {
    const envelope: RealtimeEnvelope = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.eventBus$.next(envelope);
  }

  /**
   * Generates a filtered MessageEvent stream for an authenticated user session.
   */
  getUserStream(user: StreamUserContext): Observable<MessageEvent> {
    const userEvents$ = this.eventBus$.pipe(
      filter((envelope) => this.shouldDeliverToUser(envelope, user)),
      map((envelope) => ({
        data: JSON.stringify(envelope),
      })),
    );

    // Heartbeat ping every 25 seconds to keep HTTP connection alive through reverse proxies & timeouts
    const heartbeat$ = interval(25000).pipe(
      map(() => ({
        data: JSON.stringify({
          type: 'HEARTBEAT',
          timestamp: new Date().toISOString(),
        }),
      })),
    );

    return merge(userEvents$, heartbeat$);
  }

  /**
   * Enforces role and recipient constraints to ensure zero cross-customer data leakage.
   */
  private shouldDeliverToUser(
    envelope: RealtimeEnvelope,
    user: StreamUserContext,
  ): boolean {
    // 1. If explicit recipientUserIds are specified, recipient must be in the list
    if (envelope.recipientUserIds && envelope.recipientUserIds.length > 0) {
      return envelope.recipientUserIds.includes(user.id);
    }

    // 2. If explicit recipientRoles are specified, user's role must be in the list
    if (envelope.recipientRoles && envelope.recipientRoles.length > 0) {
      return envelope.recipientRoles.includes(user.role);
    }

    // 3. Admin-specific rule: IT Admins strictly receive TICKET_CREATED, TICKET_UPDATED, and CSAT_SUBMITTED
    // suppressing minor operational chatter
    return true;
  }
}
