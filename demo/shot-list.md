# Shot list — "הפלוגה שלי" demo capture

Comprehensive index of every frame the pipeline produces. Use this as a reference when editing the cinematic.

**Conventions**
- All shots captured at iPhone 14 Pro (390×844, DPR=3) AND desktop (1280×800, DPR=2). Final cinematic uses mobile by default; desktop is for hero/landscape inserts.
- File paths: `demo-assets/<category>/<project>/<id>.png` (e.g. `demo-assets/roles/mobile/cc-home.png`).
- `category` is one of: `roles` / `scenarios` / `flows`.
- `project` is `mobile` or `desktop`.

---

## Category 1 — Roles (12 personas)

Each captures the persona's landing surface + 1-2 drill-ins.

| ID | Persona | Phone | Surface | Why it matters |
|---|---|---|---|---|
| `cc-home` | מ״פ יוסי כהן | 0501234567 | `/home` | Anchor shot for "company commander's view". |
| `cc-missions` | מ״פ | — | `/missions` | Shows the operational planning context. |
| `dcc-home` | סמ״פ דנה לוי | 0507777666 | `/home` | DCC same surface — proves consistency. |
| `pc-g1-home` | מ״מ 1 רוני שמש | 0502222111 | `/home` | PC dashboard, hero "שבצ״ק המחלקה" CTA visible. |
| `pc-g1-schedule` | מ״מ 1 | — | `/platoon` | Day rows + slot status + fatigue dots. |
| `pc-g2-home` | מ״מ 2 עומר בר | 0501414141 | `/home` | Different platoon, same shape — emphasizes the role works at scale. |
| `pc-g2-schedule` | מ״מ 2 | — | `/platoon` | g2's mi-gate-south slots. |
| `pc-g3-home` | מ״מ 3 יואב סער | 0501919191 | `/home` | g3 commander's view. |
| `pc-g3-schedule` | מ״מ 3 | — | `/platoon` | g3's mi-readiness-east slots. |
| `ps-g1-home` | סמל 1 ניסים דהן | 0509999888 | `/home` | Same powers as PC (platoon leadership). |
| `ps-g2-home` | סמל 2 אייל גלעד | 0501818181 | `/home` | — |
| `ps-g3-home` | סמל 3 שגיא ברנר | 0502121212 | `/home` | — |
| `rasap-home` | רס״פ אבי כהן | 0502323232 | `/home` | RasaP dashboard with "המפלג שלי" section. |
| `rasap-board` | רס״פ | — | `/rasap` | Equipment / sizes / damage queue. |
| `rasap-meflag-structure` | רס״פ | — | `/platoon/g-meflag/structure` | Functional-role chip editor. |
| `shalish-home` | שליש רון אביב | 0502424242 | `/home` | Admin officer landing. |
| `shalish-report1` | שליש | — | `/report1` | Company-wide read access. |
| `soldier1-home` | חייל 1 משה ישראלי | 0509876543 | `/home` | Clean scheduled soldier. |
| `soldier2-home` | חייל 2 אורן פרץ | 0503333222 | `/home` | Soldier with friction. |
| `soldier2-leaves` | חייל 2 | — | `/leaves` | His pending leave request. |
| `soldier2-equipment` | חייל 2 | — | `/equipment` | His open gap report. |

---

## Category 2 — Scenarios (state-driven moods)

Each loads a specific demo-state JSON before login. These are the "intercut" frames — emotional context shots.

| ID | State file | Persona | Surface | Emotion |
|---|---|---|---|---|
| `clean-cc-home` | clean-operation | מ״פ | `/home` | Calm. Quiet morning. |
| `clean-cc-platoon` | clean-operation | מ״פ | `/platoon` | Everything green. |
| `chaos-cc-home` | chaos-shortage | מ״פ | `/home` | Storm. Multiple critical signals on the bell + Focus + alerts. |
| `chaos-cc-alerts` | chaos-shortage | מ״פ | `/alerts` | The aggregated alerts center. |
| `chaos-pc-g1-home` | chaos-shortage | מ״מ 1 | `/home` | "Floor breached" indicator in hero. |
| `chaos-pc-g1-schedule` | chaos-shortage | מ״מ 1 | `/platoon` | Understaffed slots visible. |
| `escalation-cc-home` | escalation-active | מ״פ | `/home` | Active escalation banner / Focus item. |
| `logistics-rasap-home` | logistics-pressure | רס״פ | `/home` | Damage queue with multiple entries. |
| `logistics-rasap-board` | logistics-pressure | רס״פ | `/rasap` | Full logistics surface. |
| `friction-soldier2-home` | soldier-friction | חייל 2 | `/home` | Personal friction visible. |
| `friction-soldier2-leaves` | soldier-friction | חייל 2 | `/leaves` | Pending leave row. |
| `friction-soldier2-equipment` | soldier-friction | חייל 2 | `/equipment` | Open gap row. |

---

## Category 3 — Flows (interaction recordings)

Captured WITH video. The .webm clip lives next to the still frames.

### Flow A — Staffing (the hero flow)

PC opens a slot, sees the engine outcome, picks soldiers, confirms.

| ID | Beat | What's visible |
|---|---|---|
| `staffing-1-pc-home` | Start | PC dashboard hero + "שבצ״ק המחלקה" CTA card |
| `staffing-2-platoon-week` | Land | Day rows, understaffed slots, "אייש" chips |
| `staffing-3-sheet-open` | Open | StaffingSheet hero — confidence badge, mission name |
| `staffing-4-engine-outcome` | Mid | Clean candidates + scores + decay reasons |
| `staffing-5-confirm-cta` | End | Confirm button + selected names |
| `staffing.webm` | Full | ~10s end-to-end recording |

### Flow B — Mission creation (CC POV)

| ID | Beat | What's visible |
|---|---|---|
| `mission-1-list` | Start | Missions list |
| `mission-2-wizard-step1` | Wizard | Step 1 of MissionWizard |

### Flow C — Audit history

| ID | Beat | What's visible |
|---|---|---|
| `audit-1-mission-detail` | Open | MissionDetailPage hero |
| `audit-2-history-section` | Reveal | "היסטוריית שיבוץ" collapsible expanded |

---

## Total assets (per project)

- **Roles**: 21 stills × 2 projects = 42 frames
- **Scenarios**: 12 stills × 2 projects = 24 frames
- **Flows**: 11 stills + 3 videos × 2 projects = 22 stills + 6 videos

**Per full run: ~88 PNG + 6 WebM.**
