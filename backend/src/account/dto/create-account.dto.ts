import { IsInt, Min } from 'class-validator';

export class CreateAccountDto {
  @IsInt()
  @Min(1)
  userId: number;
}
