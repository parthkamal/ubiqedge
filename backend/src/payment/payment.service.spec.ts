import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentService } from './payment.service';
import { PaymentTransaction, PaymentStatus } from './entities/payment-transaction.entity';
import { CustomerInvoice, InvoiceStatus } from '../invoice/entities/customer-invoice.entity';
import { WebhookOutcome } from './dto/payment-webhook.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RoleType } from '../user/entities/role.entity';

function mockRepo() {
  return { find: jest.fn(), findOne: jest.fn(), create: jest.fn((data) => data), save: jest.fn() };
}

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: ReturnType<typeof mockRepo>;
  let invoiceRepository: ReturnType<typeof mockRepo>;
  let manager: { findOne: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const customer: AuthenticatedUser = { userId: 5, orgId: 'ORG01', roleType: RoleType.CUSTOMER };
  const admin: AuthenticatedUser = { userId: 1, orgId: 'ORG01', roleType: RoleType.ADMIN };

  beforeEach(async () => {
    paymentRepository = mockRepo();
    invoiceRepository = mockRepo();
    manager = { findOne: jest.fn(), save: jest.fn((e) => Promise.resolve(e)) };
    dataSource = { transaction: jest.fn((cb) => cb(manager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(PaymentTransaction), useValue: paymentRepository },
        { provide: getRepositoryToken(CustomerInvoice), useValue: invoiceRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  describe('initiate', () => {
    it('404s when the invoice does not exist at all (distinct from an ownership denial)', async () => {
      invoiceRepository.findOne.mockResolvedValue(null);
      await expect(service.initiate(999, customer)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a non-PENDING invoice', async () => {
      invoiceRepository.findOne.mockResolvedValue({
        id: 1,
        status: InvoiceStatus.PAID,
        amount: '100.00',
        device: { connection: { userId: 5 } },
      } as unknown as CustomerInvoice);

      await expect(service.initiate(1, customer)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the invoice does not belong to the requesting customer', async () => {
      invoiceRepository.findOne.mockResolvedValue({
        id: 1,
        status: InvoiceStatus.PENDING,
        amount: '100.00',
        device: { connection: { userId: 999 } }, // different customer
      } as unknown as CustomerInvoice);

      await expect(service.initiate(1, customer)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates an INITIATED transaction and returns a checkout session for a pending, owned invoice', async () => {
      invoiceRepository.findOne.mockResolvedValue({
        id: 1,
        status: InvoiceStatus.PENDING,
        amount: '250.50',
        device: { connection: { userId: 5 } },
      } as unknown as CustomerInvoice);
      paymentRepository.save.mockImplementation((t) => Promise.resolve({ ...t, id: 42 }));

      const result = await service.initiate(1, customer);

      expect(result.transactionId).toBe(42);
      expect(result.amount).toBe('250.50');
      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.INITIATED, invoiceId: 1 }),
      );
    });
  });

  describe('handleWebhook — idempotency', () => {
    it('acknowledges (does not throw) a webhook for an unrecognized transaction', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.handleWebhook('mock', { providerTransactionId: 'unknown-id', status: WebhookOutcome.SUCCESS }, {}),
      ).resolves.toBeUndefined();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('on SUCCESS: marks the transaction SUCCESS and the invoice PAID', async () => {
      const transaction = {
        id: 1,
        invoiceId: 7,
        providerTransactionId: 'tx-1',
        status: PaymentStatus.INITIATED,
      } as unknown as PaymentTransaction;
      const invoice = { id: 7, status: InvoiceStatus.PENDING } as unknown as CustomerInvoice;
      manager.findOne.mockResolvedValueOnce(transaction).mockResolvedValueOnce(invoice);

      await service.handleWebhook('mock', { providerTransactionId: 'tx-1', status: WebhookOutcome.SUCCESS }, {});

      expect(transaction.status).toBe(PaymentStatus.SUCCESS);
      expect(invoice.status).toBe(InvoiceStatus.PAID);
      expect(invoice.transactionId).toBe('tx-1');
      expect(manager.save).toHaveBeenCalledTimes(2); // transaction, then invoice
    });

    it('a retried SUCCESS webhook against an already-PAID invoice is a no-op on the invoice', async () => {
      const transaction = {
        id: 1,
        invoiceId: 7,
        providerTransactionId: 'tx-1',
        status: PaymentStatus.SUCCESS, // already processed once
      } as unknown as PaymentTransaction;
      const invoice = { id: 7, status: InvoiceStatus.PAID } as unknown as CustomerInvoice; // already paid
      manager.findOne.mockResolvedValueOnce(transaction).mockResolvedValueOnce(invoice);

      await service.handleWebhook('mock', { providerTransactionId: 'tx-1', status: WebhookOutcome.SUCCESS }, {});

      // transaction re-saved (harmless, same status), but invoice is untouched —
      // the PENDING guard prevents a second PAID transition / overwritten transactionId
      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(manager.save).toHaveBeenCalledWith(transaction);
    });

    it('on FAILED: marks the transaction FAILED and never touches the invoice', async () => {
      const transaction = {
        id: 1,
        invoiceId: 7,
        providerTransactionId: 'tx-1',
        status: PaymentStatus.INITIATED,
      } as unknown as PaymentTransaction;
      manager.findOne.mockResolvedValueOnce(transaction);

      await service.handleWebhook('mock', { providerTransactionId: 'tx-1', status: WebhookOutcome.FAILED }, {});

      expect(transaction.status).toBe(PaymentStatus.FAILED);
      expect(manager.save).toHaveBeenCalledTimes(1);
      // only one findOne call (the transaction lookup) — invoice lookup never runs for a non-SUCCESS outcome
      expect(manager.findOne).toHaveBeenCalledTimes(1);
    });
  });

  // decision table for the shared ownership rule (getOwnedInvoice, private —
  // exercised through its two callers, which fix `allowAdmin` differently):
  // conditions are role x isOwner x allowAdmin. `initiate` always calls
  // with allowAdmin=false; `findForInvoice` always calls with
  // allowAdmin=true — so each method's table covers 4 of the 8 rows in
  // the full 2x2x2 condition space, together covering all of it.
  describe('ownership authorization (decision table)', () => {
    const owningConnection = { userId: customer.userId };
    const strangerConnection = { userId: 999 };

    describe('initiate (allowAdmin=false)', () => {
      it.each([
        ['Customer', 'owner', owningConnection, customer, 'allowed'],
        ['Customer', 'non-owner', strangerConnection, customer, 'denied'],
        ['Admin', 'owner', { userId: admin.userId }, admin, 'allowed'],
        ['Admin', 'non-owner', strangerConnection, admin, 'denied'],
      ])('role=%s, %s -> %s', async (_role, _owner, connection, actor, expected) => {
        invoiceRepository.findOne.mockResolvedValue({
          id: 1,
          status: InvoiceStatus.PENDING,
          amount: '10.00',
          device: { connection },
        } as unknown as CustomerInvoice);
        paymentRepository.save.mockImplementation((t) => Promise.resolve({ ...t, id: 1 }));

        const outcome = service.initiate(1, actor);
        if (expected === 'allowed') {
          await expect(outcome).resolves.toBeDefined();
        } else {
          await expect(outcome).rejects.toBeInstanceOf(NotFoundException);
        }
      });
    });

    describe('findForInvoice (allowAdmin=true)', () => {
      it.each([
        ['Customer', 'owner', owningConnection, customer, 'allowed'],
        ['Customer', 'non-owner', strangerConnection, customer, 'denied'],
        ['Admin', 'owner', { userId: admin.userId }, admin, 'allowed'],
        ['Admin', 'non-owner', strangerConnection, admin, 'allowed'], // the allowAdmin bypass
      ])('role=%s, %s -> %s', async (_role, _owner, connection, actor, expected) => {
        invoiceRepository.findOne.mockResolvedValue({
          id: 1,
          device: { connection },
        } as unknown as CustomerInvoice);
        paymentRepository.find.mockResolvedValue([]);

        const outcome = service.findForInvoice(1, actor);
        if (expected === 'allowed') {
          await expect(outcome).resolves.toEqual([]);
        } else {
          await expect(outcome).rejects.toBeInstanceOf(NotFoundException);
        }
      });
    });
  });
});
