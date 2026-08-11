import { IsEnum, IsString } from 'class-validator';

export enum WebhookOutcome {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

// mock provider's webhook payload shape — a real gateway's shape would be
// provider-specific, this stands in for one to demonstrate the pattern
export class PaymentWebhookDto {
  @IsString()
  providerTransactionId: string;

  @IsEnum(WebhookOutcome)
  status: WebhookOutcome;
}
