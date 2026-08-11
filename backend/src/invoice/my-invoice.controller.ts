import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { ListMyInvoicesQueryDto } from './dto/list-my-invoices-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '../user/entities/role.entity';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// lives in InvoiceModule despite the /accounts/me prefix — same rationale
// as MyDeviceController: avoids a circular module dependency the other way
@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts/me/invoices')
export class MyInvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Roles(RoleType.CUSTOMER)
  @Get()
  findMine(@Query() query: ListMyInvoicesQueryDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.invoiceService.findMine(query, currentUser);
  }
}
