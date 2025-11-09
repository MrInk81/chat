// CLEAN moderation.js (defines global ban helpers)
(function(){ 
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function resolveAuth(){ try{ if(window.auth) return window.auth; if(window.firebase&&firebase.auth) return firebase.auth(); }catch(e){} return null; }
  window.restWriteBan = async function(targetUid, payload, method){ 
    const a = resolveAuth(); 
    const u = a && a.currentUser; 
    if(!u) throw new Error('not-signed-in'); 
    const token = await u.getIdToken(); 
    const url = "https://buergerliste-wimpassing-chat-default-rtdb.europe-west1.firebasedatabase.app".replace(/\/$/,'') + "/bans/" + encodeURIComponent(targetUid) + ".json?auth=" + token; 
    const opts = { method: method||'PUT', headers:{'Content-Type':'application/json'} }; 
    if(payload!==null && payload!==undefined) opts.body = JSON.stringify(payload); 
    const res = await fetch(url, opts); 
    if(!res.ok) throw new Error('write-failed ' + res.status); 
    return res.json(); 
  };
  window.createBan24h = async function(targetUid, reason){
  try {

  try{ 
    const until = Date.now()+24*60*60*1000; 
    return window.restWriteBan(targetUid, {type:'temp', until, reason: reason||'Verstoß', createdAt: Date.now(), moderatorUid: (resolveAuth()&&resolveAuth().currentUser&&resolveAuth().currentUser.uid)||null }, 'PUT'); 
  
    alert('Ban 24h gesetzt.');
  } catch(e) {
    alert('Fehler: ' + (e && e.message ? e.message : e));
  }
};
  window.createBanPerm = async function(targetUid, reason){
  try {

  try{ 
    return window.restWriteBan(targetUid, {type:'perm', reason: reason||'Verstoß', createdAt: Date.now(), moderatorUid: (resolveAuth()&&resolveAuth().currentUser&&resolveAuth().currentUser.uid)||null }, 'PUT'); 
  
    alert('Permanenter Ban gesetzt.');
  } catch(e) {
    alert('Fehler: ' + (e && e.message ? e.message : e));
  }
};
  window.unbanUser = async function(targetUid, reason){
  try {

  try{ 
    await window.restWriteBan(targetUid, null, 'DELETE');
  alert('Unban ausgeführt.');
  }catch(e){ alert('Fehler beim Unban: '+e.message); } 
  
    alert('Unban ausgeführt.');
  } catch(e) {
    alert('Fehler: ' + (e && e.message ? e.message : e));
  }
};
  ready(function(){ console.log('moderation helpers ready'); });
})();