# صفحة العروض (Offers)

> **Offers V2:** التفاصيل التقنية المحدّثة في [`offers-v2-architecture.md`](./offers-v2-architecture.md) و[`offers-v2-plan.md`](./offers-v2-plan.md). الواجهة الحالية: `OffersCenter` (مركز إدارة العروض). أولوية التسعير: Daily → Happy Hour → Scheduled. تعديل العروض يتطلب `admin|manager` في IPC و HTTP. الأرشفة عبر `archived_at`.

توثيق كامل لصفحة إدارة العروض في Sufra، بما في ذلك ربطها بنقطة البيع وسلوك **العرض المجمع كصينية ثابتة** (فرع `feat/combo-fixed-trays`).

---

## 1. نظرة عامة

صفحة العروض تسمح لـ **المدير / الأدمن** بإنشاء وإدارة خمسة أنواع من العروض:

| النوع | الغرض |
|--------|--------|
| عرض اليوم (Daily Deal) | سعر خاص لمنتج في تاريخ محدد |
| عرض مجمع / صينية ثابتة (Combo) | مجموعة أصناف بسعر خاص أو مجموع المحتويات؛ تُضاف في الطلب كصينية مقفلة |
| عرض مجدول (Scheduled) | سعر خاص لمنتج أو كومبو ضمن فترة زمنية |
| منتج مميز (Featured) | إبراز منتجات في فئة العروض بقائمة الطلب |
| ساعة سعيدة (Happy Hour) | سعر خاص ضمن ساعات (وأيام اختيارية) |

الصفحة: **Offers Management Center** (`OffersCenter`) — ملخص، فلاتر، قائمة موحّدة، أدراج.

---

## 2. الوصول والصلاحيات

| البند | التفصيل |
|--------|---------|
| المسار | `/offers` |
| اسم القائمة | `nav.offers` → **العروض** |
| الظهور في الشريط | `admin` و `manager` فقط (`navConfig.ts`) |
| بوابة الصفحة | تسجيل الدخول فقط (`ProtectedRoute`)؛ تقييد الدور عبر القائمة + واجهة الصفحة |
| المدير على الصفحة | `isManager = role === 'manager' \|\| role === 'admin'` |
| غير المدير | شريط تحذير `offers.managerOnlyWarning`؛ عرض تفاصيل فقط بدون إنشاء/تعديل/تفعيل/حذف |
| Backend | IPC و HTTP: mutate يتطلب `admin` أو `manager`؛ القراءة متاحة للعميل المصادق |

---

## 3. هيكل الواجهة والملفات

### 3.1 مسار التشغيل

```
App.tsx (/offers)
  └── OffersPage.tsx
        ├── Header (عنوان العروض)
        └── OffersCenter.tsx        ← مركز الإدارة (ملخص، فلاتر، قائمة، أدراج)
              └── OfferSideDrawer.tsx
```

Domain: `electron/shared/offers` عبر `@sufra-offers`.

### 3.2 ملفات أساسية

| الملف | الدور |
|-------|--------|
| `OffersCenter.tsx` | مركز الإدارة الموحّد |
| `OfferSideDrawer.tsx` | درج جانبي RTL للنماذج/التفاصيل |
| `OfferActivateToggle.tsx` / `WeekdayCheckboxes.tsx` | مكوّنات مساعدة |
| `useOffers.ts` | أنواع البيانات + استدعاءات API |
| `lib/offers/*` | Domain + بناء فئة العروض في POS |
| `utils/offer-pricing.ts` | إثراء أسعار المنتجات في القائمة |
| `offers.service.ts` | منطق العروض في الـ backend |

### 3.3 Backend

| الملف | الدور |
|--------|--------|
| `electron/backend/src/modules/offers/offers.service.ts` | منطق CRUD لكل الأنواع |
| `electron/backend/src/modules/offers/offers-rbac.ts` | فحص صلاحية المدير |
| `electron/shared/offers/*` | Domain مشترك (حالة/تسعير/كومبو) |
| `electron/backend/src/modules/offers/weekday-helpers.ts` | تحليل JSON أيام الأسبوع |
| `electron/backend/src/modules/offers/happy-hour-match.ts` | مطابقة الساعة السعيدة مع الوقت الحالي |
| `electron/http-fastify/routes/offers.ts` | مسارات HTTP (+ RBAC على mutate) |
| `electron/ipc/handlers/offers.ts` | قنوات IPC لسطح المكتب |
| `electron/backend/src/database/database.service.ts` | جداول وmigrations |

