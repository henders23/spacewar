// Gunline · Expected-damage maths for the firing preview and the AI.
// Methods are copied onto each board's Component (see src/shared/install.js); `this` is the game.
class GLPreview {

  /* ───────────── FIRING PREVIEW ─────────────
     Exact expected damage for one volley under the real rules: targeting (priority, else closest that bears),
     to-hit (range, narrow profile, orders, bridge), the target's facing shield (by hit distribution), armour saves,
     lances (2 damage, ignore shields). Criticals and shields already spent by other attackers are not counted. */
  expectedVolley(A, targets, order, prefId) {
    const out = {}, groups = {};
    const pref = prefId && prefId !== 'auto' ? targets.filter((t) => t.id === prefId)[0] : null;
    A.def.weapons.forEach((w) => {
      const n = this.weaponDice(A, w, order); if (n <= 0) return;
      const bears = (T) => { const r = Math.hypot(T.x - A.x, T.y - A.y); return r <= w.range && w.arcs.indexOf(this.arcOf(A, T.x, T.y)) >= 0 && !this.blocked(A, T) ? r : -1; };
      let best = null, bd = 1e9;
      if (pref && bears(pref) >= 0) { best = pref; bd = bears(pref); }
      else targets.forEach((T) => { const r = bears(T); if (r >= 0 && r < bd) { bd = r; best = T; } });
      if (!best) return;
      (groups[best.id] = groups[best.id] || { T: best, r: bd, ws: [] }).ws.push({ w: w, n: n });
    });
    let capX = null;
    if (A.def.capTrait === 'gunnery' && order === 'lock') Object.keys(groups).forEach((k) => groups[k].ws.forEach((x) => { if (!capX || x.n > capX.n) capX = x; }));
    Object.keys(groups).forEach((tid) => {
      const G = groups[tid], T = G.T, facing = this.arcOf(T, A.x, A.y), narrow = facing === 'fore' || facing === 'aft';
      let dist = [1], lanceHits = 0;
      const parts = [];
      G.ws.forEach((x) => {
        const tn = Math.min(6, this.toHitTN(G.r, narrow, order, A) + this.defMod(T, G.r, x.w)), p0 = (7 - tn) / 6;
        let p = p0;
        if (A.def.gunners && x.w.broadside && tn > 1) p += p0 / 6;
        if (x === capX) p += (1 - p) * p0;
        parts.push((x.w.broadside ? (x.w.side === 'port' ? 'Port' : 'Stbd') : x.w.lance ? 'Lance' : 'Turrets') + ' ' + x.n + 'd6@' + tn + '+');
        if (x.w.lance) { lanceHits += x.n * p; return; }
        for (let i = 0; i < x.n; i++) { const nd = new Array(dist.length + 1).fill(0); dist.forEach((v, k) => { nd[k] += v * (1 - p); nd[k + 1] += v * p; }); dist = nd; }
      });
      const S = T.def.shields[facing] || 0;
      let through = 0; dist.forEach((v, k) => { through += v * Math.max(0, k - S); });
      const pFail = 1 - (7 - Math.max(2, Math.min(6, T.def.armour))) / 6;
      out[tid] = { dmg: pFail * (through + 2 * lanceHits), detail: parts.join(' · ') + ' · ' + ({ fore: 'fore', port: 'port', stbd: 'stbd', aft: 'aft' })[facing] + ' shield ' + S };
    });
    return out;
  }

  previewFrom(me, pose) {
    const g = this.g;
    const snap = (s, p) => ({ id: s.id, def: s.def, crits: s.crits, hull: s.hull, x: p.x, y: p.y, h: p.h });
    const A = snap(me, pose);
    const enemies = this.sideShips(this.enemySide(me.def.side)).map((id) => { const e = g.ships[id], d = this.env(e, 'steady').speed * 0.75; return snap(e, { x: e.x + Math.cos(e.h) * d, y: e.y + Math.sin(e.h) * d, h: e.h }); });
    const friends = this.sideShips(me.def.side).map((id) => { if (id === me.id) return A; const f = g.ships[id], d = g.drafts[id]; return snap(f, d ? this.path(f, d.dest).at(1) : f); });
    const deal = this.expectedVolley(A, enemies, this.ui.order, this.ui.target);
    const take = {};
    enemies.forEach((E) => { const v = this.expectedVolley(E, friends, 'steady', 'auto'); if (v[A.id]) take[E.id] = v[A.id]; });
    return { pose: pose, enemies: enemies, deal: deal, take: take };
  }

  /* ───────────── AI ───────────── */
  firepower(A, ax, ay, ah, B, bx, by, bh, order) {
    const sA = { x: ax, y: ay, h: ah, crits: A.crits, def: A.def, hull: A.hull };
    const sB = { x: bx, y: by, h: bh };
    const r = Math.hypot(bx - ax, by - ay);
    const arc = this.arcOf(sA, bx, by);
    const narrow = ['fore', 'aft'].indexOf(this.arcOf(sB, ax, ay)) >= 0;
    let normal = 0, lance = 0;
    A.def.weapons.forEach((w) => {
      if (w.arcs.indexOf(arc) < 0 || r > w.range) return;
      const tn = this.toHitTN(r, narrow, order, sA), h = this.weaponDice(sA, w, order) * (7 - tn) / 6;
      if (w.lance) lance += h; else normal += h;
    });
    const sh = B.def.shields[this.arcOf(sB, ax, ay)] || 0;
    return Math.max(0, normal - sh) + lance * 2.2;
  }
}
