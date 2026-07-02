/* ==========================================================
   INDUPALLI SERVICES — Candidate Dashboard
   Self-contained: initializes its own Firebase
========================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, addDoc,
  doc, getDoc, setDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initPaymentGate } from "./payment-gate.js";

/* ── Init ──────────────────────────────────────────────── */
const app  = initializeApp({
  apiKey:"AIzaSyAJWdsNykkCp9tJfoBiZNoVfWT0orM6BHA",
  authDomain:"indupalli-services-18404.firebaseapp.com",
  projectId:"indupalli-services-18404",
  storageBucket:"indupalli-services-18404.firebasestorage.app",
  messagingSenderId:"187485195719",
  appId:"1:187485195719:web:a2f422b12c47ea2d549de2"
});
const auth = getAuth(app);
const db   = getFirestore(app);
window.db  = db;
window.auth= auth;

let currentUser = null;
let allJobs     = [];
let applyJobId  = "";
let applyJobTitle = "";

/* ═══════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  currentUser = user;

  const name  = user.displayName || user.email.split("@")[0];
  const init  = name.charAt(0).toUpperCase();
  const email = user.email;

  setEl("candidateName",  name);
  setEl("candidateEmail", email);

  // Avatar initial
  const sp = document.getElementById("avatarInitial");
  if (sp && !localStorage.getItem("userPhoto")) sp.textContent = init;

  setVal("candidateEmailAddress", email);
  setVal("applyEmail", email);

  // Load all data only after payment is confirmed
  initPaymentGate(db, user, "candidate", async () => {
    await loadProfile();
    loadJobs();
    loadApplications();
  });
});

/* ═══════════════════════════════════════════════════════════
   PROFILE
═══════════════════════════════════════════════════════════ */
async function loadProfile() {
  try {
    const snap = await getDoc(doc(db, "candidates", currentUser.uid));
    if (!snap.exists()) return;
    const p = snap.data();
    setVal("candidateFullName",   p.name       || "");
    setVal("candidatePhone",      p.phone      || "");
    setVal("candidateLocation",   p.location   || "");
    setVal("candidateExperience", p.experience || "");
    setVal("candidateSkills",     p.skills     || "");
    setVal("candidateAbout",      p.about      || "");
    setVal("applyName",       p.name       || "");
    setVal("applyPhone",      p.phone      || "");
    setVal("applyExperience", p.experience || "");
    if (p.name) {
      setEl("candidateName", p.name);
      const sp = document.getElementById("avatarInitial");
      if (sp && !localStorage.getItem("userPhoto") && !p.photoURL)
        sp.textContent = p.name.charAt(0).toUpperCase();
    }
    if (p.photoURL) {
      applyPhotoToUI(p.photoURL);
      localStorage.setItem("userPhoto", p.photoURL);
    }
  } catch(e) { console.warn("Profile:", e.message); }
}

window.saveProfile = async function() {
  if (!currentUser) return;
  const name = getVal("candidateFullName");
  if (!name) { toast("Enter your full name","error"); return; }
  try {
    await setDoc(doc(db,"candidates",currentUser.uid), {
      name,
      phone:      getVal("candidatePhone"),
      location:   getVal("candidateLocation"),
      experience: getVal("candidateExperience"),
      skills:     getVal("candidateSkills"),
      about:      getVal("candidateAbout"),
      email: currentUser.email,
      updatedAt: serverTimestamp()
    }, { merge:true });
    setEl("candidateName", name);
    const sp = document.getElementById("avatarInitial");
    if (sp && !localStorage.getItem("userPhoto")) sp.textContent = name.charAt(0).toUpperCase();
    setVal("applyName", name);
    setVal("applyPhone", getVal("candidatePhone"));
    setVal("applyExperience", getVal("candidateExperience"));
    toast("✅ Profile saved!","success");
  } catch(e){ toast("Error: "+e.message,"error"); }
};

