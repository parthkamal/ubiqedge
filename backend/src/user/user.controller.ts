import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from './entities/role.entity';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Roles(RoleType.ADMIN)
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.userService.create(dto, currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Get()
  findAll(@Query() query: ListUsersQueryDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.userService.findAll(query, currentUser);
  }

  // must come before ':id' — otherwise "me" is parsed as the :id param
  @Get('me')
  findMe(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.userService.findMe(currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.userService.findOne(id, currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.userService.update(id, dto, currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.userService.remove(id, currentUser);
  }
}
