
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInAnonymously, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getDatabase, ref, onValue, set, push, serverTimestamp, onDisconnect, update, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { firebaseConfig } from "./config.js";

// ----- Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ----- Elements
const $ = (id)=>document.getElementById(id);
const msgs = $("messages");
const input = $("msgInput");
const sendBtn = $("sendBtn");
const citizensOnline = $("citizensOnline");
const adminsOnline = $("adminsOnline");
const notifBtn = $("notifBtn");
const notifBadge = $("notifBadge");
notifBadge?.addEventListener('click', ()=> notifModal.classList.add('open'));
const roomName = $("roomName");
const roomsEl = $("rooms");
const onlineList = $("onlineList");
const logoutLink = $("logoutLink");
const rulesLink = $("rulesLink");
const welcomeModal = $("welcomeModal");
const closeWelcome = $("closeWelcome");
const welcomeCloseX = $("welcomeCloseX");
const googleBtn = $("googleBtn");
const anonBtn = $("anonBtn");
const burger = $("burger");
const sidebar = $("sidebar");
const installBtn = $("installBtn");
const pmModal = $("pmModal");
const pmThread = $("pmThread");
const pmInput = $("pmInput");
const pmSend = $("pmSend");
const pmConfirm = $("pmConfirm");
const pmCloseX = $("pmCloseX");
const pmTitle = $("pmTitle");
const pmMin = $("pmMin");
const replyPill = $("replyPill");
const replyName = $("replyName");
const replyCancel = $("replyCancel");
const notifModal = $("notifModal");
const notifCenter = $("notifCenter");
const notifCloseX = $("notifCloseX");
notifBadge?.addEventListener('click', ()=> notifModal.classList.add('open'));
notifBtn?.addEventListener('click', ()=> notifModal.classList.add('open'));
window.addEventListener('click', (e) => {
  if (e.target.closest('#notifBtn, #notifBadge')) notifModal.classList.add('open');
  if (e.target.closest('#notifCloseX')) notifModal.classList.remove('open');
});
// ----- PWA install
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();deferredPrompt=e;installBtn.style.display='inline-flex'});
installBtn.addEventListener('click',async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; installBtn.style.display='none'; deferredPrompt=null; }});
burger?.addEventListener('click',()=> sidebar.classList.toggle('open'));
notifCloseX?.addEventListener('click',()=>notifModal.classList.remove('open'));

// ----- Rooms
const ROOMS = [
  { id:"fragen", name:"Fragen an die Bürgerliste", icon:"❓" },
  { id:"politik", name:"Wahlen & Politik", icon:"🗳️" },
  { id:"plaudern", name:"Plauderecke", icon:"💬" },
  { id:"vereine", name:"Vereine", icon:"🏟️" }
];

function renderRooms(){
  try{ roomsEl.innerHTML=""; }catch(e){ return; }
  ROOMS.forEach(r=>{
    const div=document.createElement('div');
    div.className="room"+(r.id===currentRoom?" active":"");
    div.innerHTML=`<span class="icon">${r.icon}</span><div>${r.name}</div>`;
    div.addEventListener('click',()=>{
      currentRoom=r.id;
      renderRooms();
      loadMessages();
      try{applyMuteBlur();}catch(e){}
    });
    roomsEl.appendChild(div);
  });
  try{ roomName.textContent = (ROOMS.find(r=>r.id===currentRoom)||ROOMS[0]).name; }catch(e){}
}
let currentRoom = ROOMS[0].id;

const ADMINS = ["info@buergerliste-wimpassing.at"];
const MODS = ["wolfgang.bauer@buergerliste-wimpassing.at","sabine.staudinger@buergerliste-wimpassing.at","christian.staudinger@buergerliste-wimpassing.at"];
function roleFor(user){
  if(!user) return "guest";
  if(user.email && ADMINS.includes(user.email)) return "admin";
  if(user.email && MODS.includes(user.email)) return "mod";
  if(user.isAnonymous) return "anon";
  return "citizen";
}
function displayNameFor(user){
  if(!user) return "Gast";
  if(user.displayName) return user.displayName;
  if(user.email) return user.email.split('@')[0];
  return "Anonym";
}

