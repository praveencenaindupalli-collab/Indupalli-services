/* ==========================================================
   INDUPALLI SERVICES — Premium Access Gate
   Checks payment status, shows paywall, handles UPI request flow
   Usage: import and call initPaymentGate(role, onUnlocked)
========================================================== */

import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection, serverTimestamp,
  getDocs, query, where, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PRICING = {
  candidate: { amount: 49,  label: "Candidate Access" },
  recruiter: { amount: 299, label: "Recruiter Access" }
};

const UPI_ID = "praveencenaindupalli@axl";
const UPI_NAME = "Praveen Indupalli";
const ADMIN_EMAIL = "praveencenaindupalli@gmail.com";

/**
 * Main entry point.
 * @param {object} db - Firestore instance (already initialized)
 * @param {object} user - Firebase auth user object
 * @param {string} role - "candidate" or "recruiter"
 * @param {function} onUnlocked - callback to run once access is confirmed
 */
export async function initPaymentGate(db, user, role, onUnlocked) {
  // Admin always bypasses the paywall and sees the approval panel instead
  if (user.email === ADMIN_EMAIL) {
    onUnlocked();
    showAdminApprovalPanel(db);
    return;
  }

  const collectionName = role === "recruiter" ? "recruiters" : "candidates";

  try {
    const snap = await getDoc(doc(db, collectionName, user.uid));
    const data = snap.exists() ? snap.data() : {};

    if (data.isPaid === true) {
      // Already paid — unlock immediately
      onUnlocked();
      return;
    }

    // Check if there's a pending request already
    if (data.paymentStatus === "pending") {
      showPaywall(db, user, role, "pending");
    } else {
      showPaywall(db, user, role, "none");
    }
  } catch (e) {
    console.error("Payment gate check failed:", e);
    // Fail SAFE — if we can't verify payment status, show the paywall
    // rather than letting the user in. Prevents accidental free access
    // due to network errors or Firestore permission issues.
    showPaywall(db, user, role, "none");
  }
}

