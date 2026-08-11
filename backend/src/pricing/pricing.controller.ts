import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { CreatePricingConfigDto } from './dto/create-pricing-config.dto';
import { ListPricingConfigsQueryDto } from './dto/list-pricing-configs-query.dto';
import { ActivePricingConfigQueryDto } from './dto/active-pricing-config-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '../user/entities/role.entity';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('pricing-configs')
@ApiBearerAuth()
@Roles(RoleType.ADMIN)
@Controller('pricing-configs')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post()
  create(@Body() dto: CreatePricingConfigDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.pricingService.create(dto, currentUser);
  }

  // must come before the bare list route in registration terms isn't an
  // issue here (different path shape, 'active' is a fixed segment not a
  // param) — but keep it above findAll for readability
  @Get('active')
  findActive(
    @Query() query: ActivePricingConfigQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.pricingService.findActive(query, currentUser);
  }

  @Get()
  findAll(@Query() query: ListPricingConfigsQueryDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.pricingService.findAll(query, currentUser);
  }
}
