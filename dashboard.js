/* ==========================================================
   INDUPALLI SERVICES ATS
   Dashboard.js
   PART 1
========================================================== */

import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ==========================================================
// Global Variables
// ==========================================================

const jobsRef = collection(db, "jobs");
const applicationsRef = collection(db, "jobApplications");
const paymentRef = collection(db, "paymentRequests");
const notificationRef = collection(db, "notifications");


// ==========================================================
// Dashboard Initialization
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {

    initializeDashboard();

});


// ==========================================================
// Main Loader
// ==========================================================

function initializeDashboard() {

    checkRecruiterSession();

    startClock();

    initializeSearch();

    initializeLogout();

    initializeNotificationListener();

    loadDashboardCounts();

    loadJobs();

    loadApplications();

    loadPayments();

}


// ==========================================================
// Recruiter Session
// ==========================================================

function checkRecruiterSession() {

    const email = localStorage.getItem("recruiterEmail");

    const role = localStorage.getItem("userRole");

    const isAdmin = localStorage.getItem("isAdmin");

    if (!email) {

        window.location.href = "recruiter-login.html";

        return;

    }

    const recruiterName = email
        .split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase());

    document.getElementById("displayRecruiterName").textContent =
        recruiterName;

    document.getElementById("displayRecruiterEmail").textContent =
        email;

    document.getElementById("displayAvatar").textContent =
        recruiterName.charAt(0);

    const badge = document.getElementById("displayRoleBadge");

    if (isAdmin === "true") {

        badge.innerHTML = "Administrator";

        badge.style.background = "#dc2626";

    } else {

        badge.innerHTML = "Recruiter";

        badge.style.background = "#10b981";

    }

}


// ==========================================================
// Live Clock
// ==========================================================

function startClock() {

    updateClock();

    setInterval(updateClock, 1000);

}

function updateClock() {

    const clock = document.getElementById("liveClock");

    if (!clock) return;

    clock.innerHTML =
        new Date().toLocaleTimeString("en-IN", {

            hour: "2-digit",

            minute: "2-digit",

            second: "2-digit",

            hour12: true

        }) + " IST";

}


// ==========================================================
// Logout
// ==========================================================

function initializeLogout() {

    const btn = document.getElementById("sidebarLogoutBtn");

    if (!btn) return;

    btn.onclick = () => {

        if (confirm("Logout from Recruiter Dashboard?")) {

            localStorage.clear();

            location.href = "recruiter-login.html";

        }

    };

}


// ==========================================================
// Search
// ==========================================================

function initializeSearch() {

    const search =
        document.querySelector(".search-box input");

    if (!search) return;

    search.addEventListener("keyup", function () {

        const keyword =
            this.value.toLowerCase();

        document
            .querySelectorAll(".dashboard-table tbody tr")
            .forEach(row => {

                row.style.display =
                    row.innerText
                        .toLowerCase()
                        .includes(keyword)
                        ? ""
                        : "none";

            });

    });

}


console.log("✅ Dashboard Part 1 Loaded");
/* ==========================================================
   PART 2
   Toasts • Confirm Dialog • Dashboard KPIs • Notifications
========================================================== */


// ==========================================================
// Toast Notification
// ==========================================================

window.showToast = function (message, type = "success") {

    const old = document.getElementById("__toast");

    if (old) old.remove();

    const colors = {
        success: "#10b981",
        error: "#ef4444",
        warning: "#f59e0b",
        info: "#2563eb"
    };

    const toast = document.createElement("div");

    toast.id = "__toast";

    toast.style.cssText = `
position:fixed;
right:20px;
bottom:20px;
background:${colors[type]};
color:white;
padding:14px 20px;
border-radius:10px;
font-weight:600;
font-size:14px;
z-index:999999;
box-shadow:0 8px 20px rgba(0,0,0,.25);
`;

    toast.innerHTML = message;

    document.body.appendChild(toast);

    setTimeout(() => {

        toast.remove();

    }, 3000);

};



// ==========================================================
// Confirm Dialog
// ==========================================================

window.showConfirm = function (

title,

message,

callback

) {

    if (confirm(title + "\n\n" + message)) {

        callback();

    }

};



// ==========================================================
// Dashboard Counters
// ==========================================================

