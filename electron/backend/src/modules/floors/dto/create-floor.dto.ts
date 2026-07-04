export class CreateFloorDto {
  name!: string;
  floor_number?: number;
  number?: number; // Alias for floor_number for backwards compatibility
}

