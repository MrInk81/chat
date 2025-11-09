(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function resolveAuth(){ try{ if(window.auth) return window.auth; if(window.firebase&&firebase.auth) return firebase.auth(); }catch(e){} return null; }
  function ensureFirebase(){ return (window.firebase && firebase.database && firebase.auth); }
  function uidFrom(btn){
    const row = btn.closest('.person');
    if(row && row.getAttribute('data-uid')) return row.getAttribute('data-uid');
    const nameEl = row && row.querySelector('.name');
    if(nameEl && nameEl.dataset && nameEl.dataset.uid) return nameEl.dataset.uid;
    return null;
  }
  function attach(){
    if(!ensureFirebase()) return;
    document.querySelectorAll('[data-a="ban24"]:not([data-bound])').forEach(b=>{
      b.setAttribute('data-bound','1');
      b.addEventListener('click', async ()=>{
        try{
          const a = resolveAuth(); const u = a && a.currentUser; if(!u){ alert('Bitte vorher einloggen.'); return; }
          const id = uidFrom(b); if(!id){ alert('Kein User-ID gefunden'); return; }
          await firebase.database().ref('/bans/'+id).set({
            type:'temp', until: Date.now()+24*60*60*1000, reason:'Verstoß', createdAt: Date.now(), moderatorUid: u.uid
          });
          alert('Ban 24h gesetzt.');
        }catch(e){ alert('Fehler beim Ban: ' + (e && e.message ? e.message : e)); }
      });
    });
    document.querySelectorAll('[data-a="banperm"]:not([data-bound])').forEach(b=>{
      b.setAttribute('data-bound','1');
      b.addEventListener('click', async ()=>{
        try{
          const a = resolveAuth(); const u = a && a.currentUser; if(!u){ alert('Bitte vorher einloggen.'); return; }
          const id = uidFrom(b); if(!id){ alert('Kein User-ID gefunden'); return; }
          await firebase.database().ref('/bans/'+id).set({
            type:'perm', reason:'Verstoß', createdAt: Date.now(), moderatorUid: u.uid
          });
          alert('Permanenter Ban gesetzt.');
        }catch(e){ alert('Fehler beim Ban: ' + (e && e.message ? e.message : e)); }
      });
    });
    document.querySelectorAll('[data-a="unban"]:not([data-bound])').forEach(b=>{
      b.setAttribute('data-bound','1');
      b.addEventListener('click', async ()=>{
        try{
          const a = resolveAuth(); const u = a && a.currentUser; if(!u){ alert('Bitte vorher einloggen.'); return; }
          const id = uidFrom(b); if(!id){ alert('Kein User-ID gefunden'); return; }
          await firebase.database().ref('/bans/'+id).remove();
          alert('Unban ausgeführt.');
        }catch(e){ alert('Fehler beim Unban: ' + (e && e.message ? e.message : e)); }
      });
    });
  }
  ready(function(){
    attach();
    const obs = new MutationObserver(()=>attach());
    obs.observe(document.body, {childList:true, subtree:true});
  });
})();