async function loadDashboardCounts() {

    try {

        const jobs = await getDocs(jobsRef);

        const apps = await getDocs(applicationsRef);

        const jobsCard =
            document.getElementById("kpiTotalJobs");

        const appsCard =
            document.getElementById("kpiTotalApps");

        if (jobsCard)

            jobsCard.innerHTML = jobs.size;

        if (appsCard)

            appsCard.innerHTML = apps.size;

    }

    catch (e) {

        console.error(e);

    }

}



// ==========================================================
// Notification Listener
// ==========================================================

function initializeNotificationListener() {

    onSnapshot(notificationRef, snapshot => {

        let unread = 0;

        snapshot.forEach(doc => {

            if (!doc.data().read)

                unread++;

        });

        const badge =
            document.getElementById("notificationCount");

        if (!badge) return;

        badge.innerHTML = unread;

        badge.style.display =
            unread > 0
                ? "inline-block"
                : "none";

        if (unread > 0) {

            document.title =
                "(" + unread + ") Recruiter Dashboard";

        }

        else {

            document.title =
                "Recruiter Dashboard";

        }

    });

}



// ==========================================================
// Refresh Dashboard
// ==========================================================

window.refreshDashboard = function () {

    loadDashboardCounts();

    loadJobs();

    loadApplications();

    loadPayments();

};



console.log("✅ Dashboard Part 2 Loaded");
/* ==========================================================
   PART 3
   POST JOB TO FIRESTORE
========================================================== */

window.postJobFromForm = async function () {

    try {

        const jobTitle = document.getElementById("jobTitle").value.trim();
        const companyName = document.getElementById("companyName").value.trim();
        const location = document.getElementById("location").value.trim();
        const salary = document.getElementById("salary").value.trim();
        const experience = document.getElementById("experience").value.trim();
        const notice = document.getElementById("maxNotice").value;
        const description = document.getElementById("jobDescription").value.trim();

        if (
            !jobTitle ||
            !companyName ||
            !location ||
            !salary ||
            !experience ||
            !description
        ) {

            showToast("Please fill all required fields.", "error");

            return;

        }

        const recruiterEmail =
            localStorage.getItem("recruiterEmail") || "";

        const recruiterName =
            localStorage.getItem("recruiterName") || "";

        await addDoc(jobsRef, {

            jobTitle,
            companyName,
            location,
            salary,
            experience,
            notice,

            description,

            recruiterEmail,
            recruiterName,

            status: "Open",

            applicants: 0,

            createdAt: serverTimestamp()

        });

        showToast("✅ Job Posted Successfully");

        document.getElementById("jobForm").reset();

        loadJobs();

        loadDashboardCounts();

    }

    catch (error) {

        console.error(error);

        showToast(error.message, "error");

    }

};



// ==========================================================
// FORM SUBMIT
// ==========================================================

const form = document.getElementById("jobForm");

if (form) {

    form.addEventListener("submit", function (e) {

        e.preventDefault();

        window.postJobFromForm();

    });

}

console.log("✅ Dashboard Part 3 Loaded");
/* ==========================================================
   PART 4
   LIVE JOBS TABLE
========================================================== */

function loadJobs() {

    const jobsContainer =
        document.getElementById("jobsContainer");

    if (!jobsContainer) return;

    onSnapshot(

        query(jobsRef, orderBy("createdAt", "desc")),

        (snapshot) => {

            jobsContainer.innerHTML = "";

            if (snapshot.empty) {

                jobsContainer.innerHTML = `
<tr>
<td colspan="5"
style="text-align:center;padding:20px;color:#64748b;">
No jobs found.
</td>
</tr>`;

                return;

            }

            snapshot.forEach((docSnap) => {

                const job = docSnap.data();

                jobsContainer.innerHTML += `

<tr>

<td>

<strong>${job.jobTitle}</strong>

</td>

<td>

${job.location}

</td>

<td>

${job.experience}

</td>

<td>

${job.salary}

</td>

<td>

<button
onclick="editJob('${docSnap.id}')"
style="
background:#2563eb;
color:#fff;
border:none;
padding:6px 10px;
border-radius:6px;
cursor:pointer;
margin-right:5px;">

Edit

</button>

<button
onclick="deleteJob('${docSnap.id}')"
style="
background:#ef4444;
color:#fff;
border:none;
padding:6px 10px;
border-radius:6px;
cursor:pointer;">

Delete

</button>

</td>

</tr>

`;

            });

        }

    );

}

