/* ============================================================
   infographics.js — แกลเลอรีอินโฟกราฟฟิก 3D Coverflow
   โหลดข้อมูล → เรนเดอร์สไลด์ → หมุน/สไลด์/สวมนิ้ว → คลิกที่สไลด์กลางเพื่อซูมเต็มจอ
   ============================================================ */

(async function initInfographics() {
  const section = document.getElementById("infographicSection");
  if (!section) return; // หน้านี้ไม่มีแกลเลอรี

  const track = document.getElementById("coverflowTrack");
  const counter = document.getElementById("coverflowCounter");
  const modal = document.getElementById("coverflowModal");
  const modalImg = document.getElementById("coverflowModalImg");
  const modalTitle = document.getElementById("coverflowModalTitle");

  let items = [];
  let active = 0;

  try {
    const res = await fetch("data/infographics.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    items = await res.json();
  } catch (e) {
    console.warn("โหลดอินโฟกราฟฟิกไม่สำเร็จ:", e.message);
    section.hidden = true;
    return;
  }

  if (!items.length) {
    section.hidden = true;
    return;
  }

  track.innerHTML = items.map((it, i) => `
    <button class="coverflow-item" type="button" data-i="${i}" aria-label="${esc(it.title)}">
      <span class="cover"><img src="${esc(it.image)}" alt="${esc(it.title)}" loading="lazy"></span>
      <span class="reflection" style="background-image:url('${esc(it.image)}')" aria-hidden="true"></span>
    </button>`).join("");

  const els = [...track.querySelectorAll(".coverflow-item")];
  let lastActiveEl = null;
  let firstLayout = true;

  /* จอเล็ก (มือถือ) โชว์แค่ข้างละ 1 อันแบบจางๆ ไม่ให้รก จอใหญ่โชว์ได้กว้างกว่าแต่ต้องมีจุดตัด
     ไม่งั้นทุกสไลด์ (แม้แต่ตัวไกลสุด) จะยังโผล่มาจางๆ ทับกันเต็มจอ */
  function maxVisibleDepth() {
    const w = window.innerWidth;
    if (w <= 720) return 1;
    return 2;
  }

  function layout() {
    const maxDepth = maxVisibleDepth();
    els.forEach((el, i) => {
      const offset = i - active;
      const absOffset = Math.abs(offset);
      const depth = Math.min(absOffset, 3); // ใช้คุมความลึก (translateZ) ของสไลด์ที่ยังโชว์อยู่เท่านั้น
      el.style.setProperty("--offset", offset);
      el.style.setProperty("--depth", depth);
      el.style.zIndex = String(100 - depth);
      el.classList.toggle("is-active", offset === 0);

      // ใช้ absOffset จริง (ไม่ใช่ depth ที่ถูก cap ไว้ที่ 3) ตัดสินว่าจะโชว์ไหม
      // ไม่งั้นสไลด์ที่อยู่ไกลสุดๆ จะยังนับว่า depth<=maxDepth เสมอ โผล่มาซ้อนกันเต็มจอ
      const visible = absOffset <= maxDepth;
      let opacity = "0";
      if (visible) {
        opacity = depth === 0 ? "1" : depth === 1 ? "0.45" : "0.2";
      }
      el.style.opacity = opacity;
      el.style.pointerEvents = visible ? "" : "none";
    });
    counter.textContent = `${active + 1} / ${items.length}`;

    const activeEl = els[active];
    if (activeEl && activeEl !== lastActiveEl) {
      lastActiveEl = activeEl;
      if (!firstLayout) {
        activeEl.classList.remove("pop-in");
        void activeEl.offsetWidth; // รีสตาร์ท animation
        activeEl.classList.add("pop-in");
        activeEl.addEventListener("animationend", () => activeEl.classList.remove("pop-in"), { once: true });
      }
    }
    firstLayout = false;
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  });

  function goTo(i) {
    active = Math.max(0, Math.min(items.length - 1, i));
    layout();
  }

  track.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".coverflow-item");
    if (!btn) return;
    const i = Number(btn.dataset.i);
    if (i === active) {
      openModal(i);
    } else {
      goTo(i);
    }
  });

  document.getElementById("coverflowPrev").addEventListener("click", () => goTo(active - 1));
  document.getElementById("coverflowNext").addEventListener("click", () => goTo(active + 1));

  /* ---------- สวมนิ้วลาก (มือถือ/แทร็กแพด) ---------- */
  let dragStartX = null;
  let dragMoved = false;
  track.addEventListener("pointerdown", (ev) => {
    dragStartX = ev.clientX;
    dragMoved = false;
  });
  track.addEventListener("pointermove", (ev) => {
    if (dragStartX === null) return;
    if (Math.abs(ev.clientX - dragStartX) > 8) dragMoved = true;
  });
  track.addEventListener("pointerup", (ev) => {
    if (dragStartX === null) return;
    const dx = ev.clientX - dragStartX;
    dragStartX = null;
    if (Math.abs(dx) > 40) {
      dx < 0 ? goTo(active + 1) : goTo(active - 1);
    }
  });
  // กันไม่ให้ลากแล้วดันไปเปิด modal โดยไม่ตั้งใจ
  track.addEventListener("click", (ev) => { if (dragMoved) ev.stopPropagation(); }, true);

  /* ---------- คีย์บอร์ด ---------- */
  section.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowLeft") goTo(active - 1);
    if (ev.key === "ArrowRight") goTo(active + 1);
  });

  /* ---------- Modal ซูมเต็มจอ ---------- */
  function openModal(i) {
    active = i;
    layout();
    const it = items[i];
    modalImg.src = it.image;
    modalImg.alt = it.title;
    modalTitle.textContent = it.title;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function modalShow(i) {
    active = Math.max(0, Math.min(items.length - 1, i));
    layout();
    const it = items[active];
    modalImg.src = it.image;
    modalImg.alt = it.title;
    modalTitle.textContent = it.title;
  }

  document.getElementById("coverflowModalClose").addEventListener("click", closeModal);
  document.getElementById("coverflowModalPrev").addEventListener("click", () => modalShow(active - 1));
  document.getElementById("coverflowModalNext").addEventListener("click", () => modalShow(active + 1));
  modal.addEventListener("click", (ev) => { if (ev.target === modal) closeModal(); });
  document.addEventListener("keydown", (ev) => {
    if (modal.hidden) return;
    if (ev.key === "Escape") closeModal();
    if (ev.key === "ArrowLeft") modalShow(active - 1);
    if (ev.key === "ArrowRight") modalShow(active + 1);
  });

  goTo(Math.floor(items.length / 2)); // เริ่มที่สไลด์กลางๆ ให้เห็นเอฟเฟกต์ 3D รอบด้านทันที
})();