// ----- Profanity (simple word-wise + leet normalization)
const BAD = ["arsch","arschloch","idiot","trottel","trttl","trottl","depp","deppl",
"scheiss","scheiß","fuck","fck","bastard","hurensohn","hure","hurenkind","hurnkind","nutte",
"fotze","fut","drecksau","deppadsau","pisser","wixer","wichser","spast","mongo","opfer"];
function isBad(text){
  const map={ "@":"a","4":"a","3":"e","€":"e","1":"i","!":"i","0":"o","$":"s","5":"s","7":"t","+":"t" };
  const t=(text||"").toLowerCase().replace(/[@431€!0$57+]/g, m=>map[m]||m)
    .normalize('NFKD').replace(/[^a-zäöüß\s]/g,' ').split(/\s+/).filter(Boolean);
  for(const w of t){ if(w.length<2) continue; for(const b of BAD){ if(w.includes(b)) return true; } }
  return false;
}
function cleanName(name){
  const n=(name||"").toLowerCase().trim();
  if(!n) return "";
  if(ADMINS.some(a=>a.startsWith(n))||MODS.some(m=>m.startsWith(n))) return "";
  if(isBad(n)) return "";
  return name;
}

// ----- Welcome / Regeln
let rulesManualOpen=false;
function openWelcome(){ welcomeModal.classList.add('open'); }
function closeWelcomeModal(){ welcomeModal.classList.remove('open'); rulesManualOpen=false; }
rulesLink.addEventListener('click', ()=>{ rulesManualOpen=true; openWelcome(); });
closeWelcome.addEventListener('click', closeWelcomeModal);
welcomeCloseX.addEventListener('click', closeWelcomeModal);

// ----- Auth actions
googleBtn.addEventListener('click', async ()=>{ rulesManualOpen=false; await signInWithPopup(auth, new GoogleAuthProvider()); });
anonBtn.addEventListener('click', async ()=>{
  rulesManualOpen=false;
  const nickRaw = prompt("Bitte wähle einen Chatnamen:");
  let nick = cleanName(nickRaw||"");
  if(!nick){ alert("Name nicht erlaubt."); return; }
  await signInAnonymously(auth);
  let final = nick; let i=1;
  while(true){ const s=await get(ref(db,"nicks/"+final.toLowerCase())); if(!s.exists()) break; final = nick + i++; if(i>100) break; }
  await updateProfile(auth.currentUser,{displayName:final}); try{ await update(ref(db,'status/'+auth.currentUser.uid), { name: final }); applyMuteBlur(); }catch(e){}
  await set(ref(db,"nicks/"+final.toLowerCase()), auth.currentUser.uid);
});
replyCancel.addEventListener('click', ()=>{ replyTarget=null; replyPill.classList.remove('open'); input.placeholder='Nachricht schreiben…'; });

// ----- Presence + inactivity
let presenceRef=null;
function setupPresence(user){
  presenceRef = ref(db,"status/"+user.uid);
  set(presenceRef,{state:"online",role:roleFor(user),name:displayNameFor(user),email:user.email||"",uid:user.uid,last_changed:Date.now()});
  onDisconnect(presenceRef).set({state:"offline",role:roleFor(user),name:displayNameFor(user),email:user.email||"",uid:user.uid,last_changed:Date.now()});
}
function setupInactivityPrompt(){
  const user=auth.currentUser; if(!user) return;
  let timer=null;
  function idle(){ update(ref(db,"status/"+user.uid),{state:"idle",last_changed:Date.now()}); showAreYouThere(); }
  function active(){ clearTimeout(timer); update(ref(db,"status/"+user.uid),{state:"online",last_changed:Date.now()}); timer=setTimeout(idle,5*60*1000); }
  ["mousemove","keydown","touchstart"].forEach(ev=>window.addEventListener(ev,active)); active();
}
function showAreYouThere(){
  const modal=document.createElement('div'); modal.className='modal open';
  modal.innerHTML = `<div class="card" style="max-width:480px"><h2>Noch online?</h2>
    <p>Bist du noch da? Der Status wurde auf Inaktiv gesetzt.</p>
    <div class="actions"><button class="btn primary" id="imHere">Ich bin noch da</button></div></div>`;
  document.body.appendChild(modal);
  modal.querySelector('#imHere').addEventListener('click', ()=>{ modal.remove(); const u=auth.currentUser; if(u){ update(ref(db,"status/"+u.uid),{state:"online",last_changed:Date.now()}); } });
}

