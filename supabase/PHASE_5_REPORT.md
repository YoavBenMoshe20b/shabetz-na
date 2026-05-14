# Phase 5 — Rasap Module Rework + Production Deploy

**Status:** Rasap reframed as logistics platoon commander. Sizes
aggregation, logistics rotations, quick announcements, and a slimmer
escalation banner all shipped. Commit `4cfce89` pushed to `main`;
Vercel auto-deploy verified live.

---

## 1. What changed in the Rasap model

Before: רס״פ was treated as "soldier + equipment perms". UI accidentally
locked him out of platoon-leadership surfaces because his BASE role was
`'soldier'`.

After: רס״פ is recognised as **מפקד המפלג** — the logistics platoon
commander. Concretely:

- `mockUsers.u6` now has `commandedPlatoonId: 'g-meflag'`.
- `canManagePlatoon(user, platoon)` returns `true` when `isRasap(user)
  && user.commandedPlatoonId === platoon.id`. Tightly scoped — he
  manages מפלג only, never a sibling combat platoon.
- `canViewReport1(user)` accepts Rasap (read-only).
- `canCreateAnnouncement(user)` accepts Rasap (logistics broadcasts).
- Route guards on `/report1`, `/leaves`, `/platoon`, `/platoon/gaps`
  now have `allowWhen={isRasap}` so the route gate doesn't block him
  before the page-level permission check runs.
- `/rasap/rotations` is a brand-new route, gated on CC + Rasap.
- Command Menu surfaces all the above for Rasap.

**He still does NOT get:**
- Mission authoring (`canCreateMission` — CC/PC only)
- Escalation declaration (`canDeclareEscalation` — CC only)
- Leave cycle editing (`canEditLeaveCycle` — CC only)
- Approval of leave requests outside מפלג (`canApproveLeaveFor` is
  scope-aware; Rasap only sees מפלג requests)
- Any company-wide write (`isCompanyLeadership` returns false)

## 2. Sizes summary

New util: `src/utils/sizesSummary.ts` — `buildSizesHistogram(soldiers)`
returns a count-per-size bucket for shirt / pants / shoe, with an
`unfilled` bucket tracking how many soldiers still need to set their
sizes.

Rendered as a new section on `RasapDashboard.tsx` — three rows
(חולצה / מכנס / נעליים), each showing up to six populated buckets in
the form `M ×4` `L ×7` `XL ×3`, plus an "X לא מילאו" badge when there
are gaps. Footer shows `reported / total`.

The per-soldier sizes are edited in `/profile` (soldier self-edits) —
the Rasap doesn't need a write path here.

## 3. Logistics rotations (סבבים לוגיסטיים)

**New entity:** `LogisticsRotation` in `src/types/index.ts` with kinds
`kitchen | cleaning | container | water | weapons | loading | custom`
and statuses `planned | in-progress | done | cancelled`.

**Mock seed:** 5 rotations in `mockData.ts::mockLogisticsRotations`
covering kitchen, cleaning, container, water, weapons.

**AppContext state + mutations:**
- `logisticsRotations` array
- `addLogisticsRotation(data)` — Rasap creates new
- `setLogisticsRotationStatus(id, status)` — transitions

**Page:** `/rasap/rotations` (`LogisticsRotationsPage.tsx`)
- Grouped by status (active / done / cancelled)
- Status transitions inline: `התחל`, `סמן כהושלם`, `בטל`
- Composer sheet for new rotations

**Route gate:** `<ProtectedRoute minRole="companyCommander" allowWhen={isRasap}>`
**Menu:** Rasap + CC see "סבבים לוגיסטיים" under "ניהול וסמכויות".
**Dashboard tile:** "סבבים לוגיסטיים ←" button next to "החתמת ציוד" in
the Rasap hero card.

## 4. Quick logistics announcements

New section on `RasapDashboard.tsx` — 2×3 grid of pre-baked broadcasts:

- ארוחת בוקר מוכנה / ארוחת צהריים / ארוחת ערב (operational kind)
- הגיע ציוד חדש (message kind)
- מילוי מימיות
- הנפקת קסדות/אפודים

Tap → `addAnnouncement` with `audience: { kind: 'company' }`. Toast
confirms. Footer link routes to `/announcements` for a custom audience.

