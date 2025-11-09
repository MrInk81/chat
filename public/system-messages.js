// system-messages.js
(function(){
  function ready(fn){ if(document.readyState!=='loading'){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }
  function ensureFirebase(cb){
    const start = Date.now();
    (function wait(){
      if (window.firebase && window.firebase.database && window.db && window.auth) return cb();
      if (Date.now()-start > 15000) return console.warn("system-messages.js: Firebase not ready");
      setTimeout(wait, 200);
    })();
  }
  function formatMessage(m){
    const div=document.createElement('div');
    div.className='system-message system-message--global';
    div.textContent = m.text || '';
    return div;
  }
  ready(function(){
    ensureFirebase(function(){
      const containerId = 'system-messages-container';
      let container = document.getElementById(containerId);
      if(!container){
        container = document.createElement('div');
        container.id = containerId;
        document.body.prepend(container);
      }
      firebase.database().ref('/system_messages').on('value', function(snap){
        const data = snap.val() || {};
        container.innerHTML='';
        Object.values(data).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).forEach(m=>{
          if(m.variant === 'global'){
            container.appendChild(formatMessage(m));
          }
        });
      });
    });
  });
})();