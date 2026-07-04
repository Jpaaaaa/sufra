import type { RecipePrintData } from './render-recipe-types';

/** Sample recipe used in Settings → preview (thermal ticket layout). */
export function buildRecipePreviewSample(branding: {
  restaurantName?: string;
  thankYouLine?: string;
  mobileNumber?: string;
}): RecipePrintData {
  return {
    name: 'معكرونة بالصلصة',
    description: 'معاينة — شكل الطباعة على ورق حراري ٨٠مم',
    prep_time: 15,
    cook_time: 25,
    servings: 4,
    difficulty: 'سهل',
    ingredients: [
      { name: 'معكرونة', amount: '400', unit: 'غ' },
      { name: 'معجون طماطم', amount: '3', unit: 'ملاعق' },
      { name: 'ثوم', amount: '2', unit: 'فص' },
    ],
    instructions: [
      { step: 1, text: 'اسلق المعكرونة في ماء مملح حسب التعليمات.' },
      { step: 2, text: 'قلّب الثوم مع الصلصة على نار هادئة ثم أضف المعكرونة.' },
    ],
    notes: 'هذه معاينة فقط.',
    restaurantName: branding.restaurantName?.trim() || undefined,
    thankYouLine: branding.thankYouLine?.trim() || undefined,
    mobileNumber: branding.mobileNumber?.trim() || undefined,
  };
}