// ----- Online list & counters
onValue(ref(db,"status"), snap=>{
  const val=snap.val()||{}; let admins=0, citizens=0;
  const groups={admin:[],mod:[],citizen:[],anon:[]};
  const now=Date.now();
  Object.values(val).forEach(v=>{
    const fresh = (now - (v.last_changed||0)) < 2*60*1000;
    const on = (v.state==="online"||v.state==="idle") && fresh;
    if(!on) return;
    if(v.role==="admin"||v.role==="mod") admins++;
    if(v.role==="citizen"||v.role==="anon") citizens++;
    if(groups[v.role]) groups[v.role].push(v);
  });
  citizensOnline.textContent = String(citizens);
  adminsOnline.textContent = String(admins);
  function roleTitle(r){ return {admin:"Administrator",mod:"Moderatoren",citizen:"BürgerInnen",anon:"Anonym"}[r]; }
  onlineList.innerHTML="";
  const meRole=roleFor(auth.currentUser||{});
  let any=false;
  ["admin","mod","citizen","anon"].forEach(r=>{
    const arr=(groups[r]||[]).sort((a,b)=>a.name.localeCompare(b.name));
    if(!arr.length) return;
    any=true;
    const wrap=document.createElement('div'); wrap.className='group';
    const title=document.createElement('div'); title.className='section-title'; title.textContent=roleTitle(r); wrap.appendChild(title);
    arr.forEach(p=>{
      const row=document.createElement('div'); row.className='person';
      const dot=p.state==="idle"?"orange":"green";
      row.innerHTML=`<div class="topline"><span class="dot ${dot}"></span><span class="name ${r}">${p.name}</span></div>`;
      if((meRole==='admin'||meRole==='mod') && auth.currentUser && auth.currentUser.uid!==p.uid){
        const actions=document.createElement('div'); actions.className='actions';
        actions.innerHTML = `<button class="btn" data-a="pm">PM</button><button class="btn" data-a="warn">Warnung</button><button class="btn" data-a="mute">Mute</button><button class="btn" data-a="unmute">Unmute</button>`;
        actions.querySelector('[data-a="pm"]').onclick=()=>startPM(p.uid||p.id, p.name);
        actions.querySelector('[data-a="warn"]').onclick=()=>issueWarning(p.uid||p.id);
        actions.querySelector('[data-a="mute"]').onclick=()=>muteUser(p.uid||p.id);
        actions.querySelector('[data-a="unmute"]').onclick=()=>unmuteUser(p.uid||p.id);
        row.appendChild(actions);
      }
      wrap.appendChild(row);
    });
    onlineList.appendChild(wrap);
  });
  if(!any){ onlineList.innerHTML = '<div class="empty">Niemand online.</div>'; }
});

// ----- Messages & replies
let replyTarget=null;
window._mutes={};
// ---- Blur updater for muted current user
function applyMuteBlur(){
  try{
    const me = auth.currentUser;
    const muted = me && isMuted(me.uid);
    document.querySelectorAll('.messages .text').forEach(el=>{
      if(muted){ el.classList.add('fullblur'); }
      else { el.classList.remove('fullblur'); }
    });
  }catch(e){}
}
      else { el.classList.remove('blur'); }
    });
  }catch(e){}
}

