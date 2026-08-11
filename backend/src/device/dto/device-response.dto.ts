import { Device } from '../entities/device.entity';
import { DeviceTypeEnum } from '../entities/device-type.entity';

class DeviceConnectionSummary {
  id: number;
  accountNo: string;
}

export class DeviceResponseDto {
  id: number;
  name: string;
  serialNo: string;
  type: DeviceTypeEnum;
  isActive: boolean;
  connection: DeviceConnectionSummary | null;
  createdAt: Date;
  updatedAt: Date | null;

  static fromEntity(device: Device): DeviceResponseDto {
    const dto = new DeviceResponseDto();
    dto.id = device.id;
    dto.name = device.name;
    dto.serialNo = device.serialNo;
    dto.type = device.deviceType.type;
    dto.isActive = device.isActive;
    dto.connection = device.connection
      ? { id: device.connection.id, accountNo: device.connection.accountNo }
      : null;
    dto.createdAt = device.createdAt;
    dto.updatedAt = device.updatedAt;
    return dto;
  }
}
