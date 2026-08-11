import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PaymentTransaction, PaymentStatus } from './entities/payment-transaction.entity';
import { CustomerInvoice, InvoiceStatus } from '../invoice/entities/customer-invoice.entity';
import { RoleType } from '../user/entities/role.entity';
import { PaymentWebhookDto, WebhookOutcome } from './dto/payment-webhook.dto';
import { PaymentSessionResponseDto } from './dto/payment-session-response.dto';
import { PaymentTransactionResponseDto } from './dto/payment-transaction-response.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const MOCK_PROVIDER = 'mock';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepository: Repository<PaymentTransaction>,
    @InjectRepository(CustomerInvoice) private readonly invoiceRepository: Repository<CustomerInvoice>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async initiate(
    invoiceId: number,
    currentUser: AuthenticatedUser,
  ): Promise<PaymentSessionResponseDto> {
    const invoice = await this.getOwnedInvoice(invoiceId, currentUser);
    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Only a pending invoice can be paid');
    }

    const providerTransactionId = randomUUID();
    const transaction = this.paymentRepository.create({
      invoiceId: invoice.id,
      provider: MOCK_PROVIDER,
      providerTransactionId,
      amount: invoice.amount,
      status: PaymentStatus.INITIATED,
      orgId: currentUser.orgId,
    });
    const saved = await this.paymentRepository.save(transaction);

    return {
      transactionId: saved.id,
      provider: MOCK_PROVIDER,
      providerTransactionId,
      amount: invoice.amount,
      // stands in for a real gateway's hosted-checkout redirect URL
      checkoutUrl: `https://mock-gateway.local/checkout/${providerTransactionId}`,
    };
  }

  async findForInvoice(
    invoiceId: number,
    currentUser: AuthenticatedUser,
  ): Promise<PaymentTransactionResponseDto[]> {
    await this.getOwnedInvoice(invoiceId, currentUser, { allowAdmin: true });

    const transactions = await this.paymentRepository.find({
      where: { invoiceId, orgId: currentUser.orgId },
      order: { createdAt: 'DESC' },
    });
    return transactions.map((t) => PaymentTransactionResponseDto.fromEntity(t));
  }

  // provider is untrusted input (from the URL), only used for lookup —
  // never assume it's one we actually issued a transaction under
  async handleWebhook(provider: string, dto: PaymentWebhookDto, rawBody: unknown): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOne(PaymentTransaction, {
        where: { provider, providerTransactionId: dto.providerTransactionId },
      });
      if (!transaction) {
        // don't throw — a provider retrying a webhook for something we
        // don't recognize shouldn't get an error response that triggers
        // more retries; log it and acknowledge
        this.logger.warn(`Webhook for unknown transaction ${provider}/${dto.providerTransactionId}`);
        return;
      }

      transaction.status = dto.status === WebhookOutcome.SUCCESS ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
      transaction.rawPayload = rawBody as Record<string, unknown>;
      await manager.save(transaction);

      if (dto.status === WebhookOutcome.SUCCESS) {
        const invoice = await manager.findOne(CustomerInvoice, { where: { id: transaction.invoiceId } });
        // naturally idempotent: a retried SUCCESS webhook finds the invoice
        // already PAID and no-ops here
        if (invoice && invoice.status === InvoiceStatus.PENDING) {
          invoice.status = InvoiceStatus.PAID;
          invoice.transactionId = transaction.providerTransactionId;
          invoice.transactionProvider = provider;
          await manager.save(invoice);
        }
      }
    });
  }

  private async getOwnedInvoice(
    invoiceId: number,
    currentUser: AuthenticatedUser,
    { allowAdmin = false }: { allowAdmin?: boolean } = {},
  ): Promise<CustomerInvoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, orgId: currentUser.orgId },
      relations: { device: { connection: true } },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const isOwner = invoice.device.connection?.userId === currentUser.userId;
    const isAllowedAdmin = allowAdmin && currentUser.roleType === RoleType.ADMIN;
    if (!isOwner && !isAllowedAdmin) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }
    return invoice;
  }
}
