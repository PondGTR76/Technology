/* ============================================================
   detail.js — หน้ารายละเอียด
   Render เนื้อหา → นับวิว → Share/Copy Link → คอมเมนต์ (+Admin Badge)
   ============================================================ */

const wrap = document.getElementById("detailWrap");
const techId = new URLSearchParams(location.search).get("id");

let tech = null;
let catLabelMap = {};
let prevTech = null; // เทคโนโลยีใหม่กว่า (ก่อนหน้าในลิสต์)
let nextTech = null; // เทคโนโลยีเก่ากว่า (ถัดไปในลิสต์)

/* ---------- โหลดข้อมูลเทคโนโลยี ---------- */
async function init() {
  if (!techId) return renderNotFound();

  wrap.innerHTML = `
    <div class="skeleton-card"><div class="sk sk-media"></div>
      <div class="sk sk-line w60"></div><div class="sk sk-line w90"></div>
      <div class="sk sk-line w40"></div></div>`;

  try {
    const res = await fetch(APP_CONFIG.DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    catLabelMap = Object.fromEntries((data.categories || []).map((c) => [c.id, c.label]));
    tech = (data.technologies || []).find((t) => t.id === techId);
    if (!tech) return renderNotFound();

    // เรียงลำดับแบบเดียวกับหน้าแรก (มาใหม่สุดก่อน) เพื่อหาเทคโนโลยีก่อนหน้า/ถัดไป
    const visibleList = (data.technologies || [])
      .filter((t) => t.summary && t.summary.trim())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const idx = visibleList.findIndex((t) => t.id === techId);
    if (idx !== -1) {
      prevTech = visibleList[idx - 1] || null;
      nextTech = visibleList[idx + 1] || null;
    }

    renderDetail();
    countView();      // นับวิว (ไม่บล็อก UI)
    loadComments();   // โหลดคอมเมนต์
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `
      <div class="state-box">
        <div class="state-icon">📡</div>
        <h3>โหลดข้อมูลไม่สำเร็จ</h3>
        <p>${esc(e.message)}</p>
        <button class="btn btn-primary" onclick="location.reload()">โหลดใหม่</button>
      </div>`;
  }
}

function renderNotFound() {
  wrap.innerHTML = `
    <div class="state-box">
      <div class="state-icon">🛰️</div>
      <h3>ไม่พบเทคโนโลยีนี้</h3>
      <p>ลิงก์อาจไม่ถูกต้อง หรือข้อมูลถูกย้ายแล้ว</p>
      <a class="btn btn-primary" href="index.html">กลับหน้าแรก</a>
    </div>`;
}

/* ---------- Markdown เบื้องต้นสำหรับเนื้อหารายละเอียด (bold / bullet list / ย่อหน้า) ---------- */
function inlineMd(line) {
  return esc(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdown(text) {
  if (!text) return "";
  const headingRe = /^\*\*(.+)\*\*$/;

  return text.split(/\n{2,}/).map((block) => {
    let lines = block.split("\n").filter((l) => l.trim() !== "");
    if (!lines.length) return "";

    let html = "";

    // บรรทัดแรกเป็นหัวข้อตัวหนาล้วน (ทั้งบรรทัดอยู่ใน **...**) แยกเป็น <h3> ก่อนเสมอ
    // แม้จะมีเนื้อหาอื่น (bullet list / ย่อหน้า) ตามมาในบล็อกเดียวกันก็ตาม
    const headingLine = lines[0].trim();
    if (headingRe.test(headingLine) && !headingLine.startsWith("- ")) {
      html += `<h3>${inlineMd(headingLine.match(headingRe)[1])}</h3>`;
      lines = lines.slice(1);
    }
    if (!lines.length) return html;

    if (lines.every((l) => l.trim().startsWith("- "))) {
      html += `<ul>${lines.map((l) => `<li>${inlineMd(l.trim().slice(2))}</li>`).join("")}</ul>`;
    } else {
      html += `<p>${lines.map(inlineMd).join("<br>")}</p>`;
    }
    return html;
  }).join("");
}

/* ---------- Render เนื้อหา ---------- */
function renderDetail() {
  document.title = `${tech.title} | กวจ.สสว.วท.กห.`;

  wrap.innerHTML = `
    <div class="detail-topbar">
      <button class="btn-back" id="btnBack" aria-label="ย้อนกลับ" title="ย้อนกลับ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <nav class="breadcrumb"><a href="index.html">หน้าแรก</a> › ${esc(catLabelMap[tech.category] || tech.category)}</nav>
    </div>

    <div class="detail-hero">
      <img src="${esc(assetUrl(tech.image))}" alt="${esc(tech.title)}" onerror="this.remove()">
    </div>

    <div class="detail-head">
      <h1>${esc(tech.title)}</h1>
      <button class="btn" id="btnShare">🔗 คัดลอกลิงก์</button>
    </div>

    <div class="detail-meta">
      <span>📅 ${new Date(tech.timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</span>
      <span class="card-views" id="viewCount">— วิว</span>
    </div>

    <article class="detail-body">${renderMarkdown(tech.description)}</article>

    <div class="tag-row">
      ${(tech.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}
    </div>

    ${tech.source ? `
    <div class="source-box">
      <span class="source-box-icon">📚</span>
      <div>
        <div class="source-box-label">แหล่งที่มาข้อมูล</div>
        <div class="source-box-text">${esc(tech.source)}</div>
      </div>
    </div>` : ""}

    ${(prevTech || nextTech) ? `
    <nav class="post-nav" aria-label="เทคโนโลยีก่อนหน้า/ถัดไป">
      ${prevTech ? `
      <a class="post-nav-item post-nav-prev" href="detail.html?id=${encodeURIComponent(prevTech.id)}">
        <span class="post-nav-arrow">←</span>
        <span class="post-nav-text">
          <span class="post-nav-label">ก่อนหน้า</span>
          <span class="post-nav-title">${esc(prevTech.title)}</span>
        </span>
      </a>` : `<span class="post-nav-item post-nav-empty"></span>`}
      ${nextTech ? `
      <a class="post-nav-item post-nav-next" href="detail.html?id=${encodeURIComponent(nextTech.id)}">
        <span class="post-nav-text">
          <span class="post-nav-label">ถัดไป</span>
          <span class="post-nav-title">${esc(nextTech.title)}</span>
        </span>
        <span class="post-nav-arrow">→</span>
      </a>` : `<span class="post-nav-item post-nav-empty"></span>`}
    </nav>` : ""}

    <section class="comments-section">
      <h2>ความคิดเห็น</h2>
      <div id="commentFormArea"></div>
      <ul class="comment-list" id="commentList">
        <li class="comment-item"><div class="sk sk-line w90" style="height:38px;flex:1;margin:0;"></div></li>
      </ul>
    </section>`;

  document.getElementById("btnShare").addEventListener("click", copyLink);
  document.getElementById("btnBack").addEventListener("click", goBack);
  renderCommentForm();
  document.addEventListener("auth:changed", renderCommentForm);
}

/* ---------- ปุ่มย้อนกลับ: ใช้ history ถ้ามี ไม่งั้นกลับหน้าแรก (กันเคสเปิดลิงก์ตรงจากแชท) ---------- */
function goBack() {
  if (document.referrer && new URL(document.referrer).origin === location.origin) {
    history.back();
  } else {
    location.href = "index.html";
  }
}

/* ---------- Share / Copy Link ---------- */
async function copyLink() {
  const url = location.href;
  try {
    // มือถือ: ใช้ Share Sheet ของระบบ (แชร์เข้า Line ได้เลย)
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      await navigator.share({ title: tech.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    showToast("คัดลอกลิงก์แล้ว พร้อมแชร์!");
  } catch {
    // Fallback สำหรับเบราว์เซอร์เก่า
    const ta = document.createElement("textarea");
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showToast("คัดลอกลิงก์แล้ว พร้อมแชร์!");
  }
}

/* ---------- นับวิว ---------- */
async function countView() {
  try {
    // กันรีเฟรชปั่นวิว: 1 เครื่องนับ 1 ครั้ง / 6 ชม. ต่อเทคโนโลยี
    const key = `viewed_${techId}`;
    const last = Number(localStorage.getItem(key) || 0);
    const shouldCount = Date.now() - last > 6 * 3600 * 1000;

    const res = await fetch(APP_CONFIG.GAS_URL, {
      method: "POST",
      // ใช้ text/plain เพื่อเลี่ยง CORS preflight ของ GAS
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "addView", techId, count: shouldCount }),
    });
    const json = await res.json();
    if (json.ok) {
      if (shouldCount) localStorage.setItem(key, String(Date.now()));
      const el = document.getElementById("viewCount");
      if (el) el.textContent = `${json.views} วิว`;
    }
  } catch (e) {
    console.warn("นับวิวไม่สำเร็จ:", e.message);
  }
}

/* ---------- ฟอร์มคอมเมนต์ + Rate Limiting ---------- */
function renderCommentForm() {
  const area = document.getElementById("commentFormArea");
  if (!area) return;

  if (!currentUser) {
    area.innerHTML = `
      <div class="login-hint">
        เข้าสู่ระบบด้วย Google เพื่อร่วมแสดงความคิดเห็น
      </div>`;
    return;
  }

  area.innerHTML = `
    <div class="comment-form">
      <img src="${esc(currentUser.photoURL || "")}" alt="" referrerpolicy="no-referrer"
           onerror="this.style.display='none'">
      <textarea id="commentText" maxlength="500" placeholder="แสดงความคิดเห็นอย่างสร้างสรรค์..."></textarea>
      <button class="btn btn-primary" id="btnComment">ส่ง</button>
    </div>`;
  document.getElementById("btnComment").addEventListener("click", submitComment);
}

async function submitComment() {
  const btn = document.getElementById("btnComment");
  const ta = document.getElementById("commentText");
  const text = ta.value.trim();

  if (!text) return showToast("พิมพ์ข้อความก่อนส่ง");
  if (!currentUser) return showToast("กรุณาเข้าสู่ระบบก่อน");

  // Rate limit ฝั่งหน้าเว็บ: กันกดรัว 5 วินาที (จำข้ามรีเฟรชด้วย localStorage)
  const lastSent = Number(localStorage.getItem("lastCommentAt") || 0);
  const wait = APP_CONFIG.COMMENT_COOLDOWN_MS - (Date.now() - lastSent);
  if (wait > 0) return showToast(`กรุณารอ ${Math.ceil(wait / 1000)} วินาทีก่อนส่งอีกครั้ง`);

  btn.disabled = true;
  btn.textContent = "กำลังส่ง...";

  try {
    const idToken = await getIdToken(); // ส่ง token ให้ backend ยืนยันตัวตน
    const res = await fetch(APP_CONFIG.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "addComment", techId, text, idToken }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "ไม่ทราบสาเหตุ");

    ta.value = "";
    localStorage.setItem("lastCommentAt", String(Date.now()));
    showToast("ส่งความคิดเห็นแล้ว");
    loadComments();
  } catch (e) {
    console.error(e);
    showToast("ส่งไม่สำเร็จ: " + e.message);
  } finally {
    // ล็อกปุ่มต่อจนครบ 5 วินาที
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "ส่ง";
    }, APP_CONFIG.COMMENT_COOLDOWN_MS);
  }
}

