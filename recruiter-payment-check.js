/* ==========================================================
   INDUPALLI SERVICES — Recruiter Payment Gate Hook
   Runs on recruiter-dashboard.html. Waits for window.auth/db
   (set by firebase.js) then checks payment status.
========================================================== */

import { initPaymentGate } from "./payment-gate.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, query, where, getDocs, doc, updateDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_EMAIL = "praveencenaindupalli@gmail.com";

function waitForFirebase(retries = 20) {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (window.auth && window.db) {
        resolve();
      } else if (retries <= 0) {
        reject(new Error("Firebase not initialized in time"));
      } else {
        retries--;
        setTimeout(check, 150);
      }
    };
    check();
  });
}

waitForFirebase().then(() => {
  onAuthStateChanged(window.auth, (user) => {
    if (!user) return; // firebase.js already redirects to login

    // Admin always has full access — no paywall, sees approval panel
    if (user.email === ADMIN_EMAIL) {
      showAdminPaymentPanel();
      return;
    }

    // Regular recruiter — check payment status, gate the dashboard
    initPaymentGate(window.db, user, "recruiter", () => {
      // Access confirmed — dashboard.js's own DOMContentLoaded
      // listener already called loadJobs()/loadApplications(),
      // nothing else needed here.
    });
  });
}).catch((e) => {
  console.error("Payment gate could not start:", e);
});

/* ── Admin: Payment Requests Approval Panel ─────────────────── */
async function showAdminPaymentPanel() {
  const panel = document.getElementById("paymentRequestsPanel");
  if (panel) panel.style.display = "block";

  await loadPaymentRequests();
}

async function loadPaymentRequests() {
  const container = document.getElementById("paymentRequestsContainer");
  const countBadge = document.getElementById("pendingRequestCount");
  if (!container) return;

  try {
    const snap = await getDocs(query(
      collection(window.db, "paymentRequests"),
      where("status", "==", "pending")
    ));

    const requests = [];
    snap.forEach(d => requests.push({ id: d.id, ...d.data() }));

    if (countBadge) countBadge.textContent = `${requests.length} pending`;

    if (!requests.length) {
      container.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8;">No pending payment requests 🎉</td></tr>`;
      return;
    }

    container.innerHTML = requests.map(r => {
      const requestedDate = r.requestedAt?.toDate
        ? r.requestedAt.toDate().toLocaleDateString("en-IN")
        : "—";
      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:12px;font-size:13px;">${r.email}</td>
          <td style="padding:12px;font-size:13px;text-transform:capitalize;">${r.role}</td>
          <td style="padding:12px;font-size:13px;font-weight:700;">₹${r.amount}</td>
          <td style="padding:12px;font-size:12px;color:#64748b;">${requestedDate}</td>
          <td style="padding:12px;">
            <button data-id="${r.id}" data-uid="${r.userId}" data-role="${r.role}" class="approveBtn"
              style="background:#16a34a;color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-right:6px;">
              ✅ Approve
            </button>
            <button data-id="${r.id}" class="rejectBtn"
              style="background:#ef4444;color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
              ❌ Reject
            </button>
          </td>
        </tr>`;
    }).join("");

    container.querySelectorAll(".approveBtn").forEach(btn => {
      btn.addEventListener("click", () => approveRequest(btn.dataset.id, btn.dataset.uid, btn.dataset.role));
    });
    container.querySelectorAll(".rejectBtn").forEach(btn => {
      btn.addEventListener("click", () => rejectRequest(btn.dataset.id));
    });

  } catch (e) {
    container.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#ef4444;">Error loading requests: ${e.message}</td></tr>`;
  }
}

async function approveRequest(requestId, userId, role) {
  try {
    await updateDoc(doc(window.db, "paymentRequests", requestId), {
      status: "approved",
      approvedAt: serverTimestamp()
    });

    const collectionName = role === "recruiter" ? "recruiters" : "candidates";
    await setDoc(doc(window.db, collectionName, userId), {
      isPaid: true,
      paymentStatus: "approved",
      approvedAt: serverTimestamp()
    }, { merge: true });

    await loadPaymentRequests();
  } catch (e) {
    alert("Could not approve: " + e.message);
  }
}

async function rejectRequest(requestId) {
  if (!confirm("Reject this payment request?")) return;
  try {
    await updateDoc(doc(window.db, "paymentRequests", requestId), {
      status: "rejected",
      rejectedAt: serverTimestamp()
    });
    await loadPaymentRequests();
  } catch (e) {
    alert("Could not reject: " + e.message);
  }
}