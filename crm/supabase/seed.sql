-- =====================================================================
-- Seed data — two isolated tenants, staff, leads, inventory.
-- Run AFTER all migrations. On Supabase run it in the SQL editor (the
-- service role bypasses RLS so the inserts succeed).
-- Fixed UUIDs make it easy to test RLS by hand.
-- =====================================================================

-- ---- Tenants -------------------------------------------------------
insert into public.tenants (id, name, slug, type, plan) values
  ('11111111-1111-1111-1111-111111111111', 'شركة النور للتطوير العقاري', 'al-noor', 'developer', 'pro'),
  ('22222222-2222-2222-2222-222222222222', 'أفق للتسويق العقاري',        'horizon', 'brokerage', 'standard')
on conflict (id) do nothing;

-- ---- Users ---------------------------------------------------------
-- (On Supabase these ids must match auth.users; for the demo we invent them.)
insert into public.users (id, tenant_id, role, full_name, performance_score) values
  -- Agency / master staff (no tenant)
  ('a0000000-0000-0000-0000-000000000001', null, 'master_admin',    'مدير الوكالة',        90),
  ('a0000000-0000-0000-0000-000000000002', null, 'master_marketer', 'مسوّق الوكالة',       80),
  -- Al-Noor
  ('b1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'tenant_admin',  'مدير شركة النور',   70),
  ('b1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'sales_manager', 'مدير مبيعات النور', 75),
  ('b1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'sales_agent',   'كريم - مبيعات',     82),
  ('b1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'sales_agent',   'سارة - مبيعات',     68),
  -- Horizon
  ('c2000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'sales_manager', 'مدير مبيعات أفق',   72),
  ('c2000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'sales_agent',   'أحمد - مبيعات',     60)
on conflict (id) do nothing;

-- ---- Rotation policy (Al-Noor) ------------------------------------
insert into public.rotation_policies (id, tenant_id, name, mode, max_per_agent, sla_minutes) values
  ('d3000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'توزيع حملة فيسبوك', 'round_robin', 3, 30)
on conflict (id) do nothing;

-- ---- Leads (Al-Noor, all new/unassigned) --------------------------
insert into public.leads (tenant_id, full_name, phone, source, campaign, budget_min, budget_max, quality_score, interest) values
  ('11111111-1111-1111-1111-111111111111', 'محمد عبد الله', '+201000000001', 'Facebook', 'التجمع الخامس', 3000000, 4000000, 78, '{"area":"التجمع الخامس","type":"apartment"}'),
  ('11111111-1111-1111-1111-111111111111', 'ليلى حسن',      '+201000000002', 'Facebook', 'التجمع الخامس', 2000000, 2500000, 64, '{"area":"التجمع الخامس","type":"apartment"}'),
  ('11111111-1111-1111-1111-111111111111', 'خالد فؤاد',     '+201000000003', 'Google',   'الشيخ زايد',    5000000, 7000000, 88, '{"area":"الشيخ زايد","type":"villa"}'),
  ('11111111-1111-1111-1111-111111111111', 'نور الدين',     '+201000000004', 'Facebook', 'التجمع الخامس', 1500000, 2000000, 55, '{"area":"التجمع الخامس"}'),
  ('11111111-1111-1111-1111-111111111111', 'هبة سمير',      '+201000000005', 'Landing',  'الساحل',        6000000, 9000000, 91, '{"area":"الساحل الشمالي","type":"chalet"}'),
  ('11111111-1111-1111-1111-111111111111', 'عمرو ياسر',     '+201000000006', 'Facebook', 'التجمع الخامس', 2500000, 3000000, 60, '{"area":"التجمع الخامس"}')
on conflict (tenant_id, phone) do nothing;

-- Horizon lead (must stay invisible to Al-Noor users) ---------------
insert into public.leads (tenant_id, full_name, phone, source, quality_score) values
  ('22222222-2222-2222-2222-222222222222', 'عميل أفق السري', '+201999999999', 'Google', 70)
on conflict (tenant_id, phone) do nothing;

-- ---- Inventory (Al-Noor project, network-visible) -----------------
insert into public.projects (id, tenant_id, name, location, delivery_date, is_published, visibility) values
  ('e4000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'كمبوند النور بارك', 'التجمع الخامس', '2027-06-01', true, 'network')
on conflict (id) do nothing;

insert into public.units (tenant_id, project_id, code, type, area_sqm, bedrooms, floor, price, status) values
  ('11111111-1111-1111-1111-111111111111', 'e4000000-0000-0000-0000-000000000001', 'A-101', 'apartment', 140, 3, 1, 3500000, 'available'),
  ('11111111-1111-1111-1111-111111111111', 'e4000000-0000-0000-0000-000000000001', 'A-102', 'apartment', 165, 3, 2, 3900000, 'available'),
  ('11111111-1111-1111-1111-111111111111', 'e4000000-0000-0000-0000-000000000001', 'V-01',  'villa',     320, 5, 0, 6800000, 'available')
on conflict (project_id, code) do nothing;
