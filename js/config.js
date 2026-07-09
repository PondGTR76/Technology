/* ============================================================
   config.js — ตั้งค่าทั้งหมดที่เดียว
   ============================================================ */

const APP_CONFIG = {
  // 1) URL ของ Google Apps Script Web App (ได้จากตอน Deploy)
  GAS_URL: "https://script.google.com/macros/s/AKfycbzs-mhUI7AHh9eJdvOkaV6o_18TG-t4MxMLYVbHq-h7ASrqFOIfymDtJVR4eMldDoYM/exec",

  // 2) ฐาน URL รูปภาพผ่าน jsDelivr CDN
  //    รูปแบบ: https://cdn.jsdelivr.net/gh/<user>/<repo>@<branch>/
  //    ปล่อยว่าง "" = โหลดรูปจากโฟลเดอร์ในเว็บโดยตรง (ตอนทดสอบ local)
  CDN_BASE: "",
  // CDN_BASE: "https://cdn.jsdelivr.net/gh/YOUR-USERNAME/YOUR-REPO@main/",

  // 3) พาธไฟล์ข้อมูล
  DATA_URL: "data/technologies.json",

  // 4) หน่วงปุ่มคอมเมนต์กันสแปม (มิลลิวินาที)
  COMMENT_COOLDOWN_MS: 5000,
};

// Firebase config — คัดลอกจาก Firebase Console > Project settings > Your apps
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAi0VNWQQM5RmjZzqW-SjxQWWB3m3C8_Uk",
  authDomain: "techwatch-9b433.firebaseapp.com",
  projectId: "techwatch-9b433",
  appId: "1:1034182967703:web:e920fe76c41efb3a1e44d2",
};

/** แปลงพาธรูปให้ชี้ CDN อัตโนมัติ */
function assetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path; // เป็น URL เต็มอยู่แล้ว
  return APP_CONFIG.CDN_BASE + path;
}

/** Toast แจ้งเตือนสั้นๆ */
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), 2400);
}

/** สร้าง HTML การ์ดเทคโนโลยี ใช้ร่วมกันทุกหน้า (หน้าแรก/หน้ารายละเอียด) */
function techCardHTML(t, catLabelMap, opts = {}) {
  const views = opts.views ?? "—";
  const comments = opts.comments;
  const isRank = opts.badge && opts.badge.type === "rank";
  const isNew = opts.badge && opts.badge.type === "new";
  const dateStr = new Date(t.timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

  return `
    <a class="tech-card" href="${opts.href || `detail.html?id=${encodeURIComponent(t.id)}`}">
      ${isNew ? `<span class="badge-new">NEW</span>` : ""}
      ${isRank ? `<span class="rank-badge">${opts.badge.n}</span>` : ""}
      <div class="card-media">
        <img src="${esc(assetUrl(t.image))}" alt="${esc(t.title)}" loading="lazy" onerror="this.remove()">
      </div>
      <div class="card-body">
        <div class="card-top">
          <span class="card-cat cat-${esc(t.category)}">${esc(catLabelMap[t.category] || t.category)}</span>
          ${opts.showDate === false ? "" : `<span class="card-date">${dateStr}</span>`}
        </div>
        <h3 class="card-title">${esc(t.title)}</h3>
        <p class="card-summary">${esc(t.summary)}</p>
        <div class="card-meta">
          <span class="card-stats">👁 ${views} วิว${comments !== undefined ? `<span class="sep">·</span>💬 ${comments} ความเห็น` : ""}</span>
        </div>
      </div>
    </a>`;
}
/** escape HTML กัน XSS เวลาแสดงข้อความจากผู้ใช้ */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ---------- ปุ่มกลับขึ้นด้านบน (โผล่หลังเลื่อนลงมาไกลพอ ใช้ได้ทั้งคอมและมือถือ) ---------- */
(function initBackToTop() {
  const btn = document.createElement("button");
  btn.id = "btnToTop";
  btn.className = "btn-to-top";
  btn.setAttribute("aria-label", "กลับขึ้นด้านบน");
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>`;
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(btn); // config.js โหลดท้าย body อยู่แล้ว document.body พร้อมใช้งานแน่นอน

  window.addEventListener("scroll", () => {
    btn.classList.toggle("show", window.scrollY > 500);
  }, { passive: true });
})();
