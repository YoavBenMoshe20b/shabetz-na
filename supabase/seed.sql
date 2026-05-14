-- ════════════════════════════════════════════════════════════════════════════
-- seed.sql — Demo company for local development
--
-- Creates: 1 company, 4 platoons, ~10 squads, ~25 soldiers, 7 profiles
-- (one per role), memberships, status events, leaves, leave requests,
-- coverage events.
--
-- ⚠ AUTH USERS NOT CREATED HERE. Supabase Auth manages auth.users via
-- the Studio UI or admin API. After running this seed:
--
--   1. Go to Authentication → Users in Studio
--   2. Click "Add user" and create users with these phones:
--        - 0501234567   → CC (יוסי כהן)
--        - 0507777666   → Deputy CC (דנה לוי)
--        - 0502222111   → PC (רוני שמש)
--        - 0509999888   → Sergeant (ניסים דהן)
--        - 0509876543   → Soldier (משה ישראלי)
--        - 0502323232   → Rasap (אבי כהן)
--   3. Note the auth.users.id for each.
--   4. Run the UPDATE statements at the bottom of this file to link
--      profiles to auth.users by phone.
--
-- For LOCAL Supabase (supabase start), use the admin API or simply
-- run signInWithOtp() once per phone — the trigger in 0001 will create
-- profiles automatically, and we'll UPDATE them with the seed data here.
-- ════════════════════════════════════════════════════════════════════════════

-- Disable triggers for the seed so audit_logs don't fill up with the
-- seed itself.
set session_replication_role = 'replica';

-- ─── Company ──────────────────────────────────────────────────────────
insert into public.companies (id, name, unit_name, invite_code, settings)
values (
  '00000000-0000-0000-0000-000000000001',
  'פלוגה ב',
  'גדוד 9203',
  'CO-DEMO',
  jsonb_build_object(
    'rotationStrategy', 'platoon-based',
    'minSoldiersOnBase', 8,
    'specialPlatoonsFollowLeaveRotation', false,
    'companyHomePeriods', '[]'::jsonb
  )
);

-- ─── Platoons ─────────────────────────────────────────────────────────
insert into public.platoons (id, company_id, name, unit_name, code, kind, min_soldiers_on_base, follows_company_rotation)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'מחלקה 1',  'גדוד 9203', 'M1',  'combat',          12, true),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'מחלקה 2',  'גדוד 9203', 'M2',  'combat',          12, true),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'מחלקה 3',  'גדוד 9203', 'M3',  'combat',          12, true),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'חפ״ק',    'גדוד 9203', 'CH',  'forward-command',  3, false),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', 'מפלג',    'גדוד 9203', 'ML',  'logistics',        2, false);

-- ─── Squads ───────────────────────────────────────────────────────────
insert into public.squads (id, platoon_id, name) values
  ('00000000-0000-0000-0000-000000001011', '00000000-0000-0000-0000-000000000101', 'כיתה א'),
  ('00000000-0000-0000-0000-000000001012', '00000000-0000-0000-0000-000000000101', 'כיתה ב'),
  ('00000000-0000-0000-0000-000000001013', '00000000-0000-0000-0000-000000000101', 'כיתה ג'),
  ('00000000-0000-0000-0000-000000001021', '00000000-0000-0000-0000-000000000102', 'כיתה א'),
  ('00000000-0000-0000-0000-000000001022', '00000000-0000-0000-0000-000000000102', 'כיתה ב'),
  ('00000000-0000-0000-0000-000000001023', '00000000-0000-0000-0000-000000000102', 'כיתה ג'),
  ('00000000-0000-0000-0000-000000001031', '00000000-0000-0000-0000-000000000103', 'כיתה א'),
  ('00000000-0000-0000-0000-000000001032', '00000000-0000-0000-0000-000000000103', 'כיתה ב'),
  ('00000000-0000-0000-0000-000000001033', '00000000-0000-0000-0000-000000000103', 'כיתה ג'),
  ('00000000-0000-0000-0000-000000001041', '00000000-0000-0000-0000-000000000104', 'מטה'),
  ('00000000-0000-0000-0000-000000001051', '00000000-0000-0000-0000-000000000105', 'צוות לוגיסטיקה');

-- ─── Soldiers (roster slots — user_id null = unclaimed) ──────────────
-- We seed ~25 soldiers. The 6 claim-targets (matching the phones above)
-- will be UPDATED to point at their profile after auth.users exist.

