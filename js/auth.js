/* ============================================================
   auth.js — Firebase Authentication (Google Sign-in)
   - ดึงรูป/ชื่ออัตโนมัติ
   - แก้ Display Name ได้
   - ส่ง idToken ให้ Backend ตรวจสอบตัวตน (ปลอดภัย)
   ============================================================ */

let currentUser = null; // ให้ไฟล์อื่นอ่าน state ผู้ใช้ปัจจุบันได้

/** ตรวจว่าเปิดผ่าน In-App Browser ของแอปแชท (LINE/Facebook/Instagram) หรือไม่
 *  Google บล็อกการ Login OAuth ใน WebView เหล่านี้โดยนโยบาย จะขึ้น "เบราว์เซอร์นี้อาจไม่ปลอดภัย" เสมอ
 *  ทางแก้เดียวคือให้ผู้ใช้เปิดลิงก์ในเบราว์เซอร์จริง (Chrome/Safari) แทน */
function detectInAppBrowser() {
  const ua = navigator.userAgent || "";
  if (/\bLine\//i.test(ua)) return "line";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/MicroMessenger/i.test(ua)) return "wechat";
  return null;
}
const IN_APP_BROWSER = detectInAppBrowser();

/** พยายามเปิดหน้าปัจจุบันในเบราว์เซอร์ระบบ (ได้ผลกับ LINE) หรือแนะนำวิธีเปิดเอง (แอปอื่น) */
function openInExternalBrowser() {
  if (IN_APP_BROWSER === "line") {
    const url = new URL(location.href);
    url.searchParams.set("openExternalBrowser", "1");
    location.href = url.toString();
    return;
  }
  showToast("แตะเมนู ⋯ มุมขวาบน แล้วเลือก “เปิดในเบราว์เซอร์” เพื่อเข้าสู่ระบบด้วย Google");
}

(function initAuth() {
  // ปรับปุ่มบนการ์ดล็อกอินให้ถูกต้องตั้งแต่โหลดหน้าแรก (ไม่ต้องรอ Firebase resolve)
  if (IN_APP_BROWSER) {
    const btn = document.getElementById("btnGateLogin");
    const warn = document.getElementById("authGateWarn");
    if (btn) btn.textContent = "เปิดในเบราว์เซอร์เพื่อเข้าสู่ระบบ";
    if (warn) warn.hidden = false;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
  } catch (e) {
    console.warn("Firebase ยังไม่ได้ตั้งค่า:", e.message);
    return;
  }

  const auth = firebase.auth();
  const authArea = document.getElementById("authArea");

  auth.onAuthStateChanged((user) => {
    currentUser = user;
    renderAuthArea(user);
    applyAuthGate(user);
    // แจ้งหน้าอื่น (เช่น detail.js) ว่า auth เปลี่ยน
    document.dispatchEvent(new CustomEvent("auth:changed", { detail: user }));
  });

  /** บังคับล็อกอินก่อนเห็นเนื้อหา: สลับการแสดงผล authGate <-> gated-content */
  function applyAuthGate(user) {
    const gate = document.getElementById("authGate");
    const content = document.querySelector(".gated-content");
    if (!gate || !content) return; // หน้านี้ไม่มีระบบกั้น (เช่น preview.html)

    if (user) {
      gate.hidden = true;
      content.hidden = false;
    } else {
      gate.hidden = false;
      content.hidden = true;
      updateGateLoginButton();
    }
  }

  /** ปรับปุ่ม/ข้อความบนการ์ดล็อกอิน เมื่อตรวจพบว่าเปิดผ่านแอปแชท */
  function updateGateLoginButton() {
    const btn = document.getElementById("btnGateLogin");
    const warn = document.getElementById("authGateWarn");
    if (!btn) return;
    if (IN_APP_BROWSER) {
      btn.textContent = "เปิดในเบราว์เซอร์เพื่อเข้าสู่ระบบ";
      if (warn) warn.hidden = false;
    } else {
      btn.textContent = "เข้าสู่ระบบด้วย Google";
      if (warn) warn.hidden = true;
    }
  }

  // ปุ่มล็อกอินบนหน้าจอกั้น
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.id === "btnGateLogin") {
      IN_APP_BROWSER ? openInExternalBrowser() : login();
    }
  });

  function renderAuthArea(user) {
    if (!authArea) return;

    if (!user) {
      const label = IN_APP_BROWSER ? "เปิดในเบราว์เซอร์เพื่อเข้าสู่ระบบ" : "เข้าสู่ระบบด้วย Google";
      authArea.innerHTML = `<button class="btn btn-primary" id="btnLogin">${label}</button>`;
      document.getElementById("btnLogin").addEventListener("click", () => {
        IN_APP_BROWSER ? openInExternalBrowser() : login();
      });
      return;
    }

    authArea.innerHTML = `
      <div class="user-chip">
        <img src="${esc(user.photoURL || "")}" alt="" referrerpolicy="no-referrer"
             onerror="this.style.display='none'">
        <span>${esc(user.displayName || "ผู้ใช้")}</span>
      </div>
      <button class="btn btn-ghost" id="btnEditName" title="แก้ไขชื่อที่แสดง">✎</button>
      <button class="btn" id="btnLogout">ออกจากระบบ</button>
    `;
    document.getElementById("btnLogout").addEventListener("click", () => auth.signOut());
    document.getElementById("btnEditName").addEventListener("click", editDisplayName);
  }

  function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((e) => {
      console.error(e);
      showToast("เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง");
    });
  }

  async function editDisplayName() {
    const user = auth.currentUser;
    if (!user) return;
    const name = prompt("ชื่อที่ต้องการแสดงในคอมเมนต์:", user.displayName || "");
    if (name === null) return;
    const clean = name.trim().slice(0, 40);
    if (!clean) return showToast("ชื่อต้องไม่ว่าง");
    try {
      await user.updateProfile({ displayName: clean });
      currentUser = auth.currentUser;
      renderAuthArea(currentUser);
      document.dispatchEvent(new CustomEvent("auth:changed", { detail: currentUser }));
      showToast("บันทึกชื่อใหม่แล้ว");
    } catch (e) {
      console.error(e);
      showToast("บันทึกชื่อไม่สำเร็จ");
    }
  }
})();

/** ดึง Firebase ID Token สำหรับส่งให้ GAS ตรวจสอบตัวตน */
async function getIdToken() {
  if (!currentUser) return null;
  return currentUser.getIdToken(/* forceRefresh */ false);
}
