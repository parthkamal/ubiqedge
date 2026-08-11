import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// lives in TelemetryModule despite the /devices/:id prefix — mirrors the
// MyDeviceController arrangement: TelemetryModule depends on DeviceModule
// one-directionally, so the endpoint lives with the module whose job it is
// (consumption querying), not the one matching the URL segment
@ApiTags('telemetry')
@ApiBearerAuth()
@Controller('devices/:id/telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  // no @Roles() — Admin or the owning Customer, enforced inside
  // DeviceService.findOne (reused, not duplicated)
  @Get()
  findForDevice(
    @Param('id', ParseIntPipe) deviceId: number,
    @Query() query: TelemetryQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.telemetryService.findForDevice(deviceId, query, currentUser);
  }
}