console.log("✅ Dashboard Part 4 Loaded");
/* ==========================================================
   PART 5
   EDIT & DELETE JOB
========================================================== */

window.deleteJob = async function (jobId) {

    showConfirm(

        "Delete Job",

        "Are you sure you want to delete this job?",

        async () => {

            try {

                await deleteDoc(doc(db, "jobs", jobId));

                showToast("🗑️ Job deleted successfully");

                loadDashboardCounts();

            }

            catch (error) {

                console.error(error);

                showToast(error.message, "error");

            }

        }

    );

};



window.editJob = async function (jobId) {

    try {

        const snapshot = await getDoc(
            doc(db, "jobs", jobId)
        );

        if (!snapshot.exists()) {

            showToast("Job not found", "error");

            return;

        }

        const job = snapshot.data();

        document.getElementById("jobTitle").value =
            job.jobTitle || "";

        document.getElementById("companyName").value =
            job.companyName || "";

        document.getElementById("location").value =
            job.location || "";

        document.getElementById("salary").value =
            job.salary || "";

        document.getElementById("experience").value =
            job.experience || "";

        document.getElementById("maxNotice").value =
            job.notice || "Immediate / Serving";

        document.getElementById("jobDescription").value =
            job.description || "";

        const form = document.getElementById("jobForm");

        form.onsubmit = async function (e) {

            e.preventDefault();

            try {

                await updateDoc(
                    doc(db, "jobs", jobId),
                    {

                        jobTitle:
                        document.getElementById("jobTitle").value,

                        companyName:
                        document.getElementById("companyName").value,

                        location:
                        document.getElementById("location").value,

                        salary:
                        document.getElementById("salary").value,

                        experience:
                        document.getElementById("experience").value,

                        notice:
                        document.getElementById("maxNotice").value,

                        description:
                        document.getElementById("jobDescription").value

                    }
                );

                showToast("✅ Job Updated Successfully");

                form.reset();

                form.onsubmit = null;

                loadJobs();

                loadDashboardCounts();

            }

            catch (error) {

                console.error(error);

                showToast(error.message, "error");

            }

        };

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }

    catch (error) {

        console.error(error);

        showToast(error.message, "error");

    }

};

console.log("✅ Dashboard Part 5 Loaded");
/* ==========================================================
   PART 6
   DASHBOARD KPIs + LIVE CANDIDATE TABLE
========================================================== */

function loadApplications() {

    const container =
        document.getElementById("appsContainer");

    if (!container) return;

    onSnapshot(

        query(applicationsRef, orderBy("createdAt", "desc")),

        (snapshot) => {

            container.innerHTML = "";

            document.getElementById("kpiTotalApps").innerHTML =
                snapshot.size;

            if (snapshot.empty) {

                container.innerHTML = `
<tr>
<td colspan="5"
style="text-align:center;padding:20px;color:#64748b;">
No Applications Found
</td>
</tr>`;

                return;

            }

            snapshot.forEach((docSnap) => {

                const app = docSnap.data();

                container.innerHTML += `

<tr>

<td>

${app.jobTitle || "-"}

</td>

<td>

<strong>${app.fullname || "Candidate"}</strong>

</td>

<td>

${app.source || "Portal"}

</td>

<td>

${app.noticePeriod || "N/A"}

</td>

<td>

<button
style="
background:#2563eb;
color:white;
border:none;
padding:6px 10px;
border-radius:6px;
cursor:pointer;"
onclick="window.initializeChatRoom('${docSnap.id}','${app.fullname}','recruiter')">

Chat

</button>

</td>

</tr>

`;

            });

        }

    );

}



// ==========================================================
// Dashboard KPIs
// ==========================================================

async function refreshDashboardKPIs() {

    try {

        const jobs = await getDocs(jobsRef);

        const apps = await getDocs(applicationsRef);

        document.getElementById("kpiTotalJobs").innerHTML =
            jobs.size;

        document.getElementById("kpiTotalApps").innerHTML =
            apps.size;

    }

    catch (e) {

        console.error(e);

    }

}



// ==========================================================
// Auto Refresh Every Minute
// ==========================================================

setInterval(() => {

    refreshDashboardKPIs();

}, 60000);



console.log("✅ Dashboard Part 6 Loaded");
/* ==========================================================
   PART 7
   PAYMENT REQUESTS
========================================================== */

