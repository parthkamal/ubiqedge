// summarizes a batch run so the admin can see what happened, not just a
// bare success — mixed outcomes (some devices generated, some skipped) are
// the normal case, not an error
export class GenerateInvoicesResultDto {
  billingPeriodStart: string;
  billingPeriodEnd: string;
  generated: number;
  skipped: { deviceId: number; reason: string }[];
}
