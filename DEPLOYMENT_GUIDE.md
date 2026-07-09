# 🚀 คู่มือติดตั้งระบบ (Deployment Guide)
เว็บโชว์เทคโนโลยี กวจ.สสว.วท.กห. — Serverless & ฟรีทั้งหมด

---

## 📁 0. โครงสร้างไฟล์

```
holo-tech/
├── index.html              ← หน้าแรก (การ์ดอินโฟกราฟิก)
├── detail.html             ← หน้ารายละเอียด + คอมเมนต์
├── preview.html             ← 🎨 หน้าดูดีไซน์ (รูป placeholder, ไม่ต้องตั้งค่าอะไร)
├── css/
│   └── style.css           ← ธีม Light Hologram (แก้ธีมที่ไฟล์นี้ไฟล์เดียว)
├── js/
│   ├── config.js           ← ⚙️ ตั้งค่าทั้งหมด (Firebase / GAS URL / CDN)
│   ├── auth.js             ← Firebase Google Sign-in
│   ├── app.js              ← หน้าแรก: Search / Filter / Sort / Skeleton
│   └── detail.js           ← หน้ารายละเอียด: วิว / แชร์ / คอมเมนต์
├── data/
│   └── technologies.json   ← 📝 เพิ่มเทคโนโลยีใหม่ที่ไฟล์นี้
├── assets/images/          ← รูป .webp / .svg (+ logo.webp, og-cover.webp)
└── backend/
    └── Code.gs             ← โค้ดสำหรับวางใน Google Apps Script
```

**การเพิ่มเทคโนโลยีใหม่** = เพิ่ม object ใน `data/technologies.json` + อัปโหลดรูปเข้า `assets/images/` แล้ว push ขึ้น GitHub จบ ✅
ฟิลด์บังคับ: `id` (ภาษาอังกฤษ ห้ามซ้ำ), `category`, `timestamp` (รูปแบบ ISO เช่น `2026-07-08T09:00:00+07:00`)

---

## 🎨 1. ดูดีไซน์ก่อน (ยังไม่ต้องตั้งค่าอะไรเลย)

เปิดไฟล์ `preview.html` ในเบราว์เซอร์ได้ทันที (ดับเบิลคลิกได้เลย ขอแค่มีเน็ตโหลดรูป/ฟอนต์)
หน้านี้โชว์ทุกส่วน: Header, การ์ด, Skeleton, Error state, หน้ารายละเอียด, คอมเมนต์ + Admin Badge, Footer
อยากแก้สี/ฟอนต์ → แก้ตัวแปรในส่วน `:root` บนสุดของ `css/style.css` แล้วรีเฟรชดู

---

## 📊 2. ตั้งค่า Google Sheets + Apps Script (Backend)

