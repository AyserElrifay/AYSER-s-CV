# PropTech CRM — Phase 1 Backbone (Database + RLS + Rotation Engine)

هذا المجلد يحتوي على **العمود الفقري للمرحلة الأولى (MVP)** من نظام الـ CRM العقاري
متعدد البوابات الموصوف في [`../docs/PROPTECH_CRM_SAAS_DESIGN.md`](../docs/PROPTECH_CRM_SAAS_DESIGN.md).

> المرحلة 1 من خارطة الطريق = «العزل الكامل بين الشركات + الليدز + التوزيع».
> هذا هو الأساس الذي تُبنى فوقه الواجهة والمساعد الذكي لاحقاً.

منفصل تماماً عن تطبيق MOMENTS في جذر المستودع — لا يتشاركان أي كود.

---

## ما الذي أُنجز وتم التحقق منه فعلياً ✅

| الضمان | كيف فُرِض | الحالة |
|---|---|---|
| عزل تام بين الشركات | Row-Level Security على كل جدول | ✅ مُختبَر |
| الوكالة الأم ترى الجميع | `is_master()` في كل سياسة | ✅ مُختبَر |
| موظف المبيعات يرى ليدزه فقط | سياسة تربط الليد بإسناده النشط | ✅ مُختبَر |
| توزيع Round-robin عادل + سقف لكل موظف | `rotate_leads_round_robin()` | ✅ مُختبَر (توزيع 3/3) |
| إعادة تدوير الليد بعد انتهاء الـ SLA | `expire_stale_assignments()` | ✅ (دالة جاهزة لـ pg_cron) |
| سوبر ماركت عابر للشركات (network) | سياسة رؤية المخزون المنشور | ✅ مُختبَر |
| منع تكرار الليد / تنازع الإسناد | قيود فريدة على قاعدة البيانات | ✅ |

نتائج الاختبار الكاملة في [`supabase/tests/`](supabase/tests/).

---

## بنية الملفات

```
crm/supabase/
├── migrations/
│   ├── 0001_extensions_and_helpers.sql   امتدادات + دوال قراءة الهوية من الـ JWT + Access-Token Hook
│   ├── 0002_core_identity.sql            tenants + users (خمسة أدوار)
│   ├── 0003_leads_rotation.sql           leads + rotation_policies + lead_assignments + lead_activities
│   ├── 0004_inventory_deals.sql          projects + units + deals  (Developer Supermarket)
│   ├── 0005_freelancers_commissions.sql  freelancers + subscriptions + commissions
│   ├── 0006_import_jobs.sql              import_jobs (رفع الشيتات بالـ AI) + إغلاق FK
│   ├── 0007_rls_policies.sql             ★ كل سياسات العزل — قلب الأمان
│   ├── 0008_rotation_engine.sql          محرك التوزيع Round-robin + مكنسة الـ SLA
│   └── 0009_grants.sql                   صلاحيات دور authenticated
├── seed.sql                              شركتان + فريق + ليدز + مخزون للتجربة
└── tests/
    ├── 00_local_shims.sql                محاكاة auth.* لتشغيل الاختبار على Postgres عادي / CI
    └── rls_isolation_test.sql            8 اختبارات عدائية تُثبت العزل
```

---

## التشغيل على Supabase

1. أنشئ مشروعاً على [supabase.com](https://supabase.com/dashboard).
2. من **SQL Editor** شغّل ملفات `migrations/` **بالترتيب** من 0001 إلى 0009.
3. (اختياري) شغّل `seed.sql` لملء بيانات تجريبية.
4. فعّل الـ Access-Token Hook: **Authentication → Hooks → Custom Access Token** واختر
   الدالة `public.custom_access_token_hook`. هذه الخطوة تحقن `tenant_id` و `user_role`
   و `is_master` داخل التوكن، وهي ما تعتمد عليه كل سياسات RLS.
5. جدولة مكنسة الـ SLA عبر pg_cron (كل دقيقة مثلاً):
   ```sql
   select cron.schedule('expire-sla', '* * * * *', $$select public.expire_stale_assignments()$$);
   ```

---

## تشغيل اختبارات العزل محلياً (بلا Supabase)

نموذج الأدوار في Supabase (`authenticated`, `auth.uid()`, `request.jwt.claims`) يُحاكى
عبر ملف الـ shims، فيمكن تشغيل نفس الاختبار العدائي على أي Postgres — مناسب للـ CI:

```bash
# على قاعدة بيانات اختبار فارغة
psql -f crm/supabase/tests/00_local_shims.sql
for f in crm/supabase/migrations/0*.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done
psql -f crm/supabase/seed.sql
psql -f crm/supabase/tests/rls_isolation_test.sql   # يجب أن تمر الاختبارات الثمانية
```

**المتوقع:** مدير أفق يرى ليداً واحداً فقط ولا يستطيع رؤية أي اسم من شركة النور،
وموظف المبيعات يرى ليدزه المُسنَدة فقط، والوكالة الأم ترى الجميع.

---

## نموذج الأدوار والصلاحيات

| الدور | tenant_id | يرى | يكتب |
|---|---|---|---|
| `master_admin` / `master_marketer` | NULL | كل الشركات | كل شيء |
| `tenant_admin` / `sales_manager` | شركته | كل ليدز شركته | داخل شركته |
| `sales_agent` | شركته | ليدزه المُسنَدة فقط | تحديث ليدزه فقط |
| `freelancer` (كيان منفصل) | — | ملفه + المخزون network/public | ملفه |

---

## الخطوة التالية (المرحلة 2)

- واجهة Next.js + Tailwind + shadcn (نمط Notion) مع لوحة Kanban بالسحب والإفلات.
- المساعد الذكي: رفع Excel + أوامر عربية طبيعية + بطاقة معاينة قبل الكتابة.
- تقييم جودة الليدز (`quality_score`) آلياً عند الاستيراد.

راجع خارطة الطريق الكاملة في وثيقة التصميم.
