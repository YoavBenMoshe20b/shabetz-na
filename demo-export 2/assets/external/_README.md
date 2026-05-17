# External Assets — sourced outside the Playwright pipeline

Four frames the camera can't shoot from the app. Place each as the indicated filename so the shot order resolves.

| Filename | Shot | Scene | Direction |
|---|---|---|---|
| `chaos-1-whatsapp.png` | 1.1 | Cold open | Mock WhatsApp group thread on phone. Hebrew. Messages like "מי בבית?" / "מי במשמרת?" / "פספסתי" / "תפסיק לזרוק לי הודעות" / "ידברו עם המ״כ". 4-6 messages, mixed senders, recent-looking timestamps. Stylized — doesn't have to be a real screenshot. |
| `chaos-2-excel.png` | 1.2 | Cold open | Hebrew Excel screenshot, cluttered, several rows highlighted in red. Names + dates + statuses. Some cells with "?" marks. The vibe: nobody has full ownership. |
| `chaos-3-handwritten.png` | 1.3 | Cold open | Photo of a real whiteboard (or styled mock) with handwritten שבצ״ק. Arrows, crossed-out names, partial schedule. The whiteboard is what platoons actually use today. |
| `brand-wordmark.png` | 7.1 | Closing | Full-bleed brand wordmark "הפלוגה שלי" on a calm background (mil-bg cream tone, hex `#F8F5EE` matches the app). Designer asset — generate from the app's existing typography (Heebo extrabold). |
| `brand-close.png` | 7.2 | Closing | Wordmark + URL `shabetz-na.vercel.app`. Use the same hex. Add a small footer "מערכת ניהול הפלוגה". |

## Production tips

- **Resolution**: target 1080×1920 for the mobile pass, 1920×1080 for the desktop pass. Higher is fine — let the editor scale down.
- **DPI**: 144 minimum so they don't look soft against the Playwright captures at devicePixelRatio=3.
- **Aesthetic**: stay in the same visual register as the app. Avoid stock images of soldiers waving flags. The chaos shots should feel mundane, not heroic.
- **Time of day**: chaos shots read at 5:00-6:00 AM. Phone wallpapers, faint blue tone, "good morning" energy.

## If you can't source them yourself

Generative options:
- **DALL-E 3 / Midjourney**: prompt for "stylized WhatsApp UI mockup in Hebrew, military scheduling group chat, morning timestamps, premium typography, light mode"
- **Figma**: copy a real WhatsApp screenshot, replace messages with Hebrew
- **Photoshop**: composite a real whiteboard photo (royalty-free from Unsplash search "blank whiteboard") with hand-drawn schedule overlay

## Acceptance

A frame is good when:
- The chaos is **immediately legible** to a Hebrew reader (3-second test)
- The Hebrew is **right-aligned** and reads correctly
- It doesn't **feel like a stock photo**
- The aesthetic **doesn't fight the rest of the film**

If a frame is "fine" but doesn't bring you to your seat, redo it. The cold open does 80% of the work selling the film.