insert into public.soldiers (id, company_id, name, phone, id_last4, status, current_status, status_set_at, squad_id, team_class, operational_roles) values
  -- מחלקה 1
  ('00000000-0000-0000-0000-000000010001', '00000000-0000-0000-0000-000000000001', 'משה ישראלי',     '0509876543', '1111', 'active', 'in-base', now() - interval '2 days', '00000000-0000-0000-0000-000000001011', 'כיתה א', '{"קלע","חובש"}'),
  ('00000000-0000-0000-0000-000000010002', '00000000-0000-0000-0000-000000000001', 'רוני שמש',       '0502222111', '2222', 'active', 'in-base', now() - interval '5 days', '00000000-0000-0000-0000-000000001011', 'כיתה א', '{"מ״מ","קשר מ״מ"}'),
  ('00000000-0000-0000-0000-000000010003', '00000000-0000-0000-0000-000000000001', 'ניסים דהן',      '0509999888', '9999', 'active', 'in-base', now() - interval '3 days', '00000000-0000-0000-0000-000000001011', 'כיתה א', '{"סמל","חובש"}'),
  ('00000000-0000-0000-0000-000000010004', '00000000-0000-0000-0000-000000000001', 'דניאל לוי',      '0501010101', '1011', 'active', 'home',    now() - interval '1 day',  '00000000-0000-0000-0000-000000001012', 'כיתה ב', '{"קלע"}'),
  ('00000000-0000-0000-0000-000000010005', '00000000-0000-0000-0000-000000000001', 'איתן בן יוסף',   '0501010102', '1012', 'active', 'in-base', now() - interval '6 days', '00000000-0000-0000-0000-000000001012', 'כיתה ב', '{"מ״כ","קלע"}'),
  ('00000000-0000-0000-0000-000000010006', '00000000-0000-0000-0000-000000000001', 'יוסי גבאי',     '0501010103', '1013', 'active', 'in-base', now() - interval '4 days', '00000000-0000-0000-0000-000000001012', 'כיתה ב', '{"נגביסט"}'),
  ('00000000-0000-0000-0000-000000010007', '00000000-0000-0000-0000-000000000001', 'אריאל פרץ',     '0501010104', '1014', 'active', 'inactive-temp', now() - interval '7 days', '00000000-0000-0000-0000-000000001013', 'כיתה ג', '{"קלע"}'),
  ('00000000-0000-0000-0000-000000010008', '00000000-0000-0000-0000-000000000001', 'עומר חכים',     '0501010105', '1015', 'active', 'in-base', now() - interval '5 days', '00000000-0000-0000-0000-000000001013', 'כיתה ג', '{"קלע","מאגיסט"}'),

  -- מחלקה 2
  ('00000000-0000-0000-0000-000000010101', '00000000-0000-0000-0000-000000000001', 'אורי מנשה',     '0501010201', '1021', 'active', 'in-base', now() - interval '3 days', '00000000-0000-0000-0000-000000001021', 'כיתה א', '{"מ״מ"}'),
  ('00000000-0000-0000-0000-000000010102', '00000000-0000-0000-0000-000000000001', 'גיא הררי',      '0501010202', '1022', 'active', 'in-base', now() - interval '2 days', '00000000-0000-0000-0000-000000001021', 'כיתה א', '{"סמל"}'),
  ('00000000-0000-0000-0000-000000010103', '00000000-0000-0000-0000-000000000001', 'תומר פלד',      '0501010203', '1023', 'active', 'home',    now() - interval '1 day',  '00000000-0000-0000-0000-000000001022', 'כיתה ב', '{"קלע"}'),
  ('00000000-0000-0000-0000-000000010104', '00000000-0000-0000-0000-000000000001', 'אסף נחום',      '0501010204', '1024', 'active', 'in-base', now() - interval '5 days', '00000000-0000-0000-0000-000000001022', 'כיתה ב', '{"קלע","חובש"}'),
  ('00000000-0000-0000-0000-000000010105', '00000000-0000-0000-0000-000000000001', 'אריק רובין',    '0501010205', '1025', 'active', 'in-base', now() - interval '4 days', '00000000-0000-0000-0000-000000001023', 'כיתה ג', '{"נגביסט"}'),

  -- מחלקה 3
  ('00000000-0000-0000-0000-000000010201', '00000000-0000-0000-0000-000000000001', 'נדב פלמר',      '0501010301', '1031', 'active', 'in-base', now() - interval '3 days', '00000000-0000-0000-0000-000000001031', 'כיתה א', '{"מ״מ"}'),
  ('00000000-0000-0000-0000-000000010202', '00000000-0000-0000-0000-000000000001', 'בן הררי',       '0501010302', '1032', 'active', 'in-base', now() - interval '2 days', '00000000-0000-0000-0000-000000001031', 'כיתה א', '{"סמל"}'),
  ('00000000-0000-0000-0000-000000010203', '00000000-0000-0000-0000-000000000001', 'יואב כץ',       '0501010303', '1033', 'active', 'in-base', now() - interval '5 days', '00000000-0000-0000-0000-000000001032', 'כיתה ב', '{"חובש"}'),
  ('00000000-0000-0000-0000-000000010204', '00000000-0000-0000-0000-000000000001', 'דביר ברק',      '0501010304', '1034', 'active', 'home',    now() - interval '1 day',  '00000000-0000-0000-0000-000000001033', 'כיתה ג', '{"קלע"}'),

  -- חפ״ק
  ('00000000-0000-0000-0000-000000010301', '00000000-0000-0000-0000-000000000001', 'יוסי כהן',      '0501234567', '0001', 'active', 'in-base', now() - interval '6 days', '00000000-0000-0000-0000-000000001041', 'מטה', '{"מ״פ"}'),
  ('00000000-0000-0000-0000-000000010302', '00000000-0000-0000-0000-000000000001', 'דנה לוי',       '0507777666', '7777', 'active', 'in-base', now() - interval '6 days', '00000000-0000-0000-0000-000000001041', 'מטה', '{"סמ״פ"}'),
  ('00000000-0000-0000-0000-000000010303', '00000000-0000-0000-0000-000000000001', 'מאיה כרמלי',    '0501010401', '1041', 'active', 'in-base', now() - interval '3 days', '00000000-0000-0000-0000-000000001041', 'מטה', '{"שליש"}'),

  -- מפלג
  ('00000000-0000-0000-0000-000000010401', '00000000-0000-0000-0000-000000000001', 'אבי כהן',       '0502323232', '2323', 'active', 'in-base', now() - interval '5 days', '00000000-0000-0000-0000-000000001051', 'מפלג', '{"רס״פ"}'),
  ('00000000-0000-0000-0000-000000010402', '00000000-0000-0000-0000-000000000001', 'נועם דהן',      '0501010501', '1051', 'active', 'in-base', now() - interval '4 days', '00000000-0000-0000-0000-000000001051', 'מפלג', '{"מש״ק קשר"}');

