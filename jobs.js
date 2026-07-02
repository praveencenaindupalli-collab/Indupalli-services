import { db } from "./firebase.js";

import {
collection,
query,
orderBy,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const jobsContainer = document.getElementById("jobsContainer");
const searchInput = document.getElementById("jobSearch");

let allJobs = [];

/* ---------------------------
LOAD JOBS
----------------------------*/

const q = query(
    collection(db,"jobs"),
    orderBy("createdAt","desc")
);

onSnapshot(q,(snapshot)=>{

    allJobs=[];

    snapshot.forEach(doc=>{

        allJobs.push({
            id:doc.id,
            ...doc.data()
        });

    });

    renderJobs(allJobs);

});


/* ---------------------------
SEARCH
----------------------------*/

searchInput.addEventListener("input",()=>{

    const keyword=searchInput.value.toLowerCase();

    const filtered=allJobs.filter(job=>

        (job.jobTitle||"").toLowerCase().includes(keyword) ||

        (job.location||"").toLowerCase().includes(keyword) ||

        (job.companyName||"").toLowerCase().includes(keyword)

    );

    renderJobs(filtered);

});


/* ---------------------------
RENDER
----------------------------*/

function renderJobs(jobs){

    if(!jobsContainer) return;

    if(jobs.length===0){

        jobsContainer.innerHTML=`

        <div class="loading">

            <h2>No Jobs Available</h2>

        </div>

        `;

        return;

    }

    jobsContainer.innerHTML="";

    jobs.forEach(job=>{

        const shortDescription=(job.description||"")
        .substring(0,180);

        jobsContainer.innerHTML+=`

<div class="job-card">

<h3>${job.jobTitle||"Untitled Job"}</h3>

<div class="company">

${job.companyName||"Indupalli Services"}

</div>

<div class="meta">

<span>📍 ${job.location||"India"}</span>

<span>💼 ${job.jobType||"Full Time"}</span>

<span>💰 ${job.salary||"Negotiable"}</span>

</div>

<div class="description">

${shortDescription}...

</div>

<div class="actions">

<a class="read-more"
href="job-details.html?id=${job.id}">

Read More →

</a>

<button
class="apply-btn"
onclick="window.location='login.html'">

Apply Now

</button>

</div>

</div>

`;

    });

}