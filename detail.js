/* ============================================================
   detail.js — หน้ารายละเอียด
   Render เนื้อหา → นับวิว → แชร์ → เทคโนโลยีที่เกี่ยวข้อง → คอมเมนต์
   (+ ยอดคอมเมนต์ / เรียงคอมเมนต์ / ลบคอมเมนต์สำหรับแอดมิน)
   ============================================================ */

const wrap = document.getElementById("detailWrap");
const techId = new URLSearchParams(location.search).get("id");

let tech = null;
let allTech = [];
let catLabelMapCache = {};
let commentsCache = [];      // คอมเมนต์ที่โหลดล่าสุด (เก็บไว้ให้เรียงใหม่ได้โดยไม่ยิง API ซ้ำ)
let commentSort = "newest";
let isAdmin = false;         // ผู้ใช้ที่ล็อกอินอยู่เป็นแอดมินหรือไม่ (เช็คฝั่งเซิร์ฟเวอร์)

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
    catLabelMapCache = Object.fromEntries((data.categories || []).map((c) => [c.id, c.label]));
    allTech = data.technologies || [];
    tech = allTech.find((t) => t.id === techId);
    if (!tech) return renderNotFound();

    renderDetail();
    countView();
    loadComments();
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

/* ---------- Render เนื้อหา ---------- */
function renderDetail() {
  document.title = `${tech.title} | กวจ.สสว.วท.กห.`;

  wrap.innerHTML = `
    <nav class="breadcrumb"><a href="index.html">หน้าแรก</a> › ${esc(catLabelMapCache[tech.category] || tech.category)}</nav>

    <div class="detail-hero">
      <img src="${esc(assetUrl(tech.image))}" alt="${esc(tech.title)}" onerror="this.remove()">
    </div>

    <div class="detail-head">
      <h1>${esc(tech.title)}</h1>
    </div>

    <div class="detail-meta">
      <span>📅 ${new Date(tech.timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</span>
      <span class="card-views" id="viewCount">— วิว</span>
      <span class="card-comments" id="metaCommentCount">— ความเห็น</span>
      <span>📌 ${esc(tech.source || "")}</span>
    </div>

    <article class="detail-body">${esc(tech.description)}</article>

    <div class="tag-row">
      ${(tech.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}
    </div>

    <div class="share-row" style="margin-top:20px;">
      <button class="btn" id="btnShare">🔗 คัดลอกลิงก์</button>
      <button class="btn share-btn fb" id="btnShareFb">Facebook</button>
      <button class="btn share-btn x" id="btnShareX">X (Twitter)</button>
    </div>

    <section class="related-section" id="relatedSection"></section>

    <section class="comments-section">
      <div class="section-head">
        <h2 id="commentsHeading">ความคิดเห็น</h2>
        <select class="comment-sort" id="commentSort" aria-label="เรียงความคิดเห็น">
          <option value="newest">ใหม่สุดก่อน</option>
          <option value="oldest">เก่าสุดก่อน</option>
        </select>
      </div>
      <div id="commentFormArea"></div>
      <ul class="comment-list" id="commentList">
        <li class="comment-item"><div class="sk sk-line w90" style="height:38px;flex:1;margin:0;"></div></li>
      </ul>
    </section>`;

  document.getElementById("btnShare").addEventListener("click", copyLink);
  document.getElementById("btnShareFb").addEventListener("click", shareFacebook);
  document.getElementById("btnShareX").addEventListener("click", shareTwitter);
  document.getElementById("commentSort").addEventListener("change", (ev) => {
    commentSort = ev.target.value;
    renderCommentList();
  });

  renderRelated();
  renderCommentForm();
  document.addEventListener("auth:changed", onAuthChanged);
}

/* ---------- เทคโนโลยีที่เกี่ยวข้อง ---------- */
function renderRelated() {
  const section = document.getElementById("relatedSection");
  if (!section) return;

  const related = allTech
    .filter((t) => t.id !== tech.id && t.category === tech.category)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 3);

  if (!related.length) { section.innerHTML = ""; return; }

  section.innerHTML = `
    <div class="section-head"><h3>เทคโนโลยีที่เกี่ยวข้อง</h3></div>
    <div class="cards-grid compact-grid">
      ${related.map((t) => techCardHTML(t, catLabelMapCache, { showDate: false })).join("")}
    </div>`;
}