const paymentRequestsRef =
    collection(db, "paymentRequests");

function loadPayments() {

    const table =
        document.getElementById("paymentRequestsContainer");

    const panel =
        document.getElementById("paymentRequestsPanel");

    if (!table) return;

    const isAdmin =
        localStorage.getItem("isAdmin") === "true";

    if (!isAdmin) {

        if (panel)
            panel.style.display = "none";

        return;

    }

    if (panel)
        panel.style.display = "block";

    onSnapshot(

        query(
            paymentRequestsRef,
            orderBy("requestedAt", "desc")
        ),

        (snapshot) => {

            table.innerHTML = "";

            document.getElementById(
                "pendingRequestCount"
            ).innerHTML =
                snapshot.size + " Pending";

            if (snapshot.empty) {

                table.innerHTML = `
<tr>
<td colspan="5"
style="padding:20px;text-align:center;">
No Payment Requests
</td>
</tr>`;

                return;

            }

            snapshot.forEach((docSnap) => {

                const pay = docSnap.data();

                table.innerHTML += `

<tr>

<td>${pay.email || "-"}</td>

<td>${pay.role || "-"}</td>

<td>₹${pay.amount || 0}</td>

<td>${pay.requestedAt || "-"}</td>

<td>

<button
onclick="approvePayment('${docSnap.id}')"
style="
background:#10b981;
color:white;
border:none;
padding:6px 12px;
border-radius:6px;
cursor:pointer;
margin-right:6px;">

Approve

</button>

<button
onclick="rejectPayment('${docSnap.id}')"
style="
background:#ef4444;
color:white;
border:none;
padding:6px 12px;
border-radius:6px;
cursor:pointer;">

Reject

</button>

</td>

</tr>

`;

            });

        }

    );

}



// ==========================================
// Approve
// ==========================================

window.approvePayment = async function(id){

    try{

        await updateDoc(

            doc(db,"paymentRequests",id),

            {

                status:"Approved",

                approvedAt:
                serverTimestamp()

            }

        );

        showToast(
            "Payment Approved"
        );

    }

    catch(e){

        console.error(e);

        showToast(
            e.message,
            "error"
        );

    }

};



// ==========================================
// Reject
// ==========================================

window.rejectPayment = async function(id){

    try{

        await updateDoc(

            doc(db,"paymentRequests",id),

            {

                status:"Rejected"

            }

        );

        showToast(
            "Payment Rejected",
            "warning"
        );

    }

    catch(e){

        console.error(e);

        showToast(
            e.message,
            "error"
        );

    }

};



console.log("✅ Dashboard Part 7 Loaded");
/* ==========================================================
   PART 8
   FINAL INITIALIZATION
========================================================== */


// ==========================================
// Live Notifications
// ==========================================

function loadNotifications() {

    onSnapshot(notificationRef, (snapshot) => {

        let unread = 0;

        snapshot.forEach((doc) => {

            const n = doc.data();

            if (!n.read)
                unread++;

        });

        const badge =
            document.getElementById("notificationCount");

        if (!badge) return;

        badge.innerHTML = unread;

        badge.style.display =
            unread > 0
                ? "inline-block"
                : "none";

    });

}



// ==========================================
// Simulate Candidate Apply
// ==========================================

window.simulateCandidateApply =
async function () {

    try {

        const jobs = await getDocs(jobsRef);

        if (jobs.empty) {

            showToast(
                "Please create a job first.",
                "warning"
            );

            return;

        }

        const firstJob =
            jobs.docs[0].data();

        await addDoc(applicationsRef, {

            fullname:
                "Demo Candidate",

            email:
                "candidate@test.com",

            source:
                "Naukri",

            noticePeriod:
                "Immediate",

            jobTitle:
                firstJob.jobTitle,

            status:
                "New Application",

            createdAt:
                serverTimestamp()

        });

        showToast(
            "Demo candidate added successfully."
        );

    }

    catch (e) {

        console.error(e);

        showToast(
            e.message,
            "error"
        );

    }

};



// ==========================================
// Refresh Dashboard
// ==========================================

window.refreshDashboard =
function () {

    refreshDashboardKPIs();

    loadJobs();

    loadApplications();

    loadPayments();

    loadNotifications();

};



// ==========================================
// Dashboard Ready
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        refreshDashboard();

        console.log(
            "✅ Indupalli ATS Dashboard Ready"
        );

    }
);