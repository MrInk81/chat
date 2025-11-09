const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();


exports.onBanRequest = functions.database.ref('/moderation/ban_requests/{id}').onCreate(async (snap, ctx) => {
  const req = snap.val() || {};
  const uid = req.targetUid;
  const moderatorUid = req.moderatorUid;
  if (!uid || !moderatorUid) return null;

  const db = admin.database();
  const isAdminSnap = await db.ref('/admins/' + moderatorUid).get();
  const isModSnap = await db.ref('/mods/' + moderatorUid).get();
  if (!(isAdminSnap.val() || isModSnap.val())) {
    await snap.ref.update({status:'denied', reason:'not_admin_or_mod'});
    return null;
  }

  if (req.type === 'unban') {
    await db.ref('/bans/' + uid).remove();
    await db.ref('/system_messages').push({
      text: `System: Benutzer ${uid} wurde durch einen Moderator entbannt.`,
      createdAt: admin.database.ServerValue.TIMESTAMP,
      variant: 'global',
      style: { color: 'darkred', bubble: false },
      deletableBy: 'admins'
    });
    await snap.ref.update({status:'done'});
    return null;
  }

  const payload = req.type === 'perm' ? 
    { type:'perm', reason: req.reason || 'Verstoß', createdAt: Date.now(), moderatorUid } :
    { type:'temp', until: req.until || (Date.now()+24*60*60*1000), reason: req.reason || 'Verstoß', createdAt: Date.now(), moderatorUid };

  await db.ref('/bans/' + uid).set(payload);
  const text = req.type === 'perm' ?
    `System: Benutzer ${uid} wurde permanent gebannt!` :
    `System: Benutzer ${uid} wurde für 24 Stunden gebannt!`;
  await db.ref('/system_messages').push({
    text,
    createdAt: admin.database.ServerValue.TIMESTAMP,
    variant: 'global',
    style: { color: 'darkred', bubble: false },
    deletableBy: 'admins'
  });
  await snap.ref.update({status:'done'});
  return null;
});
