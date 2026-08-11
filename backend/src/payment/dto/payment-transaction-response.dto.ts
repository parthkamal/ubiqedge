import { PaymentTransaction, PaymentStatus } from '../entities/payment-transaction.entity';

export class PaymentTransactionResponseDto {
  id: number;
  provider: string;
  providerTransactionId: string;
  amount: string;
  status: PaymentStatus;
  createdAt: Date;

  static fromEntity(transaction: PaymentTransaction): PaymentTransactionResponseDto {
    const dto = new PaymentTransactionResponseDto();
    dto.id = transaction.id;
    dto.provider = transaction.provider;
    dto.providerTransactionId = transaction.providerTransactionId;
    dto.amount = transaction.amount;
    dto.status = transaction.status;
    dto.createdAt = transaction.createdAt;
    return dto;
  }
}
