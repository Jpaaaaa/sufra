/** Singleton restaurant identity for license activation (platform store snapshot). */
export type RestaurantProfileDto = {
  restaurantName: string
  phone: string | null
  addressLine: string | null
  city: string | null
  ownerContactName: string | null
  updatedAtMs: number
}

export type RestaurantProfileSaveBody = {
  restaurantName: string
  phone?: string | null
  addressLine?: string | null
  city?: string | null
  ownerContactName?: string | null
}
