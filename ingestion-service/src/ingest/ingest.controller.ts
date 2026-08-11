import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { DeviceTypeEnum } from './device-type.enum';
import { IngestTelemetryDto } from './dto/ingest-telemetry.dto';
import { IngestService } from './ingest.service';

@Controller()
@UseGuards(ApiKeyGuard)
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post(':orgCode/:deviceType/:serialNo')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(
    @Param('orgCode') orgCode: string,
    @Param('deviceType') deviceType: string,
    @Param('serialNo') serialNo: string,
    @Body() dto: IngestTelemetryDto,
  ): Promise<{ accepted: true }> {
    if (!Object.values(DeviceTypeEnum).includes(deviceType as DeviceTypeEnum)) {
      throw new BadRequestException(`deviceType must be one of ${Object.values(DeviceTypeEnum).join(', ')}`);
    }

    await this.ingestService.ingest(orgCode, deviceType as DeviceTypeEnum, serialNo, dto);
    return { accepted: true };
  }
}
