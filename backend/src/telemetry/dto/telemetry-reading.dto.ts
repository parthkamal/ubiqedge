import { DeviceTelemetry } from '../entities/device-telemetry.entity';
import { ParamKey } from '../../device/entities/device-type-param.entity';

export class TelemetryReadingDto {
  paramKey: ParamKey;
  value: string;
  deviceTimestamp: Date;

  static fromEntity(reading: DeviceTelemetry): TelemetryReadingDto {
    const dto = new TelemetryReadingDto();
    dto.paramKey = reading.deviceTypeParam.paramKey;
    dto.value = reading.value;
    dto.deviceTimestamp = reading.deviceTimestamp;
    return dto;
  }
}
