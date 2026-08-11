import { IsEnum, IsNumber } from 'class-validator';
import { ParamKey } from '../param-key.enum';

export class IngestReadingDto {
  @IsEnum(ParamKey)
  paramKey: ParamKey;

  @IsNumber()
  value: number;
}
