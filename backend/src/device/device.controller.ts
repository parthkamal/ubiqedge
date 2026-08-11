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
import { DeviceService } from './device.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { ListDevicesQueryDto } from './dto/list-devices-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '../user/entities/role.entity';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Roles(RoleType.ADMIN)
  @Post()
  create(@Body() dto: CreateDeviceDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.deviceService.create(dto, currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Get()
  findAll(@Query() query: ListDevicesQueryDto, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.deviceService.findAll(query, currentUser);
  }

  // no @Roles() — Admin or the owning Customer, enforced inside the service
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.deviceService.findOne(id, currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeviceDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.deviceService.update(id, dto, currentUser);
  }

  @Roles(RoleType.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.deviceService.remove(id, currentUser);
  }
}
