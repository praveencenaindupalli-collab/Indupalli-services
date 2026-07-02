// ============================================================
// INDUPALLI SERVICES ATS — Centralized Firebase Module
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, collection, doc, updateDoc, onSnapshot, query, orderBy, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJWdsNykkCp9tJfoBiZNoVfWT0orM6BHA",
  authDomain: "indupalli-services-18404.firebaseapp.com",
  projectId: "indupalli-services-18404",
  storageBucket: "indupalli-services-18404.firebasestorage.app",
  messagingSenderId: "187485195719",
  appId: "1:187485195719:web:a2f422b12c47ea2d549de2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

// Global window access configurations for cross-module component sync
window.db = db;
window.auth = auth;
window.collection = collection;
window.onSnapshot = onSnapshot;

// Recruiter Dashboard Pipeline Status Updates
window.updateAppStatus = async function(docId, newStatus) {
    try {
        const appRef = doc(db, "jobApplications", docId);
        await updateDoc(appRef, { status: newStatus });
        console.log(`Application status updated successfully to: ${newStatus}`);
    } catch (e) {
        console.error("Failed to update execution pipeline state: ", e);
    }
};

// Global Listener for Recruiter Feed Tracking
window.loadApplicationsForRecruiter = function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const q = query(collection(db, "jobApplications"), orderBy("createdAt", "desc"));
    
    return onSnapshot(q, (snapshot) => {
        container.innerHTML = "";
        if (snapshot.empty) {
            container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No submissions filed.</td></tr>`;
            return;
        }

        snapshot.forEach((d) => {
            const a = d.data();
            const isPremium = a.premiumUser === true;
            
            // Assign high visual prominence configurations to premium records
            const rowBgStyle = isPremium ? 'style="background-color: #fffbeb; border-left: 4px solid #ff9800;"' : '';
            const premiumBadge = isPremium ? '<span style="background:#fff3cd; color:#b45309; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:800; margin-left:6px; border:1px solid #fde68a;">👑 PREMIUM PRIORITY</span>' : '';

            let color = "#64748b";
            if (a.status === "Selected") color = "#00b86b";
            if (a.status === "Interview Scheduled") color = "#0056d2";
            if (a.status === "Rejected") color = "#ef4444";
            if (a.status === "Under Review") color = "#ff9800";

            container.innerHTML += `
              <tr ${rowBgStyle}>
                <td><strong>${a.jobTitle || "Corporate Opening"}</strong></td>
                <td>${a.fullname || "Anonymous Candidate"} ${premiumBadge}</td>
                <td>${a.email || "N/A"}</td>
                <td>
                  <span style="background:${color}15; color:${color}; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">
                    ${a.status || "New Application"}
                  </span>
                </td>
                <td>
                  <select onchange="window.updateAppStatus('${d.id}', this.value)" style="padding:6px 10px; border:1px solid #e5e7eb; border-radius:6px; font-size:12px; cursor:pointer;">
                    ${["New Application", "Under Review", "Interview Scheduled", "Selected", "Rejected"]
                      .map(s => `<option ${a.status === s ? "selected" : ""}>${s}</option>`).join("")}
                  </select>
                </td>
                <td>
                  <button onclick="window.initializeChatRoom('${d.id}', '${(a.fullname || "Candidate").replace(/'/g, "\\'")}', 'recruiter')" style="background:#0056d2; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                    <i class="fa-solid fa-comments"></i> Chat
                  </button>
                </td>
              </tr>`;
        });
    });
};
