import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsISO8601, ValidateNested } from 'class-validator';
import { IngestReadingDto } from './ingest-reading.dto';

export class IngestTelemetryDto {
  @IsISO8601()
  deviceTimestamp: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IngestReadingDto)
  readings: IngestReadingDto[];
}