/* ---------- Share ---------- */
async function copyLink() {
  const url = location.href;
  try {
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      await navigator.share({ title: tech.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    showToast("คัดลอกลิงก์แล้ว พร้อมแชร์!");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showToast("คัดลอกลิงก์แล้ว พร้อมแชร์!");
  }
}

function shareFacebook() {
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}`;
  window.open(url, "_blank", "noopener,width=600,height=500");
}

function shareTwitter() {
  const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(tech.title)}`;
  window.open(url, "_blank", "noopener,width=600,height=500");
}

/* ---------- นับวิว ---------- */
async function countView() {
  try {
    const key = `viewed_${techId}`;
    const last = Number(localStorage.getItem(key) || 0);
    const shouldCount = Date.now() - last > 6 * 3600 * 1000;

    const res = await fetch(APP_CONFIG.GAS_URL, {
      method: "POST",
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

/* ---------- Auth เปลี่ยนสถานะ: เช็คสิทธิ์แอดมิน + รีเฟรชฟอร์ม/ลิสต์ ---------- */
async function onAuthChanged() {
  renderCommentForm();
  isAdmin = await checkAdmin();
  renderCommentList();
}

async function checkAdmin() {
  if (!currentUser) return false;
  try {
    const idToken = await getIdToken();
    const res = await fetch(APP_CONFIG.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "whoami", idToken }),
    });
    const json = await res.json();
    return json.ok && json.isAdmin === true;
  } catch {
    return false;
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

  const lastSent = Number(localStorage.getItem("lastCommentAt") || 0);
  const wait = APP_CONFIG.COMMENT_COOLDOWN_MS - (Date.now() - lastSent);
  if (wait > 0) return showToast(`กรุณารอ ${Math.ceil(wait / 1000)} วินาทีก่อนส่งอีกครั้ง`);

  btn.disabled = true;
  btn.textContent = "กำลังส่ง...";

  try {
    const idToken = await getIdToken();
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
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "ส่ง";
    }, APP_CONFIG.COMMENT_COOLDOWN_MS);
  }
}

/* ---------- โหลดคอมเมนต์ ---------- */
async function loadComments() {
  try {
    const res = await fetch(`${APP_CONFIG.GAS_URL}?action=getComments&techId=${encodeURIComponent(techId)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "โหลดคอมเมนต์ไม่สำเร็จ");

    commentsCache = json.comments || [];
    renderCommentList();
  } catch (e) {
    const list = document.getElementById("commentList");
    if (list) list.innerHTML = `<li class="login-hint">โหลดความคิดเห็นไม่สำเร็จ (${esc(e.message)})</li>`;
  }
}

/* ---------- แสดงลิสต์คอมเมนต์ (+ เรียง / ลบสำหรับแอดมิน) ---------- */
function renderCommentList() {
  const list = document.getElementById("commentList");
  const heading = document.getElementById("commentsHeading");
  const metaCount = document.getElementById("metaCommentCount");
  if (!list) return;

  if (heading) heading.textContent = `ความคิดเห็น (${commentsCache.length})`;
  if (metaCount) metaCount.textContent = `${commentsCache.length} ความเห็น`;

  if (!commentsCache.length) {
    list.innerHTML = `<li class="login-hint">ยังไม่มีความคิดเห็น — เป็นคนแรกเลย!</li>`;
    return;
  }

  const sorted = [...commentsCache].sort((a, b) =>
    commentSort === "oldest"
      ? new Date(a.timestamp) - new Date(b.timestamp)
      : new Date(b.timestamp) - new Date(a.timestamp)
  );

  list.innerHTML = sorted.map((c) => `
    <li class="comment-item ${c.isAdmin ? "is-admin" : ""}">
      <img src="${esc(c.photo || "")}" alt="" referrerpolicy="no-referrer"
           onerror="this.style.display='none'">
      <div class="comment-body">
        <div class="comment-head">
          <span class="comment-name">${esc(c.name)}</span>
          ${c.isAdmin ? `<span class="badge-admin">เจ้าหน้าที่</span>` : ""}
          <span class="comment-time">${new Date(c.timestamp).toLocaleString("th-TH")}</span>
          ${isAdmin ? `<button class="comment-delete" data-id="${esc(c.id)}">ลบ</button>` : ""}
        </div>
        <p class="comment-text">${esc(c.text)}</p>
      </div>
    </li>`).join("");

  if (isAdmin) {
    list.querySelectorAll(".comment-delete").forEach((btn) => {
      btn.addEventListener("click", () => deleteComment(btn.dataset.id));
    });
  }
}

/* ---------- ลบคอมเมนต์ (แอดมินเท่านั้น — ตรวจสิทธิ์จริงฝั่งเซิร์ฟเวอร์) ---------- */
async function deleteComment(commentId) {
  if (!confirm("ลบความคิดเห็นนี้?")) return;
  try {
    const idToken = await getIdToken();
    const res = await fetch(APP_CONFIG.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "deleteComment", commentId, idToken }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "ลบไม่สำเร็จ");
    showToast("ลบความคิดเห็นแล้ว");
    loadComments();
  } catch (e) {
    showToast("ลบไม่สำเร็จ: " + e.message);
  }
}

init();