---

## 4. أقسام الصفحة

### 4.1 العروض النشطة (`activeOffers*`)

تعرض ما هو فعّال «الآن»:

- **عرض اليوم** إن وُجد سجل بتاريخ اليوم.
- **العروض المجدولة** التي تقع نافذتها الزمنية ضمن الوقت الحالي.

أزرار المدير هنا: إضافة عرض مجدول (+ عرض اليوم مذكور في النصوص لكن زر إنشاء عرض اليوم قد لا يكون ظاهراً حالياً في الواجهة).

### 4.2 العروض المنتظمة (`regularOffers*`)

- العروض المجمعة (صواني ثابتة)
- المنتجات المميزة
- الساعة السعيدة

أزرار المدير: `+ عرض مجمع`، `+ منتج مميز`، `+ ساعة سعيدة`.

---

## 5. أنواع العروض بالتفصيل

### 5.1 عرض اليوم (Daily Deal)

**الحقول**

| الحقل | المعنى |
|--------|--------|
| `product_id` | المنتج |
| `special_price` | السعر الخاص |
| `date` | التاريخ (YYYY-MM-DD) |
| `is_active` | 1 مفعّل في نقطة البيع / 0 معطّل |

**العمليات:** إنشاء، تفعيل/تعطيل، حذف، تفاصيل.  
**التحقق:** منتج + سعر + تاريخ مطلوبة؛ المنتج يجب أن يوجد في الكتالوج.

**في نقطة البيع:** إن كان عرض اليوم لليوم الحالي و`is_active = 1`، يُطبَّق السعر الخاص على المنتج (أولوية عالية في إثراء الأسعار في الواجهة).

---

### 5.2 عرض مجمع / صينية ثابتة (Combo) ★

العرض المجمع أصبح **قالب صينية ثابتة** يُدار من صفحة العروض ويُضاف من قائمة الطلبات بنقرة واحدة.

#### الحقول (جدول `combos`)

| الحقل | المعنى |
|--------|--------|
| `combo_name` | اسم العرض / الصينية |
| `combo_price` | سعر البيع المخزَّن لرأس الصينية |
| `pricing_mode` | `fixed` = سعر خاص، `sum` = مجموع (سعر الصنف × الكمية) |
| `is_active` | تفعيل في القائمة |
| `weekdays` | JSON أيام 0–6 (أحد–سبت)؛ فارغ/null = كل الأيام |

#### محتويات الصينية (جدول `combo_items`)

| الحقل | المعنى |
|--------|--------|
| `combo_id` | العرض |
| `product_id` | الصنف |
| `quantity` | الكمية داخل الصينية (≥ 1) |

#### واجهة الإنشاء / التعديل

1. اسم العرض  
2. أيام العرض (اختياري)  
3. طريقة التسعير: **سعر خاص** أو **مجموع المحتويات**  
4. حقل السعر (قابل للكتابة في `fixed`؛ محسوب تلقائياً في `sum`)  
5. اختيار منتجات مع **كمية** لكل منتج  
6. تلميح: يُضاف كصينية ثابتة غير قابلة لتعديل المحتويات؛ السعر على الصينية فقط  

**التحقق**

- اسم + منتج واحد على الأقل  
- في `fixed`: السعر مطلوب وغير سالب  
- في `sum`: السعر = Σ(سعر_الكتالوج × الكمية) ويُحفظ في `combo_price`

**التوافق مع القديماء:** ما زال الـ API يقبل `product_ids[]` (كمية = 1 لكل صنف) أو `items: [{ product_id, quantity }]`.

#### سلوك نقطة البيع (مهم)

عند الضغط على بلاطة العرض في فئة العروض:

1. يُنشأ سطر سلة `lineKind: 'tray'` مع `trayLocked: true` و`comboId`
2. الأبناء = أصناف القالب بكمياتهم (للمطبخ والطباعة)
3. **سعر البيع على رأس الصينية فقط** (`linePrice = combo_price`)
4. ممنوع تعديل/حذف الأبناء من السلة
5. المسموح: زيادة/إنقاص **كمية الصينية كاملة** أو حذف الصينية
6. تكرار نفس العرض يزيد كمية نفس سطر الصينية المقفلة
7. شارة الواجهة: `orders.trayLockedBadge` → «صينية ثابتة»

