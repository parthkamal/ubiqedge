import { CustomerConnection, ConnectionStatus } from '../entities/customer-connection.entity';

class AccountOwnerSummary {
  id: number;
  firstName: string;
  lastName: string | null;
  email: string;
}

// detail view (not a list), so embedding the owner summary costs nothing
// extra — one join, no N+1 risk — per ubiqedge_tech_api_design §1.10
export class AccountResponseDto {
  id: number;
  accountNo: string;
  status: ConnectionStatus;
  user: AccountOwnerSummary;
  createdAt: Date;
  updatedAt: Date | null;

  static fromEntity(connection: CustomerConnection): AccountResponseDto {
    const dto = new AccountResponseDto();
    dto.id = connection.id;
    dto.accountNo = connection.accountNo;
    dto.status = connection.status;
    dto.user = {
      id: connection.user.id,
      firstName: connection.user.firstName,
      lastName: connection.user.lastName,
      email: connection.user.email,
    };
    dto.createdAt = connection.createdAt;
    dto.updatedAt = connection.updatedAt;
    return dto;
  }
}