`canCreateAnnouncement` was extended to recognise the Rasap functional
role; the legacy `announcement.create` PermissionToken is still the
primary gate for everyone else.

## 5. Alerts UX — banner reduced

**Before:** `EscalationActiveBanner` was a multi-line pink strip with
two buttons (`פרטים`, `סגור`) — ~70px tall at top of every screen,
visually overwhelming.

**After:** Single-line slim pill (~36px tall):
```
⚪ הקפצה פעילה · {reason} · התייצבות {time}              פרטים ←
```
Whole row is one tap → navigates to `/alerts`. Closing the event
happens IN `/alerts` (the operational center) instead of from chrome.

`AlertsButton` (already in headers) is the primary alert-count surface
via its badge — the banner is now just a "this is happening right now"
indicator.

## 6. Production / Vercel

- **Repo:** `git@github.com:YoavBenMoshe20b/shabetz-na.git`
- **Branch:** `main`
- **Commit:** `4cfce89` — "feat(rounds 1-5): Supabase foundation ·
  providers · Command Menu · Rasap module rework"
- **Previous head:** `719ebb9`
- **Files changed:** 41 modified, 15 new (56 total)
- **Push:** ✅ pushed cleanly to `origin/main`
- **Deploy:** ✅ Vercel auto-deploy verified
  - URL: `https://shabetz-na.vercel.app/login` returns HTTP 200
  - Production bundle (`/assets/index-B6esW8k3.js`) contains all
    Phase 5 strings: `שליש`, `רס״פ`, `פתח תפריט`, `סבבים לוגיסטיים`

## 7. How to log in — production

Open `https://shabetz-na.vercel.app/login`. The dev-users panel is now
**expanded by default** (Phase 4 change). Look for these rows:

| Demo label | Tone | Name | Phone | Lands on |
|---|---|---|---|---|
| מ״פ | olive | יוסי כהן | `0501234567` | CompanyCommanderDashboard |
| מ״מ | olive | רוני שמש | `0502222111` | PlatoonCommanderDashboard |
| חייל | olive | משה ישראלי | `0509876543` | SoldierDashboard |
| סמל | olive | ניסים דהן | `0509999888` | PlatoonCommanderDashboard |
| **רס״פ** | **sand** | אבי כהן | `0502323232` | **RasapDashboard** |
| סמ״פ | olive | דנה לוי | `0507777666` | CompanyCommanderDashboard |
| **שליש** | **info-blue** | רון אביב | `0502424242` | **SoldierDashboard** + דוח 1 access |

Password (all users): `Test@1234`. Tap a row → form auto-fills → tap
"התחבר/י".

## 8. What Rasap sees after login

- **Header**: hamburger (☰), online dot, user chip
- **Dashboard** (`RasapDashboard`):
  1. Personal greeting + Rasap badge + AlertsButton
  2. Logistics KPIs (deployed / in-repair / open gaps) +
     primary CTA "החתמת ציוד" + secondary "סבבים לוגיסטיים" +
     link "לוח רס״פ מלא ←"
  3. Open damage queue (top 5)
  4. **Sizes summary** — 3 rows × up to 6 buckets each
  5. **Quick logistics announcements** — 6 pre-baked broadcasts
  6. Personal damage report CTA
  7. Announcements visible to him (incl. ones he posts)
  8. Next operational shift (if assigned to ops)
- **BottomNav** (5 tabs): בית · לוח · רס״פ · מלאי · פרופיל
- **Command Menu** (☰):
  - פעולות מרכזיות: דוח 1, הודעות פלוגתיות, יציאות, ליקויי ציוד
  - ניהול וסמכויות: לוגיסטיקה ורס״פ, מלאי ציוד, **סבבים לוגיסטיים**
  - אישי: פרופיל אישי, ציוד אישי, לוח שנה
  - + logout
- **PersonalActionsFab** (bottom-left): בקשת יציאה · עדכון סטטוס · דיווח בלאי

## 9. What Shalish sees after login

- **Dashboard**: `SoldierDashboard` (no special variant — שליש is
  functional only)
- **BottomNav** (3 tabs): בית · לוח · פרופיל
- **Command Menu**:
  - פעולות מרכזיות: **דוח 1**, הודעות פלוגתיות
  - אישי: פרופיל אישי, ציוד אישי, לוח שנה
  - + logout