دوال أساسية:

- `buildLockedComboTrayCartItem` في `frontend/src/hooks/cart-item-utils.ts`
- تستخدم في `useOrderModal` / `usePickupOrderModal` / `useDeliveryOrderModal`

#### ظهور العرض في القائمة

- فئة خاصة: `OFFERS_CATEGORY_ID = -1`
- بلاطة اصطناعية: `id = -combo.id`، `_isCombo: true`، `_comboProducts` مع الكميات
- شرط الظهور: `is_active === 1` ويوم الأسبوع مسموح (`isWeekdayIncluded`)

---

### 5.3 عرض مجدول (Scheduled Offer)

**الحقول**

| الحقل | المعنى |
|--------|--------|
| `product_id` **أو** `combo_id` | أحدهما فقط (XOR) |
| `special_price` | السعر الخاص |
| `start_datetime` / `end_datetime` | نافذة التفعيل |
| `is_active` | تفعيل |

**العمليات:** إنشاء، تفعيل/تعطيل، حذف، تفاصيل (لا نموذج تعديل كامل حالياً).  
**في POS:** يُطبَّق السعر الخاص على **المنتج** عندما يكون العرض نشطاً زمنياً ومفعّلاً. ربط `combo_id` موجود في الإدارة؛ تطبيق سعر مجدول على بلاطة الكومبو غير مفعّل بالكامل في مسار إثراء أسعار الكومبو.

---

### 5.4 منتج مميز (Featured)

**الحقول:** `product_id` (فريد)، `featured`، `created_at`.  
**الواجهة:** قائمة تبديل لكل المنتجات؛ الإلغاء يزيل التمييز.  
**في POS:** المنتجات المميزة تظهر أولاً داخل فئة العروض.

---

### 5.5 ساعة سعيدة (Happy Hour)

**الحقول:** `product_id`، `happy_hour_price`، `time_start`، `time_end`، `weekdays` (اختياري)، `is_active`.  
**العمليات:** إنشاء، تعديل، تفعيل/تعطيل، حذف، تفاصيل.  
**في POS:** تُطبَّق عند تطابق اليوم والوقت (يدعم تجاوز منتصف الليل عبر `happy-hour-match`).

---

## 6. أولوية الأسعار في نقطة البيع (واجهة)

في `offer-pricing.ts` / بطاقة المنتج تقريباً:

1. عرض اليوم  
2. الساعة السعيدة  
3. العرض المجدول  

(الكومبو والرف لا يمرّان بنفس مسار إثراء سعر المنتج المفرد.)

ملاحظة: ترتيب الأولوية في بعض دوال الـ backend قد يختلف قليلاً عن الواجهة؛ عند تغيير منطق التسعير راجع الطرفين معاً.

---

## 7. واجهات البرمجة (API)

المسار الذي تستخدمه الواجهة عبر `useOffers` + IPC:

| Method | Path |
|--------|------|
| GET / POST | `/offers/daily-deals` |
| PUT / DELETE | `/offers/daily-deals/:id` |
| GET / POST | `/offers/combos` |
| PUT / DELETE | `/offers/combos/:id` |
| GET / POST | `/offers/scheduled-offers` |
| PUT / DELETE | `/offers/scheduled-offers/:id` |
| GET / POST | `/offers/featured-items` |
| GET / POST | `/offers/happy-hour` |
| PUT / DELETE | `/offers/happy-hour/:id` |

قنوات IPC المقابلة في `electron/ipc/handlers/offers.ts` (مثل `offers:combos`, `offers:createCombo`, …).

مسارات Fastify قد توفّر أيضاً بادئة `/api/offers/...` بأسماء فرعية مختلفة لبعض الموارد؛ عميل سطح المكتب يعتمد IPC لمسارات `/offers/...`.

### جسم إنشاء/تحديث كومبو (الحالي)

```json
{
  "combo_name": "صينية عائلية",
  "pricing_mode": "fixed",
  "combo_price": 25000,
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 5, "quantity": 1 }
  ],
  "weekdays": [4, 5]
}
```

أو `pricing_mode: "sum"` بدون الاعتماد على سعر يدوي (يُحسب من الأصناف).

---

## 8. قاعدة البيانات

