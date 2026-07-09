/* ============================================================
   app.js — หน้าแรก
   Fetch JSON → Skeleton → Hero / แท็บ / ยอดนิยม / ค้นหา-กรอง-เรียง
   ============================================================ */

const grid = document.getElementById("cardsGrid");
const searchInput = document.getElementById("searchInput");
const filterRow = document.getElementById("filterRow");
const sortSelect = document.getElementById("sortSelect");

const state = {
  all: [],           // เทคโนโลยีทั้งหมด
  categories: [],     // หมวดหมู่
  views: {},          // { techId: จำนวนวิว }
  commentCounts: {},  // { techId: จำนวนความเห็น }
  query: "",
  category: "all",
  sort: "newest",
};

function catLabelMap() {
  return Object.fromEntries(state.categories.map((c) => [c.id, c.label]));
}

const NEW_WINDOW_DAYS = 14;
function isNew(t) {
  return Date.now() - new Date(t.timestamp).getTime() < NEW_WINDOW_DAYS * 86400000;
}

/* ---------- Skeleton ---------- */
function renderSkeleton(n = 6) {
  grid.innerHTML = Array.from({ length: n }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="sk sk-media"></div>
      <div class="sk sk-line w60"></div>
      <div class="sk sk-line w90"></div>
      <div class="sk sk-line w40"></div>
    </div>`).join("");
}

/* ---------- Error state ---------- */
function renderError(msg) {
  grid.innerHTML = `
    <div class="state-box">
      <div class="state-icon">📡</div>
      <h3>โหลดข้อมูลไม่สำเร็จ</h3>
      <p>${esc(msg)} — ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง</p>
      <button class="btn btn-primary" onclick="location.reload()">โหลดใหม่</button>
    </div>`;
}

/* ---------- โหลดข้อมูล ---------- */
async function loadData() {
  renderSkeleton();
  try {
    const res = await fetch(APP_CONFIG.DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.all = data.technologies || [];
    state.categories = data.categories || [];
    renderCategoryChips();
    render();
    renderHero();
    renderHomeTabs();
    renderRecentList();
    renderPopularStrip();
    loadViews();          // ยอดวิวโหลดทีหลังได้ ไม่บล็อกการแสดงผล
    loadCommentCounts();   // ยอดคอมเมนต์เช่นกัน
  } catch (e) {
    console.error(e);
    renderError(e.message);
  }
}

/* ---------- ยอดวิวจาก GAS ---------- */
async function loadViews() {
  try {
    const res = await fetch(`${APP_CONFIG.GAS_URL}?action=getViews`);
    const json = await res.json();
    if (json.ok) {
      state.views = json.views || {};
      render();
      renderPopularStrip(); // จัดอันดับใหม่ตามยอดวิวจริง
    }
  } catch (e) {
    console.warn("โหลดยอดวิวไม่สำเร็จ (ไม่กระทบการใช้งาน):", e.message);
  }
}

/* ---------- ยอดคอมเมนต์จาก GAS ---------- */
async function loadCommentCounts() {
  try {
    const res = await fetch(`${APP_CONFIG.GAS_URL}?action=getCommentCounts`);
    const json = await res.json();
    if (json.ok) {
      state.commentCounts = json.counts || {};
      render();
      renderHomeTabGrid(document.querySelector("#homeTabs .chip.active")?.dataset.cat || "all");
    }
  } catch (e) {
    console.warn("โหลดยอดคอมเมนต์ไม่สำเร็จ (ไม่กระทบการใช้งาน):", e.message);
  }
}

/* ---------- ปุ่มหมวดหมู่ (Toolbar) ---------- */
function renderCategoryChips() {
  const chips = state.categories.map(
    (c) => `<button class="chip" data-cat="${esc(c.id)}">${esc(c.label)}</button>`
  ).join("");
  sortSelect.insertAdjacentHTML("beforebegin", chips);

  filterRow.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".chip");
    if (!btn) return;
    filterRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    state.category = btn.dataset.cat;
    render();
  });
}

/* ---------- กรอง + เรียง ---------- */
function getVisibleItems() {
  let items = [...state.all];

  if (state.category !== "all") {
    items = items.filter((t) => t.category === state.category);
  }

  if (state.query) {
    const q = state.query.toLowerCase();
    items = items.filter((t) =>
      [t.title, t.summary, (t.tags || []).join(" ")]
        .join(" ").toLowerCase().includes(q)
    );
  }

  if (state.sort === "views") {
    items.sort((a, b) => (state.views[b.id] || 0) - (state.views[a.id] || 0));
  } else {
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  return items;
}

/* ---------- Render การ์ด: เทคโนโลยีทั้งหมด ---------- */
function render() {
  const items = getVisibleItems();

  if (!items.length) {
    grid.innerHTML = state.all.length
      ? `<div class="state-box">
          <div class="state-icon">🔍</div>
          <h3>ไม่พบเทคโนโลยีที่ค้นหา</h3>
          <p>ลองเปลี่ยนคำค้นหรือเลือกหมวดหมู่อื่น</p>
        </div>`
      : `<div class="state-box">
          <div class="state-icon">🛰️</div>
          <h3>ยังไม่มีข้อมูลเทคโนโลยี</h3>
          <p>เร็วๆ นี้จะมีการอัปเดตเนื้อหาเทคโนโลยี</p>
        </div>`;
    return;
  }

  const catLabel = catLabelMap();
  grid.innerHTML = items.map((t) => techCardHTML(t, catLabel, {
    views: state.views[t.id] ?? "—",
    comments: state.commentCounts[t.id] ?? 0,
    badge: isNew(t) ? { type: "new" } : null,
  })).join("");
}

/* ---------- Hero: เทคโนโลยีเด่นล่าสุด ---------- */
let heroTimer = null;

function renderHero() {
  const heroEl = document.getElementById("heroSection");
  if (!heroEl || !state.all.length) return;

  const catLabel = catLabelMap();
  const sorted = [...state.all].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const slides = sorted.slice(0, 3);
  const side = sorted.slice(3, 5);

  heroEl.innerHTML = `
    <div class="hero-slider" id="heroSlider">
      ${slides.map((t, i) => `
        <a class="hero-slide ${i === 0 ? "active" : ""}" data-i="${i}" href="detail.html?id=${encodeURIComponent(t.id)}">
          <img src="${esc(assetUrl(t.image))}" alt="${esc(t.title)}" loading="${i === 0 ? "eager" : "lazy"}">
          <div class="hero-caption">
            <span class="card-cat cat-${esc(t.category)}">${esc(catLabel[t.category] || t.category)}</span>
            <h2>${esc(t.title)}</h2>
            <p>${esc(t.summary)}</p>
          </div>
        </a>`).join("")}
      ${slides.length > 1 ? `
        <div class="hero-dots">
          ${slides.map((_, i) => `<button data-i="${i}" class="${i === 0 ? "active" : ""}" aria-label="สไลด์ ${i + 1}"></button>`).join("")}
        </div>` : ""}
    </div>
    <div class="hero-side">
      ${side.map((t) => `
        <a class="side-card side-card--hero" href="detail.html?id=${encodeURIComponent(t.id)}">
          <div class="side-thumb">
            <img src="${esc(assetUrl(t.image))}" alt="${esc(t.title)}" loading="lazy" onerror="this.parentElement.remove()">
          </div>
          <div class="side-info">
            <div class="side-cat">${esc(catLabel[t.category] || t.category)}</div>
            <div class="side-title">${esc(t.title)}</div>
            <div class="side-date">${new Date(t.timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</div>
          </div>
        </a>`).join("")}
    </div>`;

  if (slides.length > 1) initHeroSlider(slides.length);
}

function initHeroSlider(count) {
  const slider = document.getElementById("heroSlider");
  let active = 0;

  function goTo(i) {
    active = (i + count) % count;
    slider.querySelectorAll(".hero-slide").forEach((el) => el.classList.toggle("active", Number(el.dataset.i) === active));
    slider.querySelectorAll(".hero-dots button").forEach((el) => el.classList.toggle("active", Number(el.dataset.i) === active));
  }

  slider.querySelectorAll(".hero-dots button").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      goTo(Number(btn.dataset.i));
      resetTimer();
    });
  });

  function resetTimer() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => goTo(active + 1), 5000);
  }
  resetTimer();
  slider.addEventListener("mouseenter", () => clearInterval(heroTimer));
  slider.addEventListener("mouseleave", resetTimer);
}

/* ---------- แท็บหมวดหมู่: เทคโนโลยีล่าสุด ---------- */
function renderHomeTabs() {
  const tabsEl = document.getElementById("homeTabs");
  if (!tabsEl) return;

  const chips = [{ id: "all", label: "ทั้งหมด" }, ...state.categories];
  tabsEl.innerHTML = chips.map((c, i) =>
    `<button class="chip ${i === 0 ? "active" : ""}" data-cat="${esc(c.id)}">${esc(c.label)}</button>`
  ).join("");

  renderHomeTabGrid("all");

  tabsEl.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".chip");
    if (!btn) return;
    tabsEl.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    renderHomeTabGrid(btn.dataset.cat);
  });
}

function renderHomeTabGrid(cat) {
  const tabGrid = document.getElementById("homeTabGrid");
  if (!tabGrid) return;

  const catLabel = catLabelMap();
  let items = [...state.all];
  if (cat !== "all") items = items.filter((t) => t.category === cat);
  items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  items = items.slice(0, 6);

  if (!items.length) {
    tabGrid.innerHTML = `<div class="state-box"><p>ยังไม่มีเทคโนโลยีในหมวดนี้</p></div>`;
    return;
  }

  tabGrid.innerHTML = items.map((t) => techCardHTML(t, catLabel, {
    views: state.views[t.id] ?? "—",
    comments: state.commentCounts[t.id] ?? 0,
    showDate: false,
  })).join("");
}

/* ---------- แถบข้าง: มาใหม่ล่าสุด ---------- */
function renderRecentList() {
  const list = document.getElementById("recentList");
  if (!list) return;

  const items = [...state.all]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);

  list.innerHTML = items.map((t) => `
    <li>
      <a class="side-card" href="detail.html?id=${encodeURIComponent(t.id)}">
        <div class="side-thumb">
          <img src="${esc(assetUrl(t.image))}" alt="${esc(t.title)}" loading="lazy" onerror="this.parentElement.remove()">
        </div>
        <div class="side-info">
          <div class="side-title">${esc(t.title)}</div>
          <div class="side-date">${new Date(t.timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</div>
        </div>
      </a>
    </li>`).join("");
}

/* ---------- ยอดนิยม (เลื่อนแนวนอน) ---------- */
function renderPopularStrip() {
  const strip = document.getElementById("popularStrip");
  if (!strip) return;

  const catLabel = catLabelMap();
  const items = [...state.all]
    .sort((a, b) => (state.views[b.id] || 0) - (state.views[a.id] || 0))
    .slice(0, 8);

  strip.innerHTML = items.map((t, i) => techCardHTML(t, catLabel, {
    views: state.views[t.id] ?? "—",
    badge: { type: "rank", n: i + 1 },
    showDate: false,
  })).join("");
}

/* ---------- Events ---------- */
let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {   // debounce 250ms ลดการ render ถี่เกิน
    state.query = searchInput.value.trim();
    render();
  }, 250);
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  render();
});

loadData();
