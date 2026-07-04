import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateTableDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  hall_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  number?: number;

  @IsOptional()
  @IsString()
  name?: string;
}