| الجدول | أعمدة مهمة |
|--------|-------------|
| `daily_deals` | `product_id`, `special_price`, `date`, `is_active` |
| `combos` | `combo_name`, `combo_price`, **`pricing_mode`**, `is_active`, `weekdays` |
| `combo_items` | `combo_id`, `product_id`, **`quantity`** |
| `scheduled_offers` | `product_id`, `combo_id`, `special_price`, `start_datetime`, `end_datetime`, `is_active` (+ قيد XOR) |
| `featured_items` | `product_id` UNIQUE, `featured` |
| `happy_hour` | `product_id`, `happy_hour_price`, `time_start`, `time_end`, `is_active`, `weekdays` |

Migrations آمنة في `database.service.ts` تضيف الأعمدة الجديدة إن لم تكن موجودة (`pricing_mode`, `quantity`, `weekdays`, …).

عند حفظ الطلب: الكومبو يُدرج كـ `order_items` برأس `line_kind = 'tray'` وأبناء مرتبطين بـ `parent_order_item_id`، مع **سعر الرأس** من سعر الصينية (لا يُعاد حسابه إجبارياً من مجموع الأبناء إن وُجد سعر صريح).

---

## 9. الترجمة (`offers.*`)

الملفات: `frontend/src/locales/{ar,en,ckb}.json` تحت مفتاح `"offers"`.

مفاتيح مهمة للكومبو/الصينية:

- `comboPricingModeLabel` — طريقة التسعير  
- `comboPricingFixed` / `comboPricingSum`  
- `comboPricingSumHint`  
- `comboTrayHint`  
- `comboItemQty`  
- `comboPricingModeFixedShort` / `comboPricingModeSumShort`  
- `comboEditTitle` / `comboNewTitle` / `addCombo`  

مفتاح السلة المرتبط: `orders.trayLockedBadge`.

---

## 10. سيناريوهات استخدام سريعة

### إنشاء صينية ثابتة بسعر خاص

1. العروض → `+ عرض مجمع`  
2. الاسم + أصناف وكميات  
3. طريقة التسعير: **سعر خاص** → أدخل السعر  
4. حفظ وتفعيل  
5. في الطلب: فئة العروض → اضغط البلاطة → تظهر صينية مقفلة بالسعر المحدد  

### صينية بسعر = مجموع المحتويات

1. نفس الخطوات مع **مجموع المحتويات**  
2. السعر يُحسب تلقائياً من أسعار الأصناف × الكميات  
3. في السلة يبقى السعر على رأس الصينية فقط  

### تعديل قالب الصينية

من قائمة العروض المجمعة → تعديل → تغيير الأصناف/الكميات/التسعير → حفظ.  
الطلبات الجديدة تأخذ القالب الجديد؛ الطلبات القديمة المحفوظة تحتفظ بما أُرسل وقت الحفظ.

---

## 11. حدود معروفة / ملاحظات تطوير

1. زر إنشاء **عرض اليوم** قد لا يظهر في الشريط العلوي رغم وجود النموذج في الكود — راجع `OffersManagement` إن لزم إظهاره.  
2. العرض المجدول على `combo_id` للإدارة؛ تأثيره على سعر بلاطة الكومبو في POS محدود مقارنةً بالمنتجات.  
3. صلاحيات العروض واجهية؛ يُفضّل لاحقاً فرض الدور في الـ backend.  
4. `OffersWindow` قديم وغير موصول بالمسار الحالي `/offers`.  
5. إعادة فتح طلب قديم: سطور الصينية من قاعدة البيانات قد لا تحمل علم `trayLocked` في السلة إن لم يُحفظ كمعرف كومبو منفصل — السلوك الافتراضي للمجموعات اليدوية يبقى منفصلاً عن قوالب الكومبو.

---

## 12. خريطة سريعة للملفات حسب المهمة

| أريد… | ابدأ من… |
|--------|-----------|
| تغيير شكل صفحة العروض | `OffersManagement.tsx` |
| إضافة حقل للكومبو | `useOffers.ts` + `offers.service.ts` + DB migration |
| تغيير سلوك إضافة الكومبو للسلة | `cart-item-utils.ts` + hooks الطلب الثلاثة |
| تغيير ظهور العروض في القائمة | `useOrderModalData.ts` (+ pickup/delivery) |
| ترجمة نصوص العروض | `locales/ar.json` → `offers` |

---

*آخر تحديث مرتبط بفرع `feat/combo-fixed-trays` وتطوير العرض المجمع كصينية ثابتة.*
