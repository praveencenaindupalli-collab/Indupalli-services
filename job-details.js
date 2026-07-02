import { db } from "./firebase.js";

import {
doc,
getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================
// GET JOB ID
// =========================

const params = new URLSearchParams(window.location.search);

const jobId = params.get("id");

if (!jobId) {

    alert("Job not found.");

    window.location.href = "jobs.html";

}

// =========================
// LOAD JOB
// =========================

async function loadJob() {

    try {

        const jobRef = doc(db, "jobs", jobId);

        const snapshot = await getDoc(jobRef);

        if (!snapshot.exists()) {

            document.getElementById("jobTitle").innerHTML =
                "Job Not Found";

            return;

        }

        const job = snapshot.data();

        document.getElementById("jobTitle").innerHTML =
            job.jobTitle || "";

        document.getElementById("companyName").innerHTML =
            job.companyName || "";

        document.getElementById("location").innerHTML =
            job.location || "";

        document.getElementById("salary").innerHTML =
            job.salary || "";

        document.getElementById("experience").innerHTML =
            job.experience || "";

        document.getElementById("notice").innerHTML =
            job.notice || "";

        document.getElementById("description").innerHTML =
            job.description || "";

        document.getElementById("recruiterName").innerHTML =
            job.recruiterName || "Indupalli Services";

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

}

loadJob();
// =========================
// APPLY BUTTON
// =========================

const applyBtn = document.getElementById("applyNowBtn");

if (applyBtn) {

    applyBtn.addEventListener("click", function (e) {

        e.preventDefault();

        window.location.href = `apply.html?jobId=${jobId}`;

    });

}