/* ── Profile photo upload (persists in Firestore as base64) ── */
window.handlePhotoUpload = async function(event) {
  if (!currentUser) { toast("Please wait for login to finish","error"); return; }
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    toast("Please select an image file","error");
    return;
  }
  if (file.size > 800 * 1024) {
    toast("Photo too large — please choose one under 800KB","error");
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result;
    try {
      // Show immediately in UI
      applyPhotoToUI(base64);

      // Persist to Firestore so it survives across devices/sessions
      await setDoc(doc(db, "candidates", currentUser.uid), {
        photoURL: base64,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Also cache locally for instant load next time
      localStorage.setItem("userPhoto", base64);

      toast("✅ Photo updated!","success");
    } catch (e) {
      toast("Could not save photo: " + e.message, "error");
    }
  };
  reader.readAsDataURL(file);
};

function applyPhotoToUI(base64) {
  const photoBox = document.getElementById("candidatePhoto");
  const sp = document.getElementById("avatarInitial");
  if (!photoBox) return;
  if (sp) sp.style.display = "none";

  let img = photoBox.querySelector("img");
  if (!img) {
    img = document.createElement("img");
    img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
    photoBox.appendChild(img);
  }
  img.src = base64;
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS MODAL
   Name/Phone/Location are editable. Email is intentionally
   locked — it's tied to the Firebase Auth account and should
   not be changed from here.
═══════════════════════════════════════════════════════════ */
window.openSettings = function() {
  if (!currentUser) { toast("Please wait for login to finish","error"); return; }

  // Pre-fill from the candidate's current profile values
  setVal("stgName",     getVal("candidateFullName") || currentUser.displayName || "");
  setVal("stgPhone",    getVal("candidatePhone") || "");
  setVal("stgLocation", getVal("candidateLocation") || "");
  setVal("stgEmail",    currentUser.email || "");

  const modal = document.getElementById("settingsModal");
  if (modal) modal.style.display = "flex";
};

window.closeSettings = function() {
  const modal = document.getElementById("settingsModal");
  if (modal) modal.style.display = "none";
};

window.saveSettings = async function() {
  if (!currentUser) { toast("Please wait for login to finish","error"); return; }

  const name     = getVal("stgName");
  const phone    = getVal("stgPhone");
  const location = getVal("stgLocation");

  if (!name) { toast("Please enter your name","error"); return; }

  const saveBtn = document.querySelector('#settingsModal button[onclick="saveSettings()"]');
  if (saveBtn) { saveBtn.textContent = "⏳ Saving..."; saveBtn.disabled = true; }

  try {
    // Email is deliberately NOT included here — it stays tied to the auth account
    await setDoc(doc(db, "candidates", currentUser.uid), {
      name, phone, location,
      email: currentUser.email, // kept in sync but never editable from this form
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Reflect changes everywhere they're shown
    setEl("candidateName", name);
    setVal("candidateFullName", name);
    setVal("candidatePhone", phone);
    setVal("candidateLocation", location);
    setVal("applyName", name);
    setVal("applyPhone", phone);

    const sp = document.getElementById("avatarInitial");
    if (sp && sp.style.display !== "none") sp.textContent = name.charAt(0).toUpperCase();

    toast("✅ Settings saved!","success");
    window.closeSettings();
  } catch (e) {
    toast("Error: " + e.message, "error");
  } finally {
    if (saveBtn) { saveBtn.textContent = "💾 Save"; saveBtn.disabled = false; }
  }
};

/* ═══════════════════════════════════════════════════════════
   JOBS
═══════════════════════════════════════════════════════════ */
async function loadJobs() {
  const box = document.getElementById("jobsContainer");
  if (!box) return;
  box.innerHTML = `<div style="padding:30px;text-align:center;color:#888;">
    <div style="width:36px;height:36px;border:3px solid #e0e8ff;border-top-color:#0056d2;
      border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px;">
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    Loading jobs...
  </div>`;
  try {
    const snap = await getDocs(collection(db,"jobs"));
    allJobs = [];
    snap.forEach(d => { if (!d.data().isArchived) allJobs.push({id:d.id,...d.data()}); });
    renderJobs(allJobs);
  } catch(e) {
    box.innerHTML = `<div style="padding:30px;text-align:center;color:red;">
      ⚠️ Could not load jobs.<br>
      <button onclick="location.reload()" style="margin-top:12px;padding:10px 20px;background:#0056d2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">🔄 Retry</button>
    </div>`;
  }
}

function renderJobs(jobs) {
  const box = document.getElementById("jobsContainer");
  if (!box) return;
  if (!jobs.length) {
    box.innerHTML = `<div style="padding:40px;text-align:center;color:#888;">
      <div style="font-size:44px;margin-bottom:12px;">📭</div>
      <p style="font-size:15px;font-weight:600;">No jobs available right now.</p>
    </div>`;
    return;
  }
  box.innerHTML = jobs.map(j => `
    <div class="job-card">
      <div class="job-title">${j.jobTitle||j.title||"Untitled"}</div>
      <div class="job-company">🏢 ${j.companyName||j.company||"Indupalli Services"}</div>
      <div class="job-info">
        <span>📍 ${j.location||"N/A"}</span>
        <span>💼 ${j.experience||"N/A"}</span>
        <span>💰 ₹${j.salary||"N/A"}</span>
        <span>🕒 ${j.jobType||"Full Time"}</span>
      </div>
      <div class="job-description">${(j.description||"").substring(0,200)}${j.description?.length>200?"...":""}</div>
      <button class="apply-btn" data-jid="${j.id}" data-jtitle="${(j.jobTitle || "").replace(/"/g,"&quot;")}">
        🚀 Apply Now
      </button>
    </div>`).join("");

  // Attach click listeners AFTER rendering
  box.querySelectorAll(".apply-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      window.openApplyModal(this.dataset.jid, this.dataset.jtitle);
    });
  });
}

window.filterJobs = function() {
  const q = (document.getElementById("jobSearch")?.value||"").toLowerCase();
  const t = document.getElementById("jobFilter")?.value||"";
  renderJobs(allJobs.filter(j =>
    (!q||(j.jobTitle||j.title||"").toLowerCase().includes(q)||(j.location||"").toLowerCase().includes(q))&&
    (!t||(j.jobType||"Full Time")===t)
  ));
};

/* ═══════════════════════════════════════════════════════════
   APPLY MODAL
═══════════════════════════════════════════════════════════ */
window.openApplyModal = function(jobId, jobTitle) {
  if (!currentUser) { toast("Please login first","error"); return; }
  applyJobId    = jobId;
  applyJobTitle = jobTitle||"Job";

  // Pre-fill: profile form → displayName → email username (never leave blank)
  const savedName = getVal("candidateFullName")
    || currentUser.displayName
    || currentUser.email.split("@")[0];
  const savedPhone = getVal("candidatePhone") || "";
  const savedExp   = getVal("candidateExperience") || "";

  setVal("applyName",       savedName);
  setVal("applyPhone",      savedPhone);
  setVal("applyExperience", savedExp);
  setVal("applyEmail",      currentUser.email);

  const m = document.getElementById("applyModal");
  if (m) m.style.display = "flex";
};

window.closeApplyModal = function() {
  const m = document.getElementById("applyModal");
  if (m) m.style.display = "none";
};

window.submitApplication = async function() {
  const name = getVal("applyName");
  const phone = getVal("applyPhone");
  const exp   = getVal("applyExperience");
  if (!name) { setVal("applyName", currentUser.email.split("@")[0]); }
  if (!phone||!exp) {
    toast("⚠️ Please enter Phone and Experience","error");
    return;
  }
  try {
    const dup = await getDocs(query(collection(db,"jobApplications"),
      where("email","==",currentUser.email), where("jobId","==",applyJobId)));
    if (!dup.empty) { toast("Already applied for this job!","warning"); window.closeApplyModal(); return; }

    await addDoc(collection(db,"jobApplications"), {
      fullname: name, email: currentUser.email, phone, experience: exp,
      about: getVal("coverLetter"),
      jobId: applyJobId, jobTitle: applyJobTitle,
      applicationId: "APP"+Date.now().toString().slice(-6),
      status: "New Application",
      appliedOn: new Date().toLocaleDateString("en-IN"),
      createdAt: serverTimestamp(), userId: currentUser.uid
    });
    toast("✅ Application submitted!","success");
    window.closeApplyModal();
    loadApplications();
  } catch(e){ toast("Error: "+e.message,"error"); }
};

/* ═══════════════════════════════════════════════════════════
   APPLICATIONS
═══════════════════════════════════════════════════════════ */
async function loadApplications() {
  if (!currentUser) return;
  try {
    let apps = [];
    const s1 = await getDocs(query(collection(db,"jobApplications"),
      where("userId","==",currentUser.uid)));
    s1.forEach(d => apps.push({id:d.id,...d.data()}));
    if (!apps.length) {
      const s2 = await getDocs(query(collection(db,"jobApplications"),
        where("email","==",currentUser.email)));
      s2.forEach(d => apps.push({id:d.id,...d.data()}));
    }
    setEl("totalApplications",   apps.length);
    setEl("underReview",         apps.filter(a=>a.status==="Under Review").length);
    setEl("interviewsScheduled", apps.filter(a=>a.status==="Interview Scheduled").length);
    setEl("selectedJobs",        apps.filter(a=>a.status==="Selected").length);

    const recent = document.getElementById("recentApplications");
    if (recent) {
      recent.innerHTML = !apps.length
        ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:#888;">No applications yet. Browse jobs below ↓</td></tr>`
        : apps.slice(0,5).map(a=>`
          <tr>
            <td><strong>${a.jobTitle||"N/A"}</strong></td>
            <td>${a.companyName||a.company||"Indupalli Services"}</td>
            <td>${badge(a.status)}</td>
            <td>${a.appliedOn||"—"}</td>
          </tr>`).join("");
    }

    const full = document.getElementById("applicationsTable");
    if (full) {
      full.innerHTML = !apps.length
        ? `<tr><td colspan="5" style="text-align:center;padding:24px;color:#888;">No applications yet.</td></tr>`
        : apps.map(a=>`
          <tr>
            <td><strong>${a.jobTitle||"N/A"}</strong></td>
            <td>${a.companyName||a.company||"Indupalli Services"}</td>
            <td>${badge(a.status)}</td>
            <td>${a.appliedOn||"—"}</td>
            <td><button onclick="window.initializeChatRoom&&window.initializeChatRoom('${a.id}','Recruiter','candidate')"
              class="chat-btn">💬 Chat</button></td>
          </tr>`).join("");
    }
  } catch(e){ console.warn("Apps:",e.message); }
}

/* ═══════════════════════════════════════════════════════════
   LOGOUT
═══════════════════════════════════════════════════════════ */
window.logoutCandidate = async function() {
  try { await signOut(auth); } catch(e) {}
  localStorage.removeItem("userEmail");
  window.location.href = "login.html";
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function getVal(id) { return document.getElementById(id)?.value?.trim()||""; }
function setVal(id,v) { const e=document.getElementById(id); if(e) e.value=v; }
function setEl(id,v)  { const e=document.getElementById(id); if(e) e.textContent=v; }

function badge(s) {
  const m={"New Application":["#64748b","🆕 New"],"Under Review":["#f59e0b","👀 Review"],
    "Interview Scheduled":["#3b82f6","📅 Interview"],"Selected":["#10b981","✅ Selected"],
    "Rejected":["#ef4444","❌ Rejected"]};
  const [c,l]=m[s]||["#64748b",s||"New"];
  return `<span style="background:${c}20;color:${c};padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">${l}</span>`;
}

function toast(msg, type="success") {
  const old=document.getElementById("__toast"); if(old) old.remove();
  const c={success:"#00b86b",error:"#ef4444",warning:"#ff9800",info:"#0056d2"};
  const t=document.createElement("div");
  t.id="__toast";
  t.style.cssText=`position:fixed;bottom:24px;right:20px;z-index:99999;background:${c[type]};
    color:#fff;padding:13px 20px;border-radius:12px;font-size:14px;font-weight:600;
    box-shadow:0 6px 24px rgba(0,0,0,.2);max-width:300px;`;
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3500);
}

/* ── Wire search on input ──────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("jobSearch")?.addEventListener("input", window.filterJobs);
  document.getElementById("jobFilter")?.addEventListener("change", window.filterJobs);
});

/* ═══════════════════════════════════════════════════════════
   AI ABOUT ME WRITER
   Asks the candidate questions, then calls Claude API to
   generate a professional bio and inserts it into the
   "About Me" textarea automatically.
═══════════════════════════════════════════════════════════ */

const AI_QUESTIONS = [
  "👋 Hi! I'll help you write your About Me. Let's start — what is your full name and current job title or field?",
  "💼 How many years of experience do you have, and which industries have you worked in?",
  "🔧 What are your top 3-5 skills or areas of expertise?",
  "🏆 Can you share one or two key achievements or projects you're proud of?",
  "🎯 What kind of role or opportunity are you looking for next?"
];

let aiAnswers   = [];
let aiStep      = 0;
let aiTyping    = false;

window.openAIAboutChat = function() {
  // Reset state
  aiAnswers = [];
  aiStep    = 0;
  aiTyping  = false;

  const modal = document.getElementById("aiAboutModal");
  if (modal) modal.style.display = "flex";

  // Clear messages
  const msgs = document.getElementById("aiChatMessages");
  if (msgs) msgs.innerHTML = "";

  // Pre-fill answers from existing profile values so user
  // doesn't have to re-type things they already entered
  const prefill = [
    getVal("candidateFullName"),
    getVal("candidateExperience"),
    getVal("candidateSkills"),
    "",
    ""
  ];
  // Store prefill for later use in prompt
  window._aiPrefill = prefill;

  // Start the conversation
  setTimeout(() => addAIBubble(AI_QUESTIONS[0], "ai"), 300);

  // Focus input
  setTimeout(() => document.getElementById("aiChatInput")?.focus(), 400);
};

window.closeAIAboutChat = function() {
  const modal = document.getElementById("aiAboutModal");
  if (modal) modal.style.display = "none";
};

window.sendAIAnswer = async function() {
  if (aiTyping) return;

  const input = document.getElementById("aiChatInput");
  const answer = input?.value?.trim();
  if (!answer) return;

  // Show user's reply
  addAIBubble(answer, "user");
  input.value = "";
  aiAnswers[aiStep] = answer;
  aiStep++;

  if (aiStep < AI_QUESTIONS.length) {
    // Next question
    setTimeout(() => addAIBubble(AI_QUESTIONS[aiStep], "ai"), 600);
  } else {
    // All questions answered — generate bio
    await generateBio();
  }
};

async function generateBio() {
  aiTyping = true;

  // Hide input area while generating
  const inputArea = document.getElementById("aiChatInputArea");
  if (inputArea) inputArea.style.display = "none";

  addAIBubble("✨ Great! Generating your professional bio now...", "ai");

  // Show typing indicator
  const typingId = "aiTypingIndicator";
  addAIBubble(`<div id="${typingId}" style="display:flex;gap:4px;align-items:center;padding:4px 0;">
    <span style="width:8px;height:8px;background:#7c3aed;border-radius:50%;animation:aiDot 1s infinite .0s;"></span>
    <span style="width:8px;height:8px;background:#7c3aed;border-radius:50%;animation:aiDot 1s infinite .2s;"></span>
    <span style="width:8px;height:8px;background:#7c3aed;border-radius:50%;animation:aiDot 1s infinite .4s;"></span>
    <style>@keyframes aiDot{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}</style>
  </div>`, "ai", true);

  // Build prompt using answers + existing profile values
  const name       = aiAnswers[0] || getVal("candidateFullName") || "the candidate";
  const experience = aiAnswers[1] || getVal("candidateExperience") || "";
  const skills     = aiAnswers[2] || getVal("candidateSkills") || "";
  const achievement = aiAnswers[3] || "";
  const goal       = aiAnswers[4] || "";

  const prompt = `Write a professional, warm and concise "About Me" bio for a job seeker's profile on a recruitment platform.

Here are their details:
- Name / Title: ${name}
- Experience: ${experience}
- Key Skills: ${skills}
- Achievement / Project: ${achievement}
- Career Goal: ${goal}

Instructions:
- Write in first person ("I am...", "I have...")
- Keep it between 80-120 words
- Make it professional but natural sounding
- End with what they're looking for
- Do NOT include any headers or labels — just the bio paragraph itself`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const bio  = data?.content?.[0]?.text?.trim() || "";

    // Remove typing indicator
    document.getElementById(typingId)?.closest(".ai-bubble-wrap")?.remove();

    if (bio) {
      // Show the generated bio in chat
      addAIBubble(`✅ Here's your bio:\n\n"${bio}"`, "ai");

      // Show insert button
      addInsertButton(bio);
    } else {
      addAIBubble("❌ Could not generate bio. Please try again.", "ai");
      showRetryOption();
    }
  } catch (e) {
    document.getElementById(typingId)?.closest(".ai-bubble-wrap")?.remove();
    addAIBubble("❌ Something went wrong: " + e.message, "ai");
    showRetryOption();
  }

  aiTyping = false;
}

