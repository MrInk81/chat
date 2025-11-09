// moderation-ui.js
(function(){
  function ready(fn){ if(document.readyState!=='loading'){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }
  function ensure(cb){
    const start = Date.now();
    (function wait(){
      if (window.firebase && window.db && window.auth && window.createBan24h && window.createBanPerm && window.unbanUser) return cb();
      if (Date.now()-start > 15000) return console.warn("moderation-ui.js: deps not ready");
      setTimeout(wait, 200);
    })();
  }
  async function isAdminOrMod(){
    const u = auth.currentUser;
    if(!u) return false;
    const [a,m] = await Promise.all([
      firebase.database().ref('/admins/'+u.uid).get(),
      firebase.database().ref('/mods/'+u.uid).get()
    ]);
    return !!(a.val() || m.val());
  }
  function makeBtn(label){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'badge action'; // re-use your style
    b.textContent = label;
    return b;
  }
  function attachToRow(row){
    if(row.dataset.banButtonsAttached) return;
    row.dataset.banButtonsAttached = '1';
    const uid = row.getAttribute('data-uid') || row.dataset.uid;
    if(!uid) return;
    const btn24 = makeBtn('Ban 24h');
    const btnPerm = makeBtn('Ban Perm');
    const btnUnban = makeBtn('Unban');
    btn24.addEventListener('click', ()=> window.createBan24h(uid));
    btnPerm.addEventListener('click', ()=> window.createBanPerm(uid));
    btnUnban.addEventListener('click', ()=> window.unbanUser(uid));
    // Heuristics: append after existing action buttons (PM/Warn/Mute/Unmute)
    const actions = row.querySelector('.actions, .user-actions, .badges, .controls') || row;
    actions.appendChild(btn24);
    actions.appendChild(btnPerm);
    actions.appendChild(btnUnban);
  }
  function scan(){
    // Heuristic: each user line likely has class 'user', 'member', or attribute data-uid
    document.querySelectorAll('[data-uid], .user, .member').forEach(el=>{
      // Must contain a PM/Mute button to be a control row
      if(el.textContent && /(PM|Mute|Unmute|Warn|Warnung)/i.test(el.textContent)){
        attachToRow(el);
      }
    });
  }
  ready(function(){
    ensure(async function(){
      if(!(await isAdminOrMod())) return; // only for admins/mods
      // Initial scan
      scan();
      // Observe for dynamic list updates
      const obs = new MutationObserver(()=>scan());
      obs.observe(document.body, {childList:true, subtree:true});
      // also rescan after auth state changes
      auth.onAuthStateChanged(()=>scan());
    });
  });
})();