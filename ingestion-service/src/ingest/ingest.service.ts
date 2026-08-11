import { ConflictException, Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { MYSQL_POOL } from '../database/database.constants';
import { DeviceTypeEnum } from './device-type.enum';
import { IngestTelemetryDto } from './dto/ingest-telemetry.dto';

interface DeviceRow extends RowDataPacket {
  id: number;
  deviceTypeId: number;
  connectionId: number | null;
  deviceType: DeviceTypeEnum;
}

interface DeviceTypeParamRow extends RowDataPacket {
  id: number;
}

const ER_DUP_ENTRY = 'ER_DUP_ENTRY';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  async ingest(
    orgCode: string,
    deviceType: DeviceTypeEnum,
    serialNo: string,
    dto: IngestTelemetryDto,
  ): Promise<void> {
    const device = await this.findDevice(orgCode, deviceType, serialNo);

    if (device.connectionId === null) {
      // added to inventory but not yet linked to a customer account — see
      // ubiqedge_tech_api_design §2. Rejected loudly, not a silent 202, so
      // this is visible during testing/demo rather than a quiet data gap
      // discovered later at invoicing time.
      throw new ConflictException('device is not linked to a customer account');
    }

    // resolve every paramKey before writing anything, so a request with one
    // bad paramKey 422s cleanly rather than partially persisting
    const paramIds = new Map<string, number>();
    for (const reading of dto.readings) {
      const paramId = await this.resolveDeviceTypeParamId(orgCode, device.deviceTypeId, reading.paramKey);
      paramIds.set(reading.paramKey, paramId);
    }

    // mysql2 needs a Date object for a `datetime` column — a raw ISO string
    // like "...T...Z" isn't accepted MySQL datetime syntax and errors at
    // the driver level, not validation (deviceTimestamp is already
    // shape-validated as ISO8601 by the DTO)
    const deviceTimestamp = new Date(dto.deviceTimestamp);

    for (const reading of dto.readings) {
      await this.insertReading(
        orgCode,
        device.id,
        device.deviceTypeId,
        paramIds.get(reading.paramKey)!,
        reading.value,
        deviceTimestamp,
      );
    }
  }

  private async findDevice(orgCode: string, deviceType: DeviceTypeEnum, serialNo: string): Promise<DeviceRow> {
    const [rows] = await this.pool.query<DeviceRow[]>(
      `SELECT d.id, d.deviceTypeId, d.connectionId, dt.type AS deviceType
       FROM device d
       JOIN device_type dt ON dt.id = d.deviceTypeId
       WHERE d.serialNo = ? AND d.orgId = ? AND d.deletedAt IS NULL`,
      [serialNo, orgCode],
    );
    const device = rows[0];
    if (!device || device.deviceType !== deviceType) {
      throw new NotFoundException(`Device ${serialNo} not found`);
    }
    return device;
  }

  private async resolveDeviceTypeParamId(
    orgCode: string,
    deviceTypeId: number,
    paramKey: string,
  ): Promise<number> {
    const [rows] = await this.pool.query<DeviceTypeParamRow[]>(
      'SELECT id FROM device_type_param WHERE paramKey = ? AND orgId = ? AND deviceTypeId = ?',
      [paramKey, orgCode, deviceTypeId],
    );
    const param = rows[0];
    if (!param) {
      throw new UnprocessableEntityException(`paramKey ${paramKey} is not valid for this device`);
    }
    return param.id;
  }

  private async insertReading(
    orgCode: string,
    deviceId: number,
    deviceTypeId: number,
    deviceTypeParamId: number,
    value: number,
    deviceTimestamp: Date,
  ): Promise<void> {
    try {
      await this.pool.query<ResultSetHeader>(
        `INSERT INTO device_telemetry
           (deviceId, deviceTypeId, deviceTypeParamId, value, serverTimestamp, deviceTimestamp, orgId)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)`,
        [deviceId, deviceTypeId, deviceTypeParamId, value, deviceTimestamp, orgCode],
      );
    } catch (err) {
      // (orgId, deviceId, deviceTypeParamId, deviceTimestamp) unique
      // constraint absorbs retried/duplicate deliveries — idempotent, so a
      // retry after a dropped response still 202s instead of 500ing. See
      // implementation spec §0a.
      if ((err as { code?: string }).code === ER_DUP_ENTRY) {
        this.logger.log(`Duplicate reading ignored: device=${deviceId} param=${deviceTypeParamId} ts=${deviceTimestamp}`);
        return;
      }
      throw err;
    }
  }
}