- **PersonalActionsFab**: same as any soldier

## 10. Persistence — what survives refresh (USE_SUPABASE=true)

Unchanged from Phase 4 (Phase 5 didn't add new write paths to
Supabase; the Rasap entities are still local-only):

| Entity | Persists? |
|---|---|
| Soldier status events | ✅ |
| Leave requests + decisions | ✅ |
| Missions (create / update / set status) | ✅ |
| Announcements (create / close / delete) | ✅ |
| Equipment sign-out / return / damage / gap workflow | ✅ |
| Override alert ack / resolve | ✅ |
| **Logistics rotations** | ❌ (new entity, no table yet) |
| **Quick announcement** → uses existing announcements api | ✅ (rides the addAnnouncement persist) |
| **Sizes** (read-only aggregate) | N/A — derives from soldiers table |

## 11. Build / typecheck / lint

| Check | Status |
|---|---|
| `npm run build` | ✅ clean — 3.5 s |
| `npx tsc -p tsconfig.app.json --noEmit` | ✅ clean, 0 errors |
| `npm run lint` | ✅ 0 errors, 6 warnings (`react-hooks/purity` on Date.parse — false positives, downgraded to warn) |

## 12. Residual risk

### Same as Phase 4
1. **Reads still come from AppContext snapshot.** Writes persist; reads
   are served from local state until the next `bootstrapFromSupabase()`
   mount. Multi-tab consistency needs Realtime (Phase 6).

### New in Phase 5
2. **LogisticsRotation has no Supabase table.** Creates/updates are
   local-only. When the user creates a rotation and refreshes with
   `USE_SUPABASE=true`, it disappears. Phase 6 needs migration `0009`
   + an `api/logisticsRotations.ts`.
3. **Equipment lifecycle event log denormalisation** — the
   `currentLocation` field on SignedEquipment is hard-coded to
   "מחסן רס״פ" / "אצל החייל" / "מחסן רס״פ — תיקון". When real
   locations land (container slots, repair shop external, etc.) we
   need a free-text or enum field.
4. **`isRasap` is granted by operationalRoles OR functionalRoles.**
   If a soldier's `operationalRoles` array is mutated to remove
   "רס״פ" but `functionalRoles` retains "rasap", he keeps the
   permissions. Acceptable for demo; in prod, treat operationalRoles
   as the authoritative grant and prune functionalRoles on changes.
5. **The escalation banner is now subtle.** Trade-off: less visual
   noise, less hard to miss. If users report missing an active
   escalation in a real scenario, increase the badge weight or add a
   sound (Phase 6 push-notification work).

## 13. Phase 6 candidates

1. **Realtime subscriptions** — wire `supabase().channel(...)` for
   `soldiers`, `soldier_status_events`, `leave_requests`,
   `override_alerts`. Invalidation surface is already in place.
2. **LogisticsRotation table** (migration 0009) + api wrapper.
3. **LoginPage Phone OTP swap** — Supabase Auth primitives are
   already shipped (`src/services/supabaseAuth.ts`); needs Twilio
   configured in the project.
4. **Calendar events + command delegations + platoon leave cycles**
   tables — close the last persistence gaps.
5. **Tests** — `vitest` + api-layer integration against a local
   Supabase instance.

---

## 14. Quick verification you can do right now

1. Open `https://shabetz-na.vercel.app/login`
2. **Hard refresh** if you've visited before (⌘⇧R) — Vercel CDN may
   cache the old bundle briefly
3. The dev-users panel should appear expanded with all 7 demo users.
   Look for the row labeled **רס״פ** (sand badge) and **שליש**
   (info-blue badge)
4. Tap **רס״פ** row → "התחבר/י" → land on RasapDashboard
5. You should see:
   - Sand-badged greeting "שלום, אבי"
   - KPI card with "סבבים לוגיסטיים ←" button
   - "סיכומי מידות" section (3 rows)
   - "הודעות מהירות" section (6 buttons)
6. Tap the **☰ hamburger** at the top → drawer slides up with the
   Rasap-specific menu items including "סבבים לוגיסטיים"
7. Navigate to `/rasap/rotations` → 5 mock rotations visible across
   "פעילים" + "הושלמו לאחרונה"