function addInsertButton(bio) {
  const msgs = document.getElementById("aiChatMessages");
  if (!msgs) return;

  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:4px;";
  wrap.innerHTML = `
    <button onclick="insertBio(${JSON.stringify(bio)})" style="
      padding:12px;
      background:linear-gradient(135deg,#00b86b,#009a5c);
      color:#fff;border:none;border-radius:12px;
      font-size:14px;font-weight:700;cursor:pointer;
      font-family:'Poppins',sans-serif;
    ">✅ Insert into About Me</button>
    <button onclick="openAIAboutChat()" style="
      padding:11px;background:#f0f4ff;color:#0056d2;
      border:2px solid #e0e8ff;border-radius:12px;
      font-size:13px;font-weight:600;cursor:pointer;
      font-family:'Poppins',sans-serif;
    ">🔄 Regenerate</button>
  `;
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

function showRetryOption() {
  const msgs = document.getElementById("aiChatMessages");
  if (!msgs) return;
  const btn = document.createElement("button");
  btn.textContent = "🔄 Try Again";
  btn.style.cssText = "padding:11px;background:#f0f4ff;color:#0056d2;border:2px solid #e0e8ff;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Poppins',sans-serif;";
  btn.onclick = openAIAboutChat;
  msgs.appendChild(btn);
  msgs.scrollTop = msgs.scrollHeight;
}

window.insertBio = function(bio) {
  const ta = document.getElementById("candidateAbout");
  if (ta) {
    ta.value = bio;
    // Animate the textarea briefly to show it was updated
    ta.style.border = "2px solid #00b86b";
    ta.style.boxShadow = "0 0 0 4px rgba(0,184,107,.15)";
    setTimeout(() => {
      ta.style.border = "";
      ta.style.boxShadow = "";
    }, 2000);
  }
  closeAIAboutChat();
  // Scroll to the about field
  setTimeout(() => ta?.scrollIntoView({ behavior:"smooth", block:"center" }), 200);
  showToast("✅ Bio inserted! Remember to save your profile.", "success");
};

function addAIBubble(text, sender, isRaw = false) {
  const msgs = document.getElementById("aiChatMessages");
  if (!msgs) return;

  const isAI   = sender === "ai";
  const wrap   = document.createElement("div");
  wrap.className = "ai-bubble-wrap";
  wrap.style.cssText = `display:flex;flex-direction:column;align-items:${isAI ? "flex-start" : "flex-end"};`;

  const bubble = document.createElement("div");
  bubble.style.cssText = `
    max-width:82%;padding:11px 15px;
    border-radius:${isAI ? "4px 16px 16px 16px" : "16px 4px 16px 16px"};
    font-size:13px;line-height:1.6;
    background:${isAI ? "#fff" : "linear-gradient(135deg,#7c3aed,#0056d2)"};
    color:${isAI ? "#1f2937" : "#fff"};
    box-shadow:0 2px 8px rgba(0,0,0,.08);
    white-space:pre-wrap;
  `;

  if (isRaw) {
    bubble.innerHTML = text;
  } else {
    bubble.textContent = text;
  }

  wrap.appendChild(bubble);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

function getVal(id) {
  return document.getElementById(id)?.value?.trim() || "";
}