try{ onValue(ref(db,'mutes'), s=>{ window._mutes = s.val()||{}; try{applyMuteBlur();}catch(e){} });
applyMuteBlur(); }catch(e){}
function isMuted(uid){ try{ const m=window._mutes&&window._mutes[uid]; return !!(m && (!m.until || m.until>Date.now())); }catch(e){ return false; } }
function renderMsg(m){
  const d=document.createElement('div');
  d.id='message-'+m.id;
  const mine = auth.currentUser && m.uid===auth.currentUser.uid;
  d.className='msg'+(mine?' mine':'') + (m.replyTo ? ' reply':'');
  const roleClass = m.role==="admin"?"admin":m.role==="mod"?"mod":m.role==="anon"?"anon":"citizen";
  const meta=document.createElement('div'); meta.className='meta';
  meta.innerHTML = `<span class="${roleClass}">${m.name}</span> · ${new Date(m.ts||Date.now()).toLocaleString()}`;
  d.appendChild(meta);
  if(m.replyTo){ const rmeta=document.createElement('div'); rmeta.className='replyMeta'; rmeta.textContent='Antwort auf: '+(m.replyName||'Beitrag'); d.appendChild(rmeta); }
  const text=document.createElement('div'); text.className='text';
if(!auth.currentUser){
  const words=(m.text||'').split(/\s+/);
  const first=words.slice(0,3).join(' ');
  const rest=words.slice(3).join(' ');
  text.classList.add('blur');
  text.innerHTML = `<span>${first}</span> <span class="rest">${rest}</span>`;
}else if(isMuted(auth.currentUser.uid)){
  text.classList.add('fullblur');
  text.textContent = (m.text && m.text.trim().length) ? m.text : '(ohne Text)';
}else{
  text.textContent = (m.text && m.text.trim().length) ? m.text : '(ohne Text)';
}
d.appendChild(text);
  const r=roleFor(auth.currentUser||{});
  if(((r==="admin"||r==="mod") && auth.currentUser && auth.currentUser.uid!==m.uid) || (auth.currentUser && auth.currentUser.uid===m.uid)){
    const bar=document.createElement('div'); bar.style.marginTop="6px";
    let actions='';
    if((r==="admin"||r==="mod") && auth.currentUser && auth.currentUser.uid!==m.uid){
      actions += `<button class="btn mini" data-a="answer">Antwort</button>`;
    }
    actions += `<button class="trash" title="Löschen" data-a="del">🗑️</button>`;
    bar.innerHTML=actions;
    const del=bar.querySelector('[data-a="del"]');
    del.onclick=()=> set(ref(db,`rooms/${currentRoom}/messages/${m.id}`), null);
    const ans=bar.querySelector('[data-a="answer"]');
    if(ans){ ans.onclick=()=>{ replyTarget={id:m.id, uid:m.uid, name:m.name}; replyName.textContent=m.name; replyPill.classList.add('open'); input.placeholder='Antwort an '+m.name+'…'; input.focus(); }; }
    d.appendChild(bar);
  }
  msgs.appendChild(d);
}
function loadMessages(){
  msgs.innerHTML="";
  roomName.textContent = (ROOMS.find(r => r.id === currentRoom) || ROOMS[0]).name;

// Falls ein alter Nachrichten-Listener aktiv ist, entferne ihn zuerst
if (window.roomUnsub) {
  window.roomUnsub(); 
}

// Erstelle einen neuen Listener für den aktuellen Raum und speichere ihn,
// damit er beim nächsten Raumwechsel wieder beendet werden kann
window.roomUnsub = onValue(ref(db, "rooms/" + currentRoom + "/messages"), (snap) => {

    const val=snap.val()||{};
    const arr=Object.entries(val).map(([id,m])=>({...m,id}));
    const parents = arr.filter(m=>!m.replyTo).sort((a,b)=>a.ts-b.ts);
    const byParent={}; arr.filter(m=>m.replyTo).forEach(r=>{ (byParent[r.replyTo] ||= []).push(r); });
    msgs.innerHTML="";
    parents.forEach(p=>{ renderMsg(p); (byParent[p.id]||[]).sort((a,b)=>a.ts-b.ts).forEach(x=>{ x._isReply=true; renderMsg(x); }); });
    msgs.scrollTop = msgs.scrollHeight;
  });
}

// ----- Send message
function profanity(t){ return isBad(t); }
async function sendMessage(){
  const user=auth.currentUser; if(!user){ openWelcome(); return; }
  const mSnap=await get(ref(db,"mutes/"+user.uid)); if(mSnap.exists()){ const until=mSnap.val().until||0; const left=until-Date.now(); if(left>0){ alert("Stumm noch "+Math.ceil(left/1000)+"s"); return; } }
  const text=input.value.trim(); if(!text) return; if(profanity(text)){ alert("Bitte keine Schimpfwörter."); return; }
  const msgRef=push(ref(db,"rooms/"+currentRoom+"/messages"));
  await set(msgRef,{uid:user.uid,name:displayNameFor(user),role:roleFor(user),text,ts:Date.now(), replyTo: replyTarget? replyTarget.id : null, replyName: replyTarget? replyTarget.name : null});
  if(replyTarget){
    const preview=(document.querySelector('#message-'+replyTarget.id+' .text')?.textContent||'').split(' ').slice(0,6).join(' ')+'…';
    await notify(replyTarget.uid,{type:'answer',room:currentRoom,mid:replyTarget.id,questionPreview:preview,answerText:text,ts:Date.now(),fromName:displayNameFor(user)});
    replyTarget=null; replyPill.classList.remove('open'); input.placeholder='Nachricht schreiben…';
  }
  input.value="";
}
sendBtn.addEventListener('click',sendMessage);
input.addEventListener('keydown',e=>{ if(e.key==="Enter"){ e.preventDefault(); sendMessage(); }});

// ----- Inbox / PM / Warn / Mute
function notify(uid,data){ const id=push(ref(db,"inbox/"+uid)).key; return set(ref(db,"inbox/"+uid+"/"+id), data); }
function issueWarning(uid){
  const level=parseInt(prompt("Verwarnungsstufe 1=leicht, 2=mittel, 3=schwer (15 Min Mute):","1")||"1");
  notify(uid,{type:"warn",level,ts:Date.now(),text: level===1?"Leichte Verwarnung: bitte freundlich bleiben.": level===2?"Mittlere Verwarnung: Regelverstoß, sonst Mute.":"Schwere Verwarnung: 15 Minuten Mute.", fromName:displayNameFor(auth.currentUser)});
  if(level===3){ set(ref(db,"mutes/"+uid),{until: Date.now()+15*60*1000}); }
}
function muteUser(uid){ const mins=parseInt(prompt("Mute-Minuten:","15")||"15"); set(ref(db,"mutes/"+uid),{until:Date.now()+mins*60*1000}); notify(uid,{type:"warn",level:2,ts:Date.now(),text:`Du wurdest ${mins} Minuten stummgeschaltet.`,fromName:displayNameFor(auth.currentUser)}); }
function unmuteUser(uid){ set(ref(db,"mutes/"+uid),null); }

let currentThread=null; let currentPMOther='';
function threadIdFor(a,b){ return [a,b].sort().join("_"); }
async function startPM(targetUid, targetName){
  const me=auth.currentUser; if(!me) return;
  const tid=threadIdFor(me.uid,targetUid); currentThread=tid; currentPMOther=targetName;
  await set(ref(db,"pm/"+tid+"/meta"),{a:me.uid,b:targetUid,aName:displayNameFor(me),bName:targetName,closed:false});
  await notify(targetUid,{type:"pm",thread:tid,fromName:displayNameFor(me),ts:Date.now()});
  openPM(tid,targetName);
}
function openPM(tid, otherName){
  pmTitle.textContent="Private Nachricht mit "+otherName;
  pmThread.innerHTML=""; pmModal.classList.add('open');
  onValue(ref(db,"pm/"+tid+"/messages"), snap=>{
    const val=snap.val()||{}; pmThread.innerHTML="";
    Object.values(val).sort((a,b)=>a.ts-b.ts).forEach(m=>{
      const div=document.createElement('div'); div.textContent=`${m.name}: ${m.text}`; pmThread.appendChild(div);
    });
    pmThread.scrollTop=pmThread.scrollHeight;
  });
  pmSend.onclick=async()=>{
    const t=pmInput.value.trim(); if(!t) return;
    const refMsg=push(ref(db,"pm/"+tid+"/messages"));
    await set(refMsg,{uid:auth.currentUser.uid,name:displayNameFor(auth.currentUser),text:t,ts:Date.now()}); pmInput.value="";
  };
  pmConfirm.onclick=async()=>{
    const meRole=roleFor(auth.currentUser||{}); if(meRole!=="admin"&&meRole!=="mod") return;
    await update(ref(db,"pm/"+tid+"/meta"),{closed:true,closedBy:displayNameFor(auth.currentUser),closedAt:Date.now()}); pmModal.classList.remove('open');
  };
}
pmCloseX.addEventListener('click', ()=> pmModal.classList.remove('open'));
pmMin.addEventListener('click', async ()=>{ const me=auth.currentUser; if(!me) return; await notify(me.uid,{type:'pm',thread:currentThread,fromName:currentPMOther,ts:Date.now()}); pmModal.classList.remove('open'); });

let inboxCache = {};
const warnShown = new Set();
// Inbox list
notifBtn.addEventListener('click', async ()=>{
  const user=auth.currentUser; if(!user) return;
  const data = inboxCache || {};
  const items = Object.entries(data).map(([id,v])=>({id,...v})).filter(it=>it.type!=='warn').sort((a,b)=>a.ts-b.ts);
  notifCenter.innerHTML = items.length? "" : "<div>Keine Nachrichten.</div>";
  items.forEach(it=>{
    const when=new Date(it.ts||Date.now()).toLocaleString();
    const type = it.type==='pm' ? 'PM' : it.type==='answer' ? 'Antwort' : 'System';
    const preview = it.type==='answer' ? (it.questionPreview||'') : (it.fromName||'');
    const wrapper=document.createElement('div'); wrapper.className='item';
    wrapper.innerHTML = `<div class="meta"><span class="type">${type}</span> · ${when}</div>
      <div><b>${it.fromName||''}</b> ${it.type==='answer'?'hat geantwortet:':''} ${preview}</div>
      <div class="hint">Zum Lesen klicken</div>`;
   wrapper.addEventListener('click', async ()=>{
  if (it.type === 'pm') {
    const metaSnap = await get(ref(db, "pm/" + it.thread + "/meta"));
    const meta = metaSnap.val() || {};
    const me = auth.currentUser;
    const other = meta.a === me.uid ? meta.bName : meta.aName;
    openPM(it.thread, other || "");
    await set(ref(db, "inbox/" + me.uid + "/" + it.id), null);
    notifModal.classList.remove('open');

  } else if (it.type === 'answer') {
    const me = auth.currentUser;
    currentRoom = it.room;  // bewusster Wechsel nur auf Klick
    renderRooms();
    loadMessages(); try{applyMuteBlur();}catch(e){}
    setTimeout(async () => {
      const el = document.getElementById('message-' + it.id);
      if (el) el.scrollIntoView({ block: 'center' });
      await set(ref(db, "inbox/" + me.uid + "/" + it.id), null);
      notifModal.classList.remove('open');
    }, 400);

  } else if (it.type === 'warn') {
    const me = auth.currentUser;
    showWarning(it.level || 1, it.text || 'Verwarnung', it.fromName || 'Moderation');
    await set(ref(db, "inbox/" + me.uid + "/" + it.id), null);
    notifModal.classList.remove('open');
  }
});

    notifCenter.appendChild(wrapper);
  });
  // auto-open disabled to prevent jumps
});

// Fallback Warn-Popup, falls nicht vorhanden
if(typeof window.showWarning !== 'function'){
  window.showWarning = function(level, text, from){
    try{
      const warnModal=document.getElementById('warnModal');
      const warnText=document.getElementById('warnText');
      if(warnModal && warnText){ warnText.textContent = (text||'Verwarnung') + (from? (' – von '+from):''); warnModal.classList.add('open'); }
      else { alert((from?from+': ':'') + (text||'Verwarnung')); }
    }catch(e){ alert(text||'Verwarnung'); }
  };
}


function showWarning(level, text, from){
  const modal=document.getElementById('warnModal');
  const txt=document.getElementById('warnText');
  const ok=document.getElementById('warnOk');
  if(!modal||!txt||!ok){ alert((from?from+': ':'') + (text||'Verwarnung')); return; }
  modal.classList.add('warn','open');
  modal.classList.remove('l1','l2','l3');
  const cl = level==3 ? 'l3' : level==2 ? 'l2' : 'l1';
  modal.classList.add(cl);
  txt.textContent = (text||'Verwarnung') + (from? ' – von '+from : '');
  ok.textContent = 'Ich habe verstanden';
  ok.onclick = ()=>{ modal.classList.remove('open'); };
}
// ----- Auth state
onAuthStateChanged(auth, user=>{
  if(user){
    setupPresence(user); setupInactivityPrompt();
    logoutLink.style.display='inline'; logoutLink.onclick=()=>signOut(auth);
    if(!rulesManualOpen){ try{ welcomeModal.classList.remove('open'); }catch(e){} }
    onValue(ref(db,"inbox/"+user.uid), snap=>{
      inboxCache = snap.val()||{};
      // Sofortige Warn-Popups und direktes Entfernen
      for(const [id,item] of Object.entries(inboxCache)){
        if(item && item.type==='warn'){
          try{ showWarning(item.level||1, item.text||'Verwarnung', item.fromName||'Moderation'); }catch(e){}
          try{ set(ref(db,"inbox/"+user.uid+"/"+id), null); }catch(e){}
        }
      }
      const count = Object.values(inboxCache).filter(it=>it && it.type!=='warn').length;
      notifBadge.style.display = count ? 'inline-block' : 'none';
      notifBadge.textContent = count;
    });
  }else{
    logoutLink.style.display='none';
    if(!rulesManualOpen){ try{ welcomeModal.classList.add('open'); }catch(e){} }
    inboxCache = {}; notifBadge.style.display='none';
  }
});

// ----- Bootstrap
document.addEventListener('DOMContentLoaded', ()=>{ renderRooms(); loadMessages(); try{applyMuteBlur();}catch(e){} if(!auth.currentUser){ openWelcome(); } });


function toggleMenu() {
  const menu = document.getElementById('sideMenu');
  menu.classList.toggle('open');
}