1. เข้า [sheets.google.com](https://sheets.google.com) → สร้างสเปรดชีตใหม่ ตั้งชื่อ เช่น `TechWatch-DB`
2. เมนู **ส่วนขยาย (Extensions) → Apps Script**
3. ลบโค้ดเดิม แล้ววางโค้ดจาก `backend/Code.gs` ทั้งหมด
4. แก้ค่าบนสุดของไฟล์:
   - `ADMIN_EMAILS` → ใส่อีเมล Gmail ของแอดมิน (คอมเมนต์จากอีเมลนี้จะขึ้นป้าย "เจ้าหน้าที่")
   - `FIREBASE_PROJECT_ID` → รอได้ค่าจากขั้นตอนที่ 3 แล้วค่อยกลับมาใส่
5. กด **Deploy → New deployment**
   - ประเภท: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** ⚠️ สำคัญ ไม่งั้นหน้าเว็บเรียกไม่ได้
6. กด Deploy → อนุญาตสิทธิ์ → คัดลอก **Web app URL** (ลงท้าย `/exec`)
7. นำ URL ไปวางใน `js/config.js` ที่ `GAS_URL`

> 💡 ชีต `Comments` และ `Views` จะถูกสร้างอัตโนมัติเมื่อมีการใช้งานครั้งแรก
> ⚠️ ทุกครั้งที่แก้โค้ด .gs ต้อง **Deploy → Manage deployments → Edit → New version** ไม่งั้นโค้ดใหม่ไม่ทำงาน

---

## 🔐 3. ตั้งค่า Firebase Authentication

1. เข้า [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (ปิด Analytics ได้)
2. เมนู **Build → Authentication → Get started → Sign-in method → เปิด Google** → Save
3. เมนู **Project settings (⚙️) → Your apps → ไอคอน Web (`</>`)** → ตั้งชื่อแอป → Register
4. คัดลอกค่า `apiKey`, `authDomain`, `projectId`, `appId` ไปวางใน `js/config.js` (ตัวแปร `FIREBASE_CONFIG`)
5. นำ `projectId` กลับไปใส่ใน `Code.gs` ที่ `FIREBASE_PROJECT_ID` (แล้ว Deploy เวอร์ชันใหม่)
6. **สำคัญ:** เมนู Authentication → Settings → **Authorized domains** → กด Add domain
   → เพิ่ม `YOUR-USERNAME.github.io` (ไม่เพิ่ม = ล็อกอินบน GitHub Pages ไม่ได้)

---

## 🌐 4. Deploy ขึ้น GitHub Pages

1. สร้าง Repository ใหม่บน GitHub (Public) เช่น `tech-watch`
2. อัปโหลดไฟล์ทั้งหมดขึ้น repo (ผ่านเว็บหรือ `git push`)
3. ไปที่ **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / root → Save
4. รอ 1–2 นาที เว็บจะอยู่ที่ `https://YOUR-USERNAME.github.io/tech-watch/`
5. กลับไปแก้ให้ครบ:
   - Meta tag `og:url` และ `og:image` ใน `index.html`, `detail.html`
   - `CDN_BASE` ใน `js/config.js` เป็น
     `https://cdn.jsdelivr.net/gh/PondGTR76/technology@main/`

### 🖼 การใช้รูปผ่าน jsDelivr CDN
- เก็บรูปใน `assets/images/` สกุล **.webp** (ภาพถ่าย) หรือ **.svg** (ไอคอน/กราฟิก)
- push ขึ้น GitHub แล้ว jsDelivr จะเสิร์ฟให้อัตโนมัติตามพาธ:
  `https://cdn.jsdelivr.net/gh/<user>/<repo>@main/assets/images/ชื่อรูป.webp`
- ⚠️ jsDelivr แคชไฟล์ ~7 วัน ถ้าอัปเดตรูปชื่อเดิมแล้วไม่เปลี่ยน ให้เปลี่ยนชื่อไฟล์ หรือใช้ `@main` → `@<commit-hash>`
- แปลงรูปเป็น .webp ฟรีได้ที่ squoosh.app (แนะนำกว้าง ~1200px, quality 75–80)

---

## 🛡 5. ความปลอดภัย Frontend ↔ GAS (สรุปแนวทางที่ใช้ในโค้ดนี้)

| ความเสี่ยง | วิธีป้องกันที่ทำไว้แล้ว |
|---|---|
| ปลอมตัวเป็นแอดมิน | ✅ Badge ตัดสินที่ **ฝั่งเซิร์ฟเวอร์** จากอีเมลใน **Firebase ID Token** ที่ตรวจสอบกับ Google (`verifyIdToken`) — หน้าเว็บส่งชื่อ/อีเมลปลอมมาไม่มีผล |
| สแปมคอมเมนต์ | ✅ 2 ชั้น: หน้าเว็บล็อกปุ่ม 5 วิ (localStorage) + เซิร์ฟเวอร์ล็อก 5 วิ/ผู้ใช้ (CacheService) |
| XSS จากข้อความคอมเมนต์ | ✅ ทุกข้อความผ่านฟังก์ชัน `esc()` ก่อนแสดงผล |
| ปั่นยอดวิว | ✅ นับ 1 ครั้ง / 6 ชม. / เครื่อง + ใช้ LockService กันเขียนชนกัน |
| ข้อมูลส่วนตัวรั่ว | ✅ API ไม่ส่ง email/uid ของผู้คอมเมนต์กลับไปหน้าเว็บ |
| CORS ของ GAS | ✅ POST ด้วย `Content-Type: text/plain` เลี่ยง preflight (เทคนิคมาตรฐานของ GAS) |
| ข้อความยาวผิดปกติ | ✅ จำกัด 500 ตัวอักษรทั้งสองฝั่ง |

ข้อจำกัดที่ควรรู้: `GAS_URL` และ Firebase apiKey เป็นค่าสาธารณะโดยธรรมชาติของเว็บ static (ไม่ใช่ความลับ) — ความปลอดภัยจริงอยู่ที่การตรวจ token ฝั่งเซิร์ฟเวอร์ตามตารางข้างบน

---

## ✅ 6. Checklist ก่อนเปิดใช้งานจริง

- [ ] `js/config.js` → ใส่ `GAS_URL`, `FIREBASE_CONFIG`, `CDN_BASE` ครบ
- [ ] `backend/Code.gs` → ใส่ `ADMIN_EMAILS`, `FIREBASE_PROJECT_ID` แล้ว Deploy (Anyone)
- [ ] Firebase → เปิด Google Sign-in + เพิ่ม Authorized domain
- [ ] อัปโหลด `assets/images/logo.webp` (โลโก้วงกลม) และ `og-cover.webp` (ภาพพรีวิวตอนแชร์ 1200×630)
- [ ] แก้ `og:url` / `og:image` ในไฟล์ HTML
- [ ] ทดสอบ: ล็อกอิน → คอมเมนต์ → เห็นป้าย "เจ้าหน้าที่" เมื่อใช้อีเมลแอดมิน → ยอดวิวเพิ่มใน Sheets
