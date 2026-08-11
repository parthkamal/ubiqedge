import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { PaymentSignatureGuard } from './guards/payment-signature.guard';
import { Public } from '../auth/decorators/public.decorator';

// literal path, version-neutral: global URI versioning would insert /v1/
// *before* the global-prefix-excluded 'payments' segment (giving
// /v1/payments/webhook/...), not the /payments/v1/webhook/... shape the API
// design calls for — VERSION_NEUTRAL opts this controller out of that so
// the path is exactly what's declared
@ApiTags('payments-webhook')
@Public()
@UseGuards(PaymentSignatureGuard)
@Controller({ path: 'payments/v1/webhook', version: VERSION_NEUTRAL })
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':provider')
  async handle(@Param('provider') provider: string, @Body() dto: PaymentWebhookDto) {
    await this.paymentService.handleWebhook(provider, dto, dto);
  }
}