-- ─── Status events (sample history per soldier) ─────────────────────
-- Each soldier gets the event that established their CURRENT status.
insert into public.soldier_status_events (soldier_id, value, set_at, set_by_name, set_by_role, reason)
select s.id, s.current_status, s.status_set_at, 'מערכת (seed)', 'companyCommander', 'נתוני התחלה'
from public.soldiers s;

-- ─── Leaves ─────────────────────────────────────────────────────────
insert into public.leaves (company_id, scope, soldier_ids, squad_id, team_class, start_date, start_time, end_date, end_time, note, created_by_name, created_by)
values (
  '00000000-0000-0000-0000-000000000001',
  'individual',
  '{00000000-0000-0000-0000-000000010004}'::uuid[],
  null,
  null,
  (current_date)::text::date,
  '14:00',
  (current_date + 2)::text::date,
  '08:00',
  'אירוע משפחתי',
  'יוסי כהן',
  -- placeholder profile id; will be re-linked after auth users created
  '00000000-0000-0000-0000-000000010301'
);

-- ─── Leave requests (one pending for testing the queue) ─────────────
insert into public.leave_requests (
  company_id, soldier_id, soldier_name, soldier_team_class, soldier_squad_id, soldier_squad_name,
  start_date, start_time, end_date, end_time, reason, status
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000010006',
  'יוסי גבאי',
  'כיתה ב',
  '00000000-0000-0000-0000-000000001012',
  'כיתה ב',
  (current_date + 3)::text::date,
  '14:00',
  (current_date + 4)::text::date,
  '20:00',
  'פגישה רפואית',
  'pending'
);

-- ─── Coverage event (CC explicitly declares coverage for an absence) ─
insert into public.coverage_events (
  company_id, absent, covering, start_ts, end_ts, reason, notes, created_by
) values (
  '00000000-0000-0000-0000-000000000001',
  jsonb_build_object('kind', 'platoon', 'platoonId', '00000000-0000-0000-0000-000000000101'),
  jsonb_build_object('kind', 'platoon', 'platoonId', '00000000-0000-0000-0000-000000000102'),
  (current_date + 7)::text::timestamptz,
  (current_date + 9)::text::timestamptz,
  'rest-activity',
  'מחלקה 2 מכסה את שמירות מחלקה 1 בסבב הראשון',
  '00000000-0000-0000-0000-000000010301'
);

-- Re-enable triggers (audit fires going forward)
set session_replication_role = 'origin';

-- ─── HOOKUP TO AUTH.USERS ─────────────────────────────────────────────
-- These statements run AFTER you create the corresponding auth.users
-- entries via the Studio UI. Re-run this block when ready.
--
-- Example for the CC:
--   1. In Studio → Authentication → Add User: phone = 0501234567
--   2. Copy the resulting auth.users.id
--   3. Run:
--      update public.profiles
--         set id = '<auth_user_id>',
--             full_name = 'יוסי כהן',
--             id_last4 = '0001',
--             operational_roles = '{"מ״פ"}'
--       where phone = '0501234567';
--      update public.soldiers
--         set user_id = '<auth_user_id>', claimed_at = now()
--       where phone = '0501234567';
--      insert into public.memberships (user_id, company_id, role, platoon_id, commanded_platoon_id, is_active)
--      values ('<auth_user_id>', '00000000-0000-0000-0000-000000000001',
--              'companyCommander', '00000000-0000-0000-0000-000000000104', null, true);
--
-- Repeat for each phone. See README for the full table.