/* ---------- โหลดคอมเมนต์ (+ Admin Badge) ---------- */
async function loadComments() {
  const list = document.getElementById("commentList");
  try {
    const res = await fetch(`${APP_CONFIG.GAS_URL}?action=getComments&techId=${encodeURIComponent(techId)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "โหลดคอมเมนต์ไม่สำเร็จ");

    if (!json.comments.length) {
      list.innerHTML = `<li class="login-hint">ยังไม่มีความคิดเห็น — เป็นคนแรกเลย!</li>`;
      return;
    }

    list.innerHTML = json.comments.map((c) => `
      <li class="comment-item ${c.isAdmin ? "is-admin" : ""}">
        <img src="${esc(c.photo || "")}" alt="" referrerpolicy="no-referrer"
             onerror="this.style.display='none'">
        <div>
          <div class="comment-head">
            <span class="comment-name">${esc(c.name)}</span>
            ${c.isAdmin ? `<span class="badge-admin">เจ้าหน้าที่</span>` : ""}
            <span class="comment-time">${new Date(c.timestamp).toLocaleString("th-TH")}</span>
          </div>
          <p class="comment-text">${esc(c.text)}</p>
        </div>
      </li>`).join("");
  } catch (e) {
    list.innerHTML = `<li class="login-hint">โหลดความคิดเห็นไม่สำเร็จ (${esc(e.message)})</li>`;
  }
}

init();