function showPaywall(db, user, role, status) {
  const pricing = PRICING[role] || PRICING.candidate;
  const upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${pricing.amount}&cu=INR&tn=${encodeURIComponent(pricing.label)}`;

  const overlay = document.createElement("div");
  overlay.id = "paymentGateOverlay";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:999999;
    background:linear-gradient(160deg,#001233,#001b70,#0038c8);
    display:flex;align-items:center;justify-content:center;
    font-family:'Poppins','Segoe UI',sans-serif;
    padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      background:#fff;border-radius:24px;padding:36px 32px;
      max-width:420px;width:100%;text-align:center;
      box-shadow:0 30px 80px rgba(0,0,0,.4);
    ">
      <div style="
        width:64px;height:64px;border-radius:50%;
        background:linear-gradient(135deg,#0056d2,#003ea8);
        display:flex;align-items:center;justify-content:center;
        margin:0 auto 18px;font-size:28px;
      ">🔒</div>

      <h2 style="font-size:22px;font-weight:800;color:#001233;margin-bottom:8px;">
        Premium Access Required
      </h2>
      <p style="font-size:14px;color:#777;line-height:1.6;margin-bottom:24px;">
        Unlock your ${role === "recruiter" ? "Recruiter" : "Candidate"} dashboard with a one-time payment.
      </p>

      <div style="
        background:#f0f4ff;border-radius:16px;padding:20px;margin-bottom:24px;
      ">
        <div style="font-size:13px;color:#888;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">
          ${pricing.label}
        </div>
        <div style="font-size:36px;font-weight:900;color:#0056d2;margin-top:6px;">
          ₹${pricing.amount}
        </div>
        <div style="font-size:12px;color:#aaa;margin-top:4px;">One-time payment</div>
      </div>

      <div id="paywallStatus">
        ${status === "pending" ? `
          <div style="
            background:#fff3e0;border:2px solid #ffe0b2;border-radius:14px;
            padding:16px;margin-bottom:18px;
          ">
            <div style="font-size:14px;font-weight:700;color:#ff7a00;">⏳ Request Pending</div>
            <p style="font-size:12px;color:#a36b00;margin-top:6px;line-height:1.5;">
              Your payment confirmation was submitted. Access will unlock once approved by our team (usually within a few hours).
            </p>
          </div>
        ` : `
          <a href="${upiLink}" style="
            display:flex;align-items:center;justify-content:center;gap:10px;
            padding:15px;background:linear-gradient(135deg,#0056d2,#003ea8);
            color:#fff;border-radius:12px;font-size:15px;font-weight:700;
            text-decoration:none;margin-bottom:12px;
            box-shadow:0 6px 20px rgba(0,86,210,.3);
          ">
            📲 Pay ₹${pricing.amount} via UPI
          </a>
          <button id="confirmPaidBtn" style="
            width:100%;padding:14px;background:#fff;color:#00b86b;
            border:2px solid #00b86b;border-radius:12px;
            font-size:14px;font-weight:700;cursor:pointer;
          ">
            ✅ I've Paid — Request Access
          </button>
        `}
      </div>

      <p style="font-size:11px;color:#bbb;margin-top:18px;line-height:1.6;">
        UPI ID: <strong style="color:#888;">${UPI_ID}</strong><br>
        After paying, tap "I've Paid" — our team verifies and unlocks access manually.
      </p>

      <button id="paywallLogoutBtn" style="
        margin-top:16px;background:none;border:none;
        color:#999;font-size:12px;text-decoration:underline;cursor:pointer;
      ">
        Logout instead
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const confirmBtn = document.getElementById("confirmPaidBtn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      confirmBtn.textContent = "⏳ Submitting...";
      confirmBtn.disabled = true;

      try {
        const collectionName = role === "recruiter" ? "recruiters" : "candidates";

        // Mark as pending on user profile
        await setDoc(doc(db, collectionName, user.uid), {
          paymentStatus: "pending",
          paymentRequestedAt: serverTimestamp(),
          email: user.email
        }, { merge: true });

        // Log the request for admin to review
        await addDoc(collection(db, "paymentRequests"), {
          userId: user.uid,
          email: user.email,
          role: role,
          amount: pricing.amount,
          status: "pending",
          requestedAt: serverTimestamp()
        });

        // Refresh paywall to show pending state
        document.getElementById("paymentGateOverlay").remove();
        showPaywall(db, user, role, "pending");
      } catch (e) {
        alert("Could not submit request: " + e.message);
        confirmBtn.textContent = "✅ I've Paid — Request Access";
        confirmBtn.disabled = false;
      }
    });
  }

  const logoutBtn = document.getElementById("paywallLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = role === "recruiter" ? "recruiter-login.html" : "login.html";
    });
  }
}

/* ════════════════════════════════════════════════════════════
   ADMIN APPROVAL PANEL
   Shown instead of the paywall when the logged-in user is the
   admin. Lets them review/approve/reject pending payment
   requests right from inside apply.html — no separate page.
════════════════════════════════════════════════════════════ */
function showAdminApprovalPanel(db) {
  // Floating toggle button — always visible to admin
  const fab = document.createElement("button");
  fab.id = "adminPaymentFab";
  fab.innerHTML = "💳";
  fab.title = "Payment Requests";
  fab.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:99998;
    width:56px;height:56px;border-radius:50%;border:none;
    background:linear-gradient(135deg,#0056d2,#003ea8);
    color:#fff;font-size:24px;cursor:pointer;
    box-shadow:0 8px 24px rgba(0,86,210,.4);
  `;
  document.body.appendChild(fab);

  fab.addEventListener("click", () => openAdminPanel(db));
}

async function openAdminPanel(db) {
  const existing = document.getElementById("adminPaymentPanel");
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement("div");
  overlay.id = "adminPaymentPanel";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:999999;
    background:rgba(0,18,51,.6);
    display:flex;align-items:center;justify-content:center;
    font-family:'Poppins','Segoe UI',sans-serif;padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      background:#fff;border-radius:22px;padding:28px;
      max-width:520px;width:100%;max-height:80vh;overflow-y:auto;
      box-shadow:0 30px 80px rgba(0,0,0,.4);
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <h2 style="font-size:19px;font-weight:800;color:#001233;">💳 Payment Requests</h2>
        <button id="closeAdminPanelBtn" style="
          background:#f0f4ff;border:none;width:32px;height:32px;border-radius:50%;
          font-size:16px;cursor:pointer;color:#555;
        ">✕</button>
      </div>
      <div id="adminRequestsList" style="display:flex;flex-direction:column;gap:12px;">
        <p style="text-align:center;color:#888;padding:20px;">Loading requests...</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById("closeAdminPanelBtn").addEventListener("click", () => overlay.remove());

  await loadPendingRequests(db);
}

async function loadPendingRequests(db) {
  const listEl = document.getElementById("adminRequestsList");
  if (!listEl) return;

  try {
    const snap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("status", "==", "pending")
    ));

    if (snap.empty) {
      listEl.innerHTML = `<p style="text-align:center;color:#888;padding:30px;">🎉 No pending requests right now.</p>`;
      return;
    }

    const requests = [];
    snap.forEach(d => requests.push({ id: d.id, ...d.data() }));

    listEl.innerHTML = requests.map(r => `
      <div style="
        background:#f8f9ff;border:1px solid #e0e8ff;border-radius:14px;
        padding:16px;display:flex;flex-direction:column;gap:10px;
      ">
        <div>
          <div style="font-weight:700;color:#001233;font-size:14px;">${r.email}</div>
          <div style="font-size:12px;color:#888;margin-top:2px;">
            ${r.role === "recruiter" ? "👔 Recruiter" : "🧑‍💼 Candidate"} · ₹${r.amount}
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="approveBtn" data-id="${r.id}" data-uid="${r.userId}" data-role="${r.role}" style="
            flex:1;padding:10px;background:#00b86b;color:#fff;border:none;
            border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;
          ">✅ Approve</button>
          <button class="rejectBtn" data-id="${r.id}" style="
            flex:1;padding:10px;background:#fff;color:#ef4444;border:2px solid #ef4444;
            border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;
          ">✕ Reject</button>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".approveBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.textContent = "⏳ Approving...";
        btn.disabled = true;
        try {
          await approveRequest(db, btn.dataset.id, btn.dataset.uid, btn.dataset.role);
          await loadPendingRequests(db);
        } catch (e) {
          alert("Could not approve: " + e.message);
        }
      });
    });

    listEl.querySelectorAll(".rejectBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.textContent = "⏳ Rejecting...";
        btn.disabled = true;
        try {
          await updateDoc(doc(db, "paymentRequests", btn.dataset.id), {
            status: "rejected",
            rejectedAt: serverTimestamp()
          });
          await loadPendingRequests(db);
        } catch (e) {
          alert("Could not reject: " + e.message);
        }
      });
    });

  } catch (e) {
    listEl.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;">Error loading requests: ${e.message}</p>`;
  }
}

async function approveRequest(db, requestId, userId, role) {
  const collectionName = role === "recruiter" ? "recruiters" : "candidates";

  await updateDoc(doc(db, "paymentRequests", requestId), {
    status: "approved",
    approvedAt: serverTimestamp()
  });

  await setDoc(doc(db, collectionName, userId), {
    isPaid: true,
    paymentStatus: "approved",
    approvedAt: serverTimestamp()
  }, { merge: true });
}