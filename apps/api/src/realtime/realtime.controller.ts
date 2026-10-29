import { Controller, Sse, UseGuards, Req, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Observable } from 'rxjs';
import { RealtimeService } from './realtime.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@SkipThrottle()
@ApiTags('Realtime')
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Sse('stream')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Server-Sent Events (SSE) live event stream',
    description:
      'Provides a persistent real-time event stream for ticket updates, resolution notes, and role-scoped notifications. Authenticates via Bearer header or "?token=<jwt>" query parameter.',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'JWT Bearer token for EventSource authentication in browsers',
  })
  stream(@Req() req: any): Observable<MessageEvent> {
    const user = req.user;
    return this.realtimeService.getUserStream(user);
  }
}
