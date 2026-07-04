import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateHallDto {
  @IsOptional()
  @IsString()
  name?: string;

  // Backwards-compatible field used by existing frontend (hall_number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  hall_number?: number;

  // Preferred field name matching the new contract (number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  number?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  floor_id?: number;
}


