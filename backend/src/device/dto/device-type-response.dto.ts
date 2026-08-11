import { DeviceType, DeviceTypeEnum } from '../entities/device-type.entity';

export class DeviceTypeResponseDto {
  id: number;
  type: DeviceTypeEnum;
  billed: boolean;

  static fromEntity(deviceType: DeviceType): DeviceTypeResponseDto {
    const dto = new DeviceTypeResponseDto();
    dto.id = deviceType.id;
    dto.type = deviceType.type;
    dto.billed = deviceType.billed;
    return dto;
  }
}
