import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateTicketDto {
  @ApiProperty({ description: 'Title of the ticket', example: 'Cannot access billing portal' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Detailed description of the issue',
    example: 'Getting a 500 error whenever navigating to /billing',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'Priority level of the ticket',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;
}
