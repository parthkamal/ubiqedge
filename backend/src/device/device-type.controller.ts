import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('device-types')
@ApiBearerAuth()
@Controller('device-types')
export class DeviceTypeController {
  constructor(private readonly deviceService: DeviceService) {}

  // any authenticated role — mostly seed data, needed by both the admin
  // "create device" form and read-only elsewhere
  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.deviceService.listDeviceTypes(currentUser);
  }
}
