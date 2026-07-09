/**
 * ============================================================
 * Code.gs — Backend สำหรับเว็บโชว์เทคโนโลยี กวจ.สสว.วท.กห.
 * Google Apps Script + Google Sheets
 *
 * โครงสร้างชีต (สร้างอัตโนมัติเมื่อรันครั้งแรก):
 *   ชีต "Comments": timestamp | techId | uid | name | email | photo | text | isAdmin
 *   ชีต "Views":    techId | count
 * ============================================================
 */

// ⚙️ ตั้งค่า ------------------------------------------------------
const ADMIN_EMAILS = [
  "your-admin@gmail.com",   // 👈 ใส่อีเมลแอดมิน (ของคุณ) — เช็คฝั่ง Server ปลอมไม่ได้
];

const FIREBASE_PROJECT_ID = "techwatch-9b433"; // projectId เดียวกับใน config.js
const FIREBASE_WEB_API_KEY = "AIzaSyAi0VNWQQM5RmjZzqW-SjxQWWB3m3C8_Uk"; // apiKey เดียวกับใน config.js

const SHEET_COMMENTS = "Comments";
const SHEET_VIEWS = "Views";
const MAX_COMMENT_LEN = 500;
const SERVER_COOLDOWN_SEC = 5; // Rate limit ฝั่งเซิร์ฟเวอร์ (เชื่อถือได้กว่าฝั่งหน้าเว็บ)

// 📥 GET: อ่านข้อมูล ----------------------------------------------
function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === "getComments") return json(getComments(e.parameter.techId));
    if (action === "getViews") return json(getViews());
    return json({ ok: false, error: "unknown action" });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// 📤 POST: เขียนข้อมูล (body เป็น text/plain เพื่อเลี่ยง CORS preflight)
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === "addComment") return json(addComment(body));
    if (body.action === "addView") return json(addView(body));
    return json({ ok: false, error: "unknown action" });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// 💬 คอมเมนต์ -----------------------------------------------------
function addComment(body) {
  const text = String(body.text || "").trim().slice(0, MAX_COMMENT_LEN);
  if (!text) return { ok: false, error: "ข้อความว่าง" };
  if (!body.techId) return { ok: false, error: "ไม่ระบุ techId" };

  // 🔐 ตรวจสอบตัวตนจริงจาก Firebase ID Token (กันปลอมชื่อ/อีเมล)
  const user = verifyIdToken(body.idToken);
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบใหม่" };

  // 🚦 Rate limit ฝั่งเซิร์ฟเวอร์: 1 คอมเมนต์ / 5 วิ ต่อผู้ใช้
  const cache = CacheService.getScriptCache();
  const rlKey = "rl_" + user.uid;
  if (cache.get(rlKey)) return { ok: false, error: "ส่งถี่เกินไป กรุณารอสักครู่" };
  cache.put(rlKey, "1", SERVER_COOLDOWN_SEC);

  const isAdmin = ADMIN_EMAILS.indexOf(user.email.toLowerCase()) !== -1;

  const sheet = getSheet(SHEET_COMMENTS,
    ["timestamp", "techId", "uid", "name", "email", "photo", "text", "isAdmin"]);
  sheet.appendRow([
    new Date().toISOString(),
    String(body.techId),
    user.uid,
    user.name || "ผู้ใช้",
    user.email,
    user.picture || "",
    text,
    isAdmin,
  ]);

  return { ok: true, isAdmin: isAdmin };
}

function getComments(techId) {
  if (!techId) return { ok: false, error: "ไม่ระบุ techId" };
  const sheet = getSheet(SHEET_COMMENTS,
    ["timestamp", "techId", "uid", "name", "email", "photo", "text", "isAdmin"]);
  const rows = sheet.getDataRange().getValues();
  const comments = [];

  for (let i = 1; i < rows.length; i++) {
    const [timestamp, id, uid, name, email, photo, text, isAdmin] = rows[i];
    if (String(id) !== String(techId)) continue;
    comments.push({
      timestamp: timestamp,
      name: name,
      photo: photo,
      text: text,
      isAdmin: isAdmin === true || isAdmin === "TRUE",
      // ⚠️ ไม่ส่ง email/uid กลับไปหน้าเว็บ เพื่อความเป็นส่วนตัว
    });
  }
  comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return { ok: true, comments: comments };
}

// 👁 ยอดวิว -------------------------------------------------------
function addView(body) {
  if (!body.techId) return { ok: false, error: "ไม่ระบุ techId" };

  // ใช้ Lock กันเขียนชนกันเมื่อคนเปิดพร้อมกัน
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = getSheet(SHEET_VIEWS, ["techId", "count"]);
    const rows = sheet.getDataRange().getValues();
    let views = 0;

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(body.techId)) {
        views = Number(rows[i][1]) || 0;
        if (body.count) {
          views += 1;
          sheet.getRange(i + 1, 2).setValue(views);
        }
        return { ok: true, views: views };
      }
    }
    // ยังไม่มีแถวของ techId นี้
    views = body.count ? 1 : 0;
    sheet.appendRow([String(body.techId), views]);
    return { ok: true, views: views };
  } finally {
    lock.releaseLock();
  }
}

function getViews() {
  const sheet = getSheet(SHEET_VIEWS, ["techId", "count"]);
  const rows = sheet.getDataRange().getValues();
  const views = {};
  for (let i = 1; i < rows.length; i++) {
    views[String(rows[i][0])] = Number(rows[i][1]) || 0;
  }
  return { ok: true, views: views };
}

// 🔐 ตรวจสอบ Firebase ID Token ------------------------------------
/**
 * ยืนยันว่า token มาจาก Firebase โปรเจกต์ของเราจริง
 * → หน้าเว็บปลอมชื่อ/อีเมลเพื่อหลอกเอา Admin Badge ไม่ได้
 *
 * ⚠️ ใช้ Identity Toolkit REST API (accounts:lookup) แทน oauth2.googleapis.com/tokeninfo
 * เพราะ tokeninfo ใช้ตรวจ Google Sign-In OAuth token เท่านั้น ไม่รองรับ Firebase ID Token
 * (คนละ issuer/format กัน) ถ้าใช้ tokeninfo ตรวจ Firebase ID Token จะ fail ทุกครั้ง
 * ทำให้คอมเมนต์ไม่ได้เลยพร้อมขึ้น "กรุณาเข้าสู่ระบบใหม่"
 */
function verifyIdToken(idToken) {
  if (!idToken) return null;
  try {
    const res = UrlFetchApp.fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_WEB_API_KEY,
      {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ idToken: idToken }),
        muteHttpExceptions: true,
      }
    );
    if (res.getResponseCode() !== 200) return null;
    const info = JSON.parse(res.getContentText());
    const user = info.users && info.users[0];
    if (!user) return null;

    return {
      uid: user.localId,
      email: String(user.email || "").toLowerCase(),
      name: user.displayName || "",
      picture: user.photoUrl || "",
    };
  } catch (e) {
    return null;
  }
}

// 🛠 Utilities -----------------------------------------------------
function getSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
