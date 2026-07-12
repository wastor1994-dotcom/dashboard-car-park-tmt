# Dashboard Car Park TMT

เว็บแดชบอร์ดลานจอดรถ อ่านข้อมูลจาก **Google Sheets** ชีต `DATA` แบบ near-realtime (โพลเป็นระยะ แล้วส่งอัปเดตผ่าน SSE)

## Google Sheet

- Spreadsheet ID: `15zM5OZ4rYllNKP7NL3PpFkvGkOMJJj8Jnxutkim1bEs`
- ชีต: `DATA`
- ต้องแชร์ชีตเป็น **Anyone with the link → Viewer** (หรือ Public) เพื่อให้ดึง CSV ได้โดยไม่ใช้ service account

## เริ่มใช้งาน

ใช้ portable Node ที่มากับโปรเจกต์ (ถ้าเครื่องยังไม่มี Node ติดตั้ง):

```powershell
$env:PATH = "C:\Users\wanchai.s\Car Park TMT\.tools\node-v22.16.0-win-x64;" + $env:PATH
cd "C:\Users\wanchai.s\Car Park TMT"
npm install
npm start
```

เปิดเบราว์เซอร์ที่ http://localhost:3000

## Flow หน้า Frontend

1. **ประเภทรถ** → รถยนต์ / มอร์เตอร์ไซต์ / ไม่มีประเภทรถ
2. เลือกประเภทรถแล้ว → ปุ่มย่อย **ยี่ห้อรถ**
3. **ลานจอด** → ปุ่มย่อยตามค่าในคอลัมน์ C (ประเภทลานจอด)
4. เมื่อเลือกประเภทลานจอด (หรือยี่ห้อ) → สรุปจำนวนรถ, สีรถ, ยี่ห้อรถ, สีสติ๊กเกอร์

## โครงสร้างคอลัมน์ (sheet DATA จริง)

| คอลัมน์ | ความหมาย |
|--------|----------|
| C | ลานจอด / ประเภทลานจอด |
| D | ทะเบียนรถ (นับจำนวนจากจำนวนแถว) |
| F | ยี่ห้อรถ |
| G | สีรถ |
| H | ประเภทรถ |
| I | มี/ไม่มีสติ๊กเกอร์ (Sticker) |
| L | สีสติ๊กเกอร์ (สี Sticker) |
| O | ชื่อพนักงาน |
| AE | ฝ่าย |
| AF | แผนก |

ระบบยังจับคอลัมน์จากหัวตารางอัตโนมัติถ้าชื่อหัวตรง (เช่น ยี่ห้อรถ, สีรถ)

ปรับคอลัมน์ด้วย env ได้ เช่น:

```powershell
$env:BRAND_COL = "E"
$env:VEHICLE_COLOR_COL = "F"
$env:POLL_INTERVAL_MS = "3000"
npm start
```

## Realtime

เซิร์ฟเวอร์ดึง CSV จาก Google Sheets ทุก `POLL_INTERVAL_MS` (ค่าเริ่มต้น 5 วินาที)  
บนเครื่อง local ใช้ SSE ช่วยอัปเดต และ frontend โพล `/api/snapshot` เป็นทางหลัก (ใช้ได้ทั้ง local และ Vercel)

ปุ่ม **รีเฟรช** บนแดชบอร์ดบังคับดึงข้อมูลทันที

## Deploy บน Vercel (ผูกกับ GitHub)

1. Push โปรเจกต์ขึ้น GitHub
2. เข้า [vercel.com](https://vercel.com) → **Add New Project** → Import repo จาก GitHub
3. Framework Preset: **Other** (ใช้ `vercel.json` + `api/index.js`)
4. Deploy — ทุกครั้งที่ push ไป `main` Vercel จะ deploy อัตโนมัติ

หรือใช้ CLI:

```powershell
npx vercel login
npx vercel
npx vercel --prod
```
