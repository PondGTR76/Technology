/* ============================================================
   auth.js — Firebase Authentication (Google Sign-in)
   - ดึงรูป/ชื่ออัตโนมัติ
   - แก้ Display Name ได้
   - ส่ง idToken ให้ Backend ตรวจสอบตัวตน (ปลอดภัย)
   ============================================================ */

let currentUser = null; // ให้ไฟล์อื่นอ่าน state ผู้ใช้ปัจจุบันได้

(function initAuth() {
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
    }
  }

  // ปุ่มล็อกอินบนหน้าจอกั้น
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.id === "btnGateLogin") login();
  });

  function renderAuthArea(user) {
    if (!authArea) return;

    if (!user) {
      authArea.innerHTML = `<button class="btn btn-primary" id="btnLogin">เข้าสู่ระบบด้วย Google</button>`;
      document.getElementById("btnLogin").addEventListener("click", login);
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
