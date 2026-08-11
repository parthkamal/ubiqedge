import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '../user/entities/role.entity';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// lives in DeviceModule (not AccountModule) despite the /accounts/me prefix
// — DeviceModule already depends on AccountModule one-directionally for the
// CustomerConnection repository, so putting this here avoids a circular
// module dependency the other way around
@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts/me/devices')
export class MyDeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Roles(RoleType.CUSTOMER)
  @Get()
  findMine(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.deviceService.findMine(currentUser);
  }
}
