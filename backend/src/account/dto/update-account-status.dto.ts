import { IsEnum } from 'class-validator';
import { ConnectionStatus } from '../entities/customer-connection.entity';

export class UpdateAccountStatusDto {
  @IsEnum(ConnectionStatus)
  status: ConnectionStatus;
}
