# 💸 Moments — Monetization Activation Playbook

الكود جاهز بالكامل. كل اللي ناقص هو **حسابات الشراكة** — ودي لازم تفتحها
أنت بنفسك (بإيميلك وبياناتك البنكية، لأن المواقع بتتحقق من الهوية).
كل ما توافق شبكة، تاخد الـ ID بتاعك وتحطه في مكان واحد:

> **`src/lib/../services/broker.js` → `AFFILIATE_TAGS`**

من اللحظة دي كل كليك من الأبب بيتحسب لك تلقائيًا. كل الكليكات متسجلة
من دلوقتي في جدول `partner_clicks` — فعندك إثبات لكل إحالة حصلت حتى
قبل التفعيل.

---

## 1) الأولوية القصوى (مصر + سفر)

| الشبكة | بتديك | فين تسجّل | اللي هتحطه في الكود |
|---|---|---|---|
| **Waffarha وفرها** | 10–20% على عروض الخروج | كلّم شراكاتهم: partners@waffarha.com أو من صفحة "انضم كشريك" على waffarha.com | `waffarha: 'كود-الإحالة'` |
| **Travelpayouts** | شبكة واحدة بتفتح: طيران، فنادق، Booking، GetYourGuide وغيرهم (حتى 7%) | travelpayouts.com → Sign up (فوري، مجاني) | `travelpayouts: 'marker'` |
| **Booking.com** | 4–6% على الحجوزات | إمّا عبر Travelpayouts (أسهل وأسرع) أو مباشرة: partners.booking.com | `booking: 'aid'` |
| **Amazon Associates** | 1–10% على المشتريات | affiliate-program.amazon.com (خد بالك: لازم 3 مبيعات في أول 180 يوم) | `amazon: 'store-id-20'` |

## 2) التجارب والأنشطة

| الشبكة | بتديك | فين تسجّل |
|---|---|---|
| **GetYourGuide** | ~8% | partner.getyourguide.com |
| **Viator** | ~8% | viator.com/partner (أو عبر Travelpayouts) |
| **Hostelworld** | ~7% | عبر Partnerize: partnerize.com → Hostelworld program |
| **Playtomic** (ملاعب) | عمولة لكل حجز | إيميل مباشر: b2b@playtomic.io — قدّم الأبب كـ "booking channel" |

## 3) الأفلام والمزيكا 🎬🎵

| الشبكة | بتديك | فين تسجّل |
|---|---|---|
| **ArabClicks** (Shahid وغيرها) | عمولات MENA | arabclicks.com → Join |
| **Impact.com** (Disney+ وغيرها) | حسب البرنامج | impact.com → Marketplace → Disney+ |
| **Apple Services** (Apple TV) | ~50% أول شهر اشتراك | performance-partners.apple.com |
| **Epidemic Sound** (مزيكا مرخّصة) | خصم شراكة + API | epidemicsound.com/partners — قدّم كـ "platform partner" عشان الـ API |
| Netflix | ❌ مفيش برنامج مفتوح — اللينكات بتتسجل كإحالات بس | — |

> **الـ Indie Music Hub بتاعنا** مش محتاج حساب خارجي — المنتجين المستقلين
> بيرفعوا مباشرة والملكية ليهم (schema_v7 جاهز).

## 4) إعلانات الأماكن (Moments Ads) — فلوس مباشرة ليك

دي مش شبكة خارجية — دي **منتجك أنت**: المطاعم والكافيهات بتدفعلك مباشرة
(Boost: Top of Search / Promoted Pin / Featured Collection).
عشان تقبض لازم بوابة دفع:

1. **Paymob** (مصر): paymob.com → أنشئ حساب تاجر (سجل تجاري أو
   free-lancer ID) → خد الـ API keys → حطها كـ **secrets** في
   Supabase Edge Function `create-checkout` (الكود جاهز في
   `supabase/functions/create-checkout/`). **متحطش المفاتيح في الأبب أبدًا.**
2. **Stripe** (عالمي): stripe.com → حساب → فعّل **Stripe Connect**
   عشان تقسيم الأرباح مع أصحاب الأماكن (نسبتك 15% محددة في الكود).

## 5) خطوات التفعيل (لكل شبكة، نفس الدورة)

1. افتح الحساب من اللينك → استنى الموافقة (من فوري لـ 3 أيام).
2. خد الـ ID/tag → افتح `src/services/broker.js` → حطه في `AFFILIATE_TAGS`.
3. قلّي "فعّلت X بالكود ده" وأنا هربطه وأتأكد إن اللينكات بتطلع صح.
4. في Settings → "Earnings by partner" هتلاقي الشارة اتحولت من
   **TAG PENDING** لـ **EARNING** تلقائيًا.

## ⚠️ قواعد مهمة

- كل الشبكات بتطلب **إفصاح**: الأبب بيعرضه فعلاً ("Moments earns a small
  affiliate commission") — سيبه ظاهر.
- Amazon بيقفل الحساب لو مفيش 3 مبيعات في 180 يوم — فعّله لما يبقى عندك
  مستخدمين حقيقيين بيضغطوا.
- عمولات الأفلام غالبًا على **الاشتراكات الجديدة** مش المشاهدات.
- فلوس الشبكات بتتحول لحسابك البنكي/PayPal مباشرة من كل شبكة —
  مش محتاجة كود إضافي.
