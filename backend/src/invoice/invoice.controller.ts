import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '../user/entities/role.entity';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Roles(RoleType.ADMIN)
  @Post('generate')
  generate(@Body() dto: GenerateInvoicesDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.invoiceService.generateForPeriod(dto, currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Get()
  findAll(@Query() query: ListInvoicesQueryDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.invoiceService.findAll(query, currentUser);
  }

  // no @Roles() — Admin or the owning Customer, enforced inside the service
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.invoiceService.findOne(id, currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.invoiceService.cancel(id, currentUser);
  }
}
