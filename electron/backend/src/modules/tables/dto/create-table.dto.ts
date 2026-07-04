import { IsInt, IsNotEmpty, IsPositive, IsString, IsOptional } from 'class-validator';

export class CreateTableDto {
  @IsInt()
  @IsPositive()
  hall_id!: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  number?: number;

  @IsString()
  @IsOptional()
  name?: string;
}


