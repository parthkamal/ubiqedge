import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { InvoiceModule } from '../invoice/invoice.module';
import { PaymentController } from './payment.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentService } from './payment.service';
import { PaymentSignatureGuard } from './guards/payment-signature.guard';

@Module({
  // CustomerInvoice repo comes via InvoiceModule's exported TypeOrmModule
  imports: [TypeOrmModule.forFeature([PaymentTransaction]), InvoiceModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PaymentService, PaymentSignatureGuard],
  exports: [TypeOrmModule],
})
export class PaymentModule {}
