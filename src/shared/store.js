// Gunline · Campaign save storage shared by both boards: canvas database, then browser storage, then memory.
// Methods are copied onto each board's Component (see src/shared/install.js); `this` is the game.
class GLStore {
  /* ───────────── CAMPAIGN ─────────────
     The campaign save is shared with the Operation board: one private record per player in the artifact's
     database, falling back to this browser's storage, then to this session only. */
  storeInit(cb0) {
    if (typeof window === 'undefined') return;
    const cb = (v) => setTimeout(() => cb0(v), 0);
    const LS = 'gunline.campaign.v1';
    this.store = { mode: 'memory', ref: null, mem: null };
    const lsGet = () => { try { const t = window.localStorage.getItem(LS); return t ? JSON.parse(t) : null; } catch (e) { return undefined; } };
    const useLocal = () => {
      const v = lsGet();
      if (v === undefined) { this.store.mode = 'memory'; cb(null); return; }
      this.store.mode = 'local'; cb(v);
      try { window.addEventListener('storage', (e) => { if (e.key === LS) { try { cb(e.newValue ? JSON.parse(e.newValue) : null); } catch (x) { /* ignore */ } } }); } catch (e) { /* ignore */ }
    };
    const cl = window.claude;
    if (!cl || typeof cl.use !== 'function') { useLocal(); return; }
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; useLocal(); } }, 5000);
    // With a viewer id the save is private to each player; without one it is the canvas's single campaign record,
    // which only people who can edit the canvas may write (anyone else drops back to browser storage on their first save).
    Promise.all([cl.use('db'), cl.use('user')]).then((r) => {
      const db = r[0], user = r[1];
      if (!db) throw new Error('no store');
      const idp = user && typeof user.id === 'function' ? user.id().catch(() => null) : Promise.resolve(null);
      return idp.then((uid) => { this.store.shared = !uid; return db.doc(uid ? 'data/users/' + uid + '/gunline_campaign' : 'gunline/campaign'); });
    }).then((ref) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      this.store.mode = 'db'; this.store.ref = ref;
      this.store.unsub = ref.onSnapshot((snap) => { if (this.store.mode === 'db') cb(snap.exists ? JSON.parse(JSON.stringify(snap.data())) : null); }, () => { if (this.store.mode === 'db') { this.store.mode = 'local'; useLocal(); } });
    }).catch(() => { if (!settled) { settled = true; clearTimeout(timer); useLocal(); } });
  }

  storeSave(obj) {
    const data = JSON.parse(JSON.stringify(obj));
    if (this.store && this.store.mode === 'db' && this.store.ref) this.store.ref.set(data).catch(() => { this.store.mode = 'local'; try { if (this.store.unsub) this.store.unsub(); } catch (e) { /* ignore */ } if (this.onStoreMode) this.onStoreMode('local'); });
    try { window.localStorage.setItem('gunline.campaign.v1', JSON.stringify(data)); } catch (e) { if (this.store) this.store.mem = data; }
  }
}
