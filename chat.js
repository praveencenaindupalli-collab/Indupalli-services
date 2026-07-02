/* ============================================================
   INDUPALLI SERVICES ATS — Chat Module
   Recruiter ↔ Candidate real-time messaging via Firestore
   ============================================================ */

import {
  collection, addDoc, serverTimestamp,
  query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// db is set globally by firebase.js (window.db)
let activeChatUnsubscribe = null;

window.initializeChatRoom = function(appId, candidateName, senderRole) {
  const db     = window.db;
  const sender = senderRole || localStorage.getItem("userRole") || "recruiter";

  // Remove existing chat modal if open with different candidate
  const existing = document.getElementById("atsChatModal");
  if (existing) existing.remove();
  if (activeChatUnsubscribe) { activeChatUnsubscribe(); activeChatUnsubscribe = null; }

  // Build chat UI
  const modal = document.createElement("div");
  modal.id = "atsChatModal";
  modal.innerHTML = `
    <div style="
      position:fixed;bottom:0;right:24px;
      width:360px;height:480px;
      background:#fff;
      border-radius:16px 16px 0 0;
      box-shadow:0 -4px 30px rgba(0,0,0,.18);
      display:flex;flex-direction:column;
      z-index:99999;
      overflow:hidden;
      font-family:'Segoe UI',Calibri,Arial,sans-serif;
    ">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#001b5e,#0056d2);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;">${(candidateName||"C")[0].toUpperCase()}</div>
          <div>
            <div style="font-size:14px;font-weight:700;">${candidateName || "Candidate"}</div>
            <div style="font-size:11px;opacity:.75;">💬 Live Chat</div>
          </div>
        </div>
        <button onclick="window.closeChatWindow()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <!-- Messages -->
      <div id="chatMessageStream" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f5f7ff;">
        <div style="text-align:center;color:#94a3b8;font-size:12px;padding:10px;">Start of conversation</div>
      </div>

      <!-- Input -->
      <div style="padding:12px;background:#fff;border-top:1px solid #e0e8ff;flex-shrink:0;">
        <form id="chatForm" style="display:flex;gap:8px;">
          <input
            type="text" id="chatMessageInput"
            placeholder="Type a message..."
            autocomplete="off"
            style="flex:1;padding:10px 14px;border:2px solid #e0e8ff;border-radius:24px;font-size:14px;outline:none;font-family:inherit;"
            onfocus="this.style.borderColor='#0056d2'"
            onblur="this.style.borderColor='#e0e8ff'"
          >
          <button type="submit" style="width:40px;height:40px;background:#0056d2;border:none;border-radius:50%;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">➤</button>
        </form>
      </div>
    </div>`;

  document.body.appendChild(modal);

  // Send message handler
  document.getElementById("chatForm").onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById("chatMessageInput");
    const text  = input.value.trim();
    if (!text) return;
    input.value = "";
    try {
      await addDoc(collection(db, `jobApplications/${appId}/messages`), {
        text,
        sender,
        senderLabel: sender === "recruiter" ? "Recruiter" : "You",
        timestamp: serverTimestamp()
      });
      await addDoc(collection(db, "notifications"), {
    applicationId: appId,
    sender: sender,
    message: text,
    read: false,
    createdAt: serverTimestamp()
});
    } catch (e) {
      console.error("Chat send error:", e);
    }
  };

  // Listen for messages
  const msgsRef = query(
    collection(db, `jobApplications/${appId}/messages`),
    orderBy("timestamp", "asc")
  );

  activeChatUnsubscribe = onSnapshot(msgsRef, (snap) => {
    const stream = document.getElementById("chatMessageStream");
    if (!stream) return;

    // Keep the intro line, replace the rest
    const msgs = [];
    snap.forEach(d => msgs.push(d.data()));

    stream.innerHTML = `<div style="text-align:center;color:#94a3b8;font-size:11px;padding:4px 0;">💬 Conversation started</div>`;

    msgs.forEach(msg => {
      const isMe = msg.sender === sender;
      stream.innerHTML += `
        <div style="display:flex;flex-direction:column;align-items:${isMe ? "flex-end" : "flex-start"};">
          <div style="
            background:${isMe ? "#0056d2" : "#fff"};
            color:${isMe ? "#fff" : "#1a1a2e"};
            padding:9px 14px;border-radius:${isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px"};
            font-size:13px;max-width:75%;line-height:1.5;
            box-shadow:0 2px 6px rgba(0,0,0,.07);
          ">${msg.text}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:3px;">${msg.senderLabel||msg.sender||""}</div>
        </div>`;
    });

    // Auto-scroll to bottom
    stream.scrollTop = stream.scrollHeight;
  });
};

window.closeChatWindow = function() {
  const modal = document.getElementById("atsChatModal");
  if (modal) modal.remove();
  if (activeChatUnsubscribe) { activeChatUnsubscribe(); activeChatUnsubscribe = null; }
};