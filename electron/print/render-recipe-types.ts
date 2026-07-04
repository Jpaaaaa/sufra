export interface RecipePrintData {
  name: string;
  description?: string;
  prep_time?: number;
  cook_time?: number;
  servings?: number;
  difficulty?: string;
  ingredients: Array<{ name: string; amount: string; unit?: string }>;
  instructions: Array<{ step: number; text: string }>;
  notes?: string;
  /** Shown at top of ticket; can be overridden per print or from Settings. */
  restaurantName?: string;
  /** Footer line, e.g. thank-you message. */
  thankYouLine?: string;
  /** Footer contact phone. */
  mobileNumber?: string;
}
