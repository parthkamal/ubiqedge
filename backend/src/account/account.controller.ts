import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '../user/entities/role.entity';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Roles(RoleType.ADMIN)
  @Post()
  create(@Body() dto: CreateAccountDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.accountService.create(dto, currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Get()
  findAll(@Query() query: ListAccountsQueryDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.accountService.findAll(query, currentUser);
  }

  // must come before ':id' — otherwise "me" is parsed as the :id param
  @Roles(RoleType.CUSTOMER)
  @Get('me')
  findMine(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.accountService.findMine(currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.accountService.findOne(id, currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccountStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.accountService.updateStatus(id, dto, currentUser);
  }
}
