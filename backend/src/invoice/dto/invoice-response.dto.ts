import { CustomerInvoice, InvoiceStatus } from '../entities/customer-invoice.entity';

class InvoiceDeviceSummary {
  id: number;
  name: string;
  serialNo: string;
}

export class InvoiceResponseDto {
  id: number;
  serialNo: string;
  device: InvoiceDeviceSummary;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  openingReading: string;
  closingReading: string;
  consumptionUnits: string;
  appliedUnitRate: string;
  amount: string;
  status: InvoiceStatus;
  transactionId: string | null;
  transactionProvider: string | null;
  generatedAt: Date;
  dueDate: string | null;

  static fromEntity(invoice: CustomerInvoice): InvoiceResponseDto {
    const dto = new InvoiceResponseDto();
    dto.id = invoice.id;
    dto.serialNo = invoice.serialNo;
    dto.device = {
      id: invoice.device.id,
      name: invoice.device.name,
      serialNo: invoice.device.serialNo,
    };
    dto.billingPeriodStart = invoice.billingPeriodStart;
    dto.billingPeriodEnd = invoice.billingPeriodEnd;
    dto.openingReading = invoice.openingReading;
    dto.closingReading = invoice.closingReading;
    dto.consumptionUnits = invoice.consumptionUnits;
    dto.appliedUnitRate = invoice.appliedUnitRate;
    dto.amount = invoice.amount;
    dto.status = invoice.status;
    dto.transactionId = invoice.transactionId;
    dto.transactionProvider = invoice.transactionProvider;
    dto.generatedAt = invoice.generatedAt;
    dto.dueDate = invoice.dueDate;
    return dto;
  }
}
