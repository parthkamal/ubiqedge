import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '../user/entities/role.entity';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// lives alongside InvoiceController on the same 'invoices' base path —
// distinct controller class since payment logic/entities belong to
// PaymentModule, not InvoiceModule; route shapes don't collide
@ApiTags('payments')
@ApiBearerAuth()
@Controller('invoices')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Roles(RoleType.CUSTOMER)
  @Post(':id/pay')
  initiate(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.paymentService.initiate(id, currentUser);
  }

  // no @Roles() — Admin or the owning Customer, enforced inside the service
  @Get(':id/payments')
  findForInvoice(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.paymentService.findForInvoice(id, currentUser);
  }
}
