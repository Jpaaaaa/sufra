import { BadRequestException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';

export interface RestaurantProfileDto {
  restaurantName: string;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  ownerContactName: string | null;
  updatedAtMs: number;
}

export interface RestaurantProfileSaveBody {
  restaurantName: string;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  ownerContactName?: string | null;
}

const MAX = {
  restaurantName: 120,
  phone: 40,
  addressLine: 200,
  city: 80,
  ownerContactName: 120,
} as const;

function trimOptional(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function parseSaveBody(body: RestaurantProfileSaveBody): RestaurantProfileSaveBody {
  const restaurantName = typeof body.restaurantName === 'string' ? body.restaurantName.trim() : '';
  if (!restaurantName) {
    throw new BadRequestException('RESTAURANT_NAME_REQUIRED');
  }
  return {
    restaurantName:
      restaurantName.length > MAX.restaurantName
        ? restaurantName.slice(0, MAX.restaurantName)
        : restaurantName,
    phone: trimOptional(body.phone, MAX.phone),
    addressLine: trimOptional(body.addressLine, MAX.addressLine),
    city: trimOptional(body.city, MAX.city),
    ownerContactName: trimOptional(body.ownerContactName, MAX.ownerContactName),
  };
}

class RestaurantProfileService {
  constructor(private readonly db: DatabaseService) {}

  async getProfile(): Promise<RestaurantProfileDto | null> {
    const row = await this.db.get(
      `SELECT restaurant_name AS restaurantName, phone, address_line AS addressLine,
              city, owner_contact_name AS ownerContactName, updated_at_ms AS updatedAtMs
       FROM restaurant_profile WHERE id = 1`,
    );
    if (!row) return null;
    return row as RestaurantProfileDto;
  }

  async upsertProfile(body: RestaurantProfileSaveBody): Promise<RestaurantProfileDto> {
    const parsed = parseSaveBody(body);
    const now = Date.now();
    await this.db.run(
      `INSERT INTO restaurant_profile (
         id, restaurant_name, phone, address_line, city, owner_contact_name, updated_at_ms
       ) VALUES (1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         restaurant_name = excluded.restaurant_name,
         phone = excluded.phone,
         address_line = excluded.address_line,
         city = excluded.city,
         owner_contact_name = excluded.owner_contact_name,
         updated_at_ms = excluded.updated_at_ms`,
      [
        parsed.restaurantName,
        parsed.phone,
        parsed.addressLine,
        parsed.city,
        parsed.ownerContactName,
        now,
      ],
    );
    const saved = await this.getProfile();
    if (!saved) {
      throw new Error('RESTAURANT_PROFILE_SAVE_FAILED');
    }
    return saved;
  }
}

let restaurantProfileInstance: RestaurantProfileService | null = null;

export function initializeRestaurantProfile(db: DatabaseService): void {
  restaurantProfileInstance = new RestaurantProfileService(db);
}

function requireRestaurantProfile(): RestaurantProfileService {
  if (!restaurantProfileInstance) {
    throw new Error('RestaurantProfile not initialized');
  }
  return restaurantProfileInstance;
}

export function getProfile(): ReturnType<RestaurantProfileService['getProfile']> {
  return requireRestaurantProfile().getProfile();
}

export function upsertProfile(
  ...args: Parameters<RestaurantProfileService['upsertProfile']>
): ReturnType<RestaurantProfileService['upsertProfile']> {
  return requireRestaurantProfile().upsertProfile(...args);
}
