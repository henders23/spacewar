// Gunline · Resolution generators: rams, torpedoes, tractor beams, gunnery, boarding, structural failure.
// Methods are copied onto each board's Component (see src/shared/install.js); `this` is the game.
class GLCombat {
  *resolutionSeq() {
    const g = this.g;
    const pend = this.perShip(() => ({ dmg: 0, crits: [], shield: { fore: 0, port: 0, stbd: 0, aft: 0 } }));
    g.shieldUsed = {}; this.ids().forEach((id) => { g.shieldUsed[id] = pend[id].shield; });
    for (const rm of (g.rams || [])) yield* this.ramSeq(g.ships[rm.a], g.ships[rm.b]);
    for (const t of (g.torpHits || [])) yield* this.torpSeq(t);
    g.torps = (g.torps || []).filter((t) => !t.gone); this.syncTorps();
    for (const tr of (g.tractors || [])) yield* this.tractorSeq(g.ships[tr.a], g.ships[tr.b]);
    for (const id of this.ids()) {
      const A = g.ships[id];
      if (!this.active(A)) continue;
      yield* this.attackSeq(A, g.orders[id] ? g.orders[id].order : 'steady', pend);
    }
    // Simultaneous fire: damage lands only after every ship has fired.
    const before = this.perShip((id) => g.ships[id].hull);
    this.ids().forEach((id) => {
      const B = g.ships[id], o = pend[id];
      if (B.dead) return;
      B.hull = Math.max(0, B.hull - o.dmg);
      g.taken[id] += o.dmg;
      o.crits.forEach((c) => { if (c.k !== 'breach') B.crits.push(c); });
      let k = 0;
      if (o.dmg > 0 || o.crits.length) this.impact(id, o.dmg, o.crits.length);
      if (o.dmg > 0) this.floater(id, 'hull', '−' + o.dmg, k++);
      o.crits.forEach((c) => { if (c.k === 'fire') this.floater(id, 'fire', '', k++); else this.floater(id, 'word', this.critWord(c), k++); });
    });
    this.inspDirty = true;
    for (const id of this.ids()) { if (!g.ships[id].dead) yield* this.structural(g.ships[id], before[id]); }
    // Boarding: a ship within 6u of an enemy below half hull whose shield facing it is down may send a boarding party.
    const FNB = { fore: 'fore', port: 'port', stbd: 'starboard', aft: 'aft' };
    for (const id of this.ids()) {
      const A = g.ships[id];
      if (!this.active(A) || A.hull <= 0 || A.crew < 2 || A.boardedThisTurn) continue;
      const opts = this.sideShips(this.enemySide(A.def.side)).map((k) => g.ships[k]).filter((B) => B.hull > 0 && !B.boardedThisTurn && B.hull < B.def.hull / 2 && Math.hypot(B.x - A.x, B.y - A.y) <= 6 && this.shieldLeft(B, this.arcOf(B, A.x, A.y)) === 0);
      if (!opts.length) continue;
      const pt = g.orders[id] && g.orders[id].target, B = opts.filter((b) => b.id === pt)[0] || opts.sort((a, b) => a.crew - b.crew)[0];
      yield* this.boardSeq(A, B, FNB[this.arcOf(B, A.x, A.y)]);
    }
    // End phase: fires burn, then each side rolls damage control for its own ships.
    for (const id of this.ids()) {
      const s = g.ships[id];
      if (s.dead || s.fled || s.hull <= 0) continue;
      const fires = this.count(s, 'fire');
      if (fires > 0) {
        const hb = s.hull;
        s.hull = Math.max(0, s.hull - fires); g.taken[id] += fires;
        yield* this.structural(s, hb);
        this.floater(id, 'fire', '−' + fires);
        this.record({ owner: id, label: s.def.name + ' is burning', result: fires + ' fire damage', dice: [] }, id);
      }
      if (s.hull > 0 && s.crits.length) {
        const tns = s.crits.map((c) => (c.k === 'fire' ? (s.def.dcTeams ? 3 : 4) : (s.def.dcTeams ? 4 : 5)));
        const dice = yield { type: 'roll', owner: id, n: s.crits.length, label: s.def.name + ' · damage control', sub: s.crits.map((c, i) => this.critName(c) + ' ' + tns[i] + '+').join(' · ') };
        const keep = [];
        s.crits.forEach((c, i) => { if (dice[i] < tns[i]) keep.push(c); });
        this.record({ owner: id, label: s.def.name + ' · damage control', dice: dice.map((v, i) => ({ v: v, kind: v >= tns[i] ? 'save' : 'fail' })), result: (s.crits.length - keep.length) + ' of ' + s.crits.length + ' repaired' }, id);
        s.crits = keep;
        this.inspDirty = true;
      }
    }
    for (const id of this.ids()) {
      const s = g.ships[id];
      if (s.hull <= 0 && !s.dead) { s.dead = true; s.deadAt = performance.now(); this.record({ owner: id, label: s.def.name + ' is destroyed!', result: '', dice: [] }, id); yield { type: 'fx', kind: 'explode', ship: s }; }
    }
  }

  // One ship's gunnery. Each weapon fires at the closest enemy it can bear on (arc and range). Per target:
  // to-hit (firer rolls), that facing's shields (shared by all attackers this turn), armour saves (defender rolls), criticals (firer rolls).
  *attackSeq(A, oA, pend) {
    const g = this.g, FN = { fore: 'fore', port: 'port', stbd: 'starboard', aft: 'aft' };
    const enemies = this.sideShips(this.enemySide(A.def.side)).map((id) => g.ships[id]);
    if (!enemies.length) return;
    const groups = [], byId = {};
    const pid = g.orders[A.id] && g.orders[A.id].target, pref = pid && pid !== 'auto' && this.active(g.ships[pid]) ? g.ships[pid] : null;
    A.def.weapons.forEach((w) => {
      if (this.weaponDice(A, w, oA) <= 0) return;
      let best = null, bd = 1e9;
      // Priority target first, if this weapon can bear on it; otherwise the closest enemy it can bear on.
      if (pref) { const r = Math.hypot(pref.x - A.x, pref.y - A.y); if (r <= w.range && w.arcs.indexOf(this.arcOf(A, pref.x, pref.y)) >= 0 && !this.blocked(A, pref)) { best = pref; bd = r; } }
      if (!best) enemies.forEach((T) => {
        const r = Math.hypot(T.x - A.x, T.y - A.y);
        if (r > w.range || w.arcs.indexOf(this.arcOf(A, T.x, T.y)) < 0 || this.blocked(A, T)) return;
        if (r < bd) { bd = r; best = T; }
      });
      if (!best) return;
      if (!byId[best.id]) { byId[best.id] = { T: best, ws: [], r: bd }; groups.push(byId[best.id]); }
      byId[best.id].ws.push(w);
    });
    // Gunnery Master: with Lock On, the biggest volley this turn re-rolls its misses.
    let capW = null;
    if (A.def.capTrait === 'gunnery' && oA === 'lock') groups.forEach((G) => G.ws.forEach((w) => { if (!capW || this.weaponDice(A, w, oA) > this.weaponDice(A, capW, oA)) capW = w; }));
    if (!groups.length) {
      const T = this.nearestEnemy(A);
      this.record({ owner: A.id, label: A.def.name + ' · no weapons bear', result: T ? 'nearest enemy ' + Math.round(Math.hypot(T.x - A.x, T.y - A.y)) + 'u away' : '', dice: [] }, null);
      return;
    }
    groups.sort((a, b) => a.r - b.r);
    for (const grp of groups) {
      const B = grp.T, r = grp.r, oB = g.orders[B.id] ? g.orders[B.id].order : 'steady';
      const facing = this.arcOf(B, A.x, A.y), narrow = facing === 'fore' || facing === 'aft';
      const hits = [];
      let shVis = Math.max(0, (B.def.shields[facing] || 0) - pend[B.id].shield[facing]);
      for (const w of grp.ws) {
        const n = this.weaponDice(A, w, oA), tn = Math.min(6, this.toHitTN(r, narrow, oA, A) + this.defMod(B, r, w));
        const hit = (v) => v !== 1 && (v === 6 || v >= tn);
        const dice = yield { type: 'roll', owner: A.id, n: n, label: A.def.name + ' · ' + w.name + (w.lance ? ' (lance)' : '') + ' → ' + B.def.name + (pref && pref.id === B.id ? ' (target)' : ''), sub: n + 'd6 to hit, need ' + tn + '+' + (narrow ? ' (narrow profile)' : '') + ' · range ' + Math.round(r) + 'u' };
        let rr = 0;
        if (A.def.gunners && w.broadside) for (let k = 0; k < dice.length; k++) if (dice[k] === 1) { dice[k] = this.d6(); rr++; }
        let vetRe = 0;
        if (A.def.vet >= 2 && !(A.def.gunners && w.broadside)) { const k1 = dice.indexOf(1); if (k1 >= 0) { dice[k1] = this.d6(); vetRe = 1; } }
        let capRe = 0;
        if (w === capW) {
          const miss = []; dice.forEach((v, k) => { if (!hit(v)) miss.push(k); });
          if (miss.length) {
            const re = yield { type: 'roll', owner: A.id, n: miss.length, label: A.def.name + ' · ' + A.def.captain + ' re-rolls the misses', sub: 'Gunnery Master · ' + miss.length + 'd6, need ' + tn + '+' };
            miss.forEach((k, i) => { dice[k] = re[i]; }); capRe = miss.length;
          }
        }
        const nh = dice.filter(hit).length;
        this.record({ owner: A.id, label: A.def.name + ' · ' + w.name, dice: dice.map((v) => ({ v: v, kind: hit(v) ? (v === 6 ? 'crit' : 'hit') : 'miss' })), result: nh + ' hit' + (nh === 1 ? '' : 's') + ' (need ' + tn + '+)' + (rr ? ' · veteran crews re-rolled ' + rr + ' × 1' : '') + (capRe ? ' · Gunnery Master re-rolled ' + capRe + ' misses' : '') + (vetRe ? ' · veteran crew re-rolled a 1' : '') }, B.id);
        dice.forEach((v) => { if (hit(v)) hits.push({ v: v, lance: !!w.lance }); });
        yield { type: 'fx', kind: 'bolts', A: A, B: B, shots: dice.map((v) => { const h = hit(v), sh = h && !w.lance && shVis > 0; if (sh) shVis--; return { w: w, hit: h, onShield: sh }; }) };
      }
      if (!hits.length) continue;
      const P = pend[B.id], shield = Math.max(0, (B.def.shields[facing] || 0) - P.shield[facing]);
      const normal = hits.filter((h) => !h.lance).sort((a, b) => a.v - b.v);
      const sh = Math.min(shield, normal.length);
      P.shield[facing] += sh;
      const through = normal.slice(sh).concat(hits.filter((h) => h.lance));
      this.record({ owner: B.id, label: B.def.name + ' · ' + FN[facing] + ' shields (' + shield + ' left)', result: sh > 0 ? 'absorb ' + sh + ' hit' + (sh === 1 ? '' : 's') : (shield ? 'only lance hits' : 'shields on this facing are spent'), dice: [] }, B.id);
      if (sh > 0) { this.floater(B.id, 'shield', '−' + sh); yield { type: 'fx', kind: 'shield', id: B.id }; }
      if (!through.length) continue;
      const plate = B.def.plating && !P.plated; if (plate) P.plated = true;
      const saveTN = Math.max(2, Math.min(6, B.def.armour - (oB === 'brace' ? 1 : 0) - (plate ? 1 : 0)));
      const crits6 = through.filter((h) => h.v === 6).length;
      const saves = yield { type: 'roll', owner: B.id, n: through.length, label: B.def.name + ' · armour saves', sub: through.length + 'd6, need ' + saveTN + '+' + (oB === 'brace' ? ' (braced)' : '') + (crits6 ? ' · ' + crits6 + ' critical hit' + (crits6 === 1 ? '' : 's') + ' at risk' : '') };
      let dmg = 0;
      const critHits = [];
      through.forEach((h, i) => { const sv = saves[i]; if (sv === 1 || sv < saveTN) { dmg += h.lance ? 2 : 1; if (h.v === 6) critHits.push(h); } });
      this.record({ owner: B.id, label: B.def.name + ' · armour saves', dice: saves.map((v) => ({ v: v, kind: v !== 1 && v >= saveTN ? 'save' : 'fail' })), result: dmg + ' damage' }, B.id);
      for (let i = 0; i < critHits.length; i++) {
        const c = (yield { type: 'roll', owner: A.id, n: 1, label: A.def.name + ' · critical hit on ' + B.def.name, sub: '1d6 on the critical table' })[0];
        const crit = { k: this.D.CRITKEY[c], roll: c };
        let extra = '';
        if (crit.k === 'gundeck') {
          const sd = (yield { type: 'roll', owner: A.id, n: 1, label: A.def.name + ' · which gun deck?', sub: '1–3 port, 4–6 starboard' })[0];
          crit.side = sd <= 3 ? 'port' : 'stbd'; extra = ' (' + (sd <= 3 ? 'port' : 'starboard') + ', rolled ' + sd + ')';
        }
        if (crit.k === 'breach') dmg += 1;
        P.crits.push(crit);
        this.record({ owner: A.id, label: 'Critical on ' + B.def.name, dice: [{ v: c, kind: 'crit' }], result: this.D.CRIT[c] + extra }, B.id);
      }
      P.dmg += dmg;
    }
  }

  // Torpedo strike: point defence may shoot it down (4+); otherwise 2d6 damage ignoring shields and armour,
  // halved by Brace for Impact, and a double is also a critical hit.
  *torpSeq(t) {
    const g = this.g, A = g.ships[t.owner], B = g.ships[t.target];
    if (!this.active(B)) return;
    const who = A ? A.def.name : 'A torpedo', owner = A ? A.id : B.id;
    if (B.def.pd) {
      const pd = (yield { type: 'roll', owner: B.id, n: 1, label: B.def.name + ' · point defence vs torpedo', sub: '1d6: 4+ shoots it down' })[0];
      this.record({ owner: B.id, label: B.def.name + ' · point defence', dice: [{ v: pd, kind: pd >= 4 ? 'save' : 'fail' }], result: pd >= 4 ? 'torpedo destroyed' : 'missed' }, B.id);
      if (pd >= 4) { yield { type: 'fx', kind: 'torpKill', B: B, t: t }; this.floater(B.id, 'word', 'Torpedo shot down', 0); return; }
    }
    const TP = this.D.TORP, dtxt = TP.dice + 'd6' + (TP.plus ? '+' + TP.plus : '');
    const d = yield { type: 'roll', owner: owner, n: TP.dice, label: who + ' · TORPEDO → ' + B.def.name, sub: dtxt + ' damage · ignores shields and armour · ' + (TP.dice > 1 ? 'a double' : 'a 6') + ' is a critical hit' };
    const braced = g.orders[B.id] && g.orders[B.id].order === 'brace', raw = d.reduce((a, v) => a + v, 0) + TP.plus;
    let dmg = braced ? Math.floor(raw / 2) : raw, extra = '';
    yield { type: 'fx', kind: 'torpedo', B: B, t: t };
    const bB = B.hull;
    if (TP.dice > 1 ? d[0] === d[1] : d[0] === 6) {
      const c = (yield { type: 'roll', owner: owner, n: 1, label: who + ' · critical hit on ' + B.def.name, sub: 'Torpedo double · 1d6 on the critical table' })[0];
      const crit = { k: this.D.CRITKEY[c], roll: c };
      if (crit.k === 'gundeck') crit.side = this.d6() <= 3 ? 'port' : 'stbd';
      if (crit.k === 'breach') dmg += 1; else B.crits.push(crit);
      extra = ' · critical: ' + this.D.CRIT[c];
      if (crit.k === 'fire') this.floater(B.id, 'fire', '', 2); else this.floater(B.id, 'word', this.critWord(crit), 2);
    }
    B.hull = Math.max(0, B.hull - dmg); g.taken[B.id] += dmg;
    this.floater(B.id, 'word', 'TORPEDO', 0); this.floater(B.id, 'hull', '−' + dmg, 1);
    this.record({ owner: owner, label: who + ' · torpedo hits ' + B.def.name, dice: d.map((v) => ({ v: v, kind: 'crit' })), result: dmg + ' damage' + (braced ? ' (braced: halved)' : '') + extra }, B.id);
    this.impact(B.id, dmg, extra ? 1 : 0);
    this.inspDirty = true;
    yield* this.structural(B, bB);
    if (B.hull <= 0 && !B.dead) { B.dead = true; B.deadAt = performance.now(); this.record({ owner: B.id, label: B.def.name + ' is destroyed!', result: '', dice: [] }, B.id); yield { type: 'fx', kind: 'explode', ship: B }; }
  }

  // Tractor beam: a roll-off, each side d6 + mass (battleship 2, cruiser 1); the beam wins ties. A win drags the
  // target 4u toward the beam ship (never inside collision distance) and holds it: −4u Speed on its next move.
  *tractorSeq(A, B) {
    const g = this.g;
    if (!this.active(A) || !this.active(B) || A.hull <= 0 || B.hull <= 0) return;
    const mass = (s) => (s.def.len >= 8 ? 2 : 1), mA = mass(A), mB = mass(B);
    const a = (yield { type: 'roll', owner: A.id, n: 1, label: A.def.name + ' · TRACTOR BEAM → ' + B.def.name, sub: '1d6 + ' + mA + ' (mass) · beats the target’s roll or ties to pull it in' })[0];
    const b = (yield { type: 'roll', owner: B.id, n: 1, label: B.def.name + ' · break the tractor lock', sub: '1d6 + ' + mB + ' (mass) · must beat ' + (a + mA) })[0];
    const won = a + mA >= b + mB;
    this.record({ owner: A.id, label: A.def.name + ' · tractor beam on ' + B.def.name, dice: [{ v: a, kind: won ? 'hit' : 'miss' }, { v: b, kind: won ? 'fail' : 'save' }], result: won ? (a + mA) + ' vs ' + (b + mB) + ': pulled in and held' : (a + mA) + ' vs ' + (b + mB) + ': breaks free' }, B.id);
    const from = { x: B.x, y: B.y };
    if (won) {
      const dx = A.x - B.x, dy = A.y - B.y, d = Math.hypot(dx, dy) || 1, pull = Math.max(0, Math.min(4, d - 4.2));
      B.x += dx / d * pull; B.y += dy / d * pull; B.heldTurn = g.turn + 1;
      this.floater(B.id, 'word', 'Tractor lock', 0);
    } else this.floater(B.id, 'word', 'Breaks free', 0);
    yield { type: 'fx', kind: 'tractor', A: A, B: B, from: from, won: won };
    this.placeShips();
    this.inspDirty = true;
  }

  // Ram: rammer rolls 1d6 + mass (+2 ram prow) against the target, ignoring shields and armour; rammer takes half a d6 (−1 with a ram prow).
  *ramSeq(A, B) {
    const g = this.g;
    if (!this.active(A) || !this.active(B)) return;
    const mass = A.def.len >= 8 ? 2 : 1, prow = A.def.ram ? 2 : 0;
    const d = (yield { type: 'roll', owner: A.id, n: 1, label: A.def.name + ' · RAM → ' + B.def.name, sub: '1d6 + ' + (mass + prow) + ' (mass' + (prow ? ' + ram prow' : '') + ') · ignores shields and armour' })[0];
    const back = (yield { type: 'roll', owner: A.id, n: 1, label: A.def.name + ' · ramming shock', sub: 'Your own damage: 1d6 halved, rounded up' + (prow ? ', −1 for the ram prow' : '') })[0];
    const toB = d + mass + prow, toA = Math.max(0, Math.ceil(back / 2) - (prow ? 1 : 0));
    // Drive the rammer into contact.
    const dx = B.x - A.x, dy = B.y - A.y, dd = Math.hypot(dx, dy) || 1, gap = (A.def.len + B.def.len) * 0.3;
    if (dd > gap) { A.x = B.x - dx / dd * gap; A.y = B.y - dy / dd * gap; }
    this.placeShips();
    yield { type: 'fx', kind: 'ram', A: A, B: B };
    const bB = B.hull, bA = A.hull;
    B.hull = Math.max(0, B.hull - toB); A.hull = Math.max(0, A.hull - toA);
    g.taken[B.id] += toB; g.taken[A.id] += toA;
    this.floater(B.id, 'word', 'RAMMED', 0); this.floater(B.id, 'hull', '−' + toB, 1);
    if (toA) this.floater(A.id, 'hull', '−' + toA);
    this.record({ owner: A.id, label: A.def.name + ' rams ' + B.def.name, dice: [{ v: d, kind: 'crit' }], result: toB + ' damage (no shields or saves)' }, B.id);
    this.record({ owner: A.id, label: A.def.name + ' · ramming shock', dice: [{ v: back, kind: 'fail' }], result: toA + ' damage to itself' }, A.id);
    this.inspDirty = true;
    yield* this.structural(B, bB);
    yield* this.structural(A, bA);
    for (const s2 of [B, A]) if (s2.hull <= 0 && !s2.dead) { s2.dead = true; s2.deadAt = performance.now(); this.record({ owner: s2.id, label: s2.def.name + ' is destroyed!', result: '', dice: [] }, s2.id); yield { type: 'fx', kind: 'explode', ship: s2 }; }
  }

  // Risk-style boarding odds. riskTable(a, d): outcome distribution of one exchange with a attacker dice (≤3) vs d defender dice (≤2).
  riskTable(a, d, atkTies) {
    this.riskT = this.riskT || {};
    const key = a + 'v' + d + (atkTies ? 't' : '');
    if (this.riskT[key]) return this.riskT[key];
    const out = {}, n = a + d, total = Math.pow(6, n);
    for (let i = 0; i < total; i++) {
      let x = i; const r = [];
      for (let k = 0; k < n; k++) { r.push(x % 6 + 1); x = Math.floor(x / 6); }
      const A = r.slice(0, a).sort((p, q) => q - p), D = r.slice(a).sort((p, q) => q - p);
      let al = 0, dl = 0;
      for (let k = 0; k < Math.min(a, d); k++) { if (A[k] > D[k] || (atkTies && A[k] === D[k])) dl++; else al++; }
      out[al + ',' + dl] = (out[al + ',' + dl] || 0) + 1 / total;
    }
    return (this.riskT[key] = out);
  }

  // Chance the boarders take the ship if they keep pressing the attack.
  // first: this is the first exchange of a boarding led by a Boarding Master (boarders win its ties).
  boardOdds(a, d, first, allTies) {
    this.oddsMemo = this.oddsMemo || {};
    if (d <= 0) return 1; if (a <= 0) return 0;
    if (allTies) {
      const k2 = 'T' + a + ',' + d; if (this.oddsMemo[k2] != null) return this.oddsMemo[k2];
      const t2 = this.riskTable(Math.min(3, a), Math.min(2, d), true); let p2 = 0;
      Object.keys(t2).forEach((k) => { const v = k.split(',').map(Number); p2 += t2[k] * this.boardOdds(a - v[0], d - v[1], false, true); });
      return (this.oddsMemo[k2] = p2);
    }
    if (first) { const t1 = this.riskTable(Math.min(3, a), Math.min(2, d), true); let p1 = 0; Object.keys(t1).forEach((k) => { const v = k.split(',').map(Number); p1 += t1[k] * this.boardOdds(a - v[0], d - v[1]); }); return p1; }
    const key = a + ',' + d;
    if (this.oddsMemo[key] != null) return this.oddsMemo[key];
    const t = this.riskTable(Math.min(3, a), Math.min(2, d));
    let p = 0;
    Object.keys(t).forEach((k) => { const v = k.split(',').map(Number); p += t[k] * this.boardOdds(a - v[0], d - v[1]); });
    return (this.oddsMemo[key] = p);
  }

  *boardSeq(A, B, facingName) {
    const g = this.g, pct = (x) => Math.round(x * 100) + '%';
    const max = A.crew - 1, half = Math.max(1, Math.ceil(max / 2)), bm = A.def.capTrait === 'boarding', elite = A.def.vet >= 3;
    const odds = (n) => this.boardOdds(n, B.crew, bm, elite);
    const options = [{ label: 'Board with ' + max + ' crew · ' + pct(odds(max)) + ' to capture', value: max, primary: true }];
    if (half < max) options.push({ label: 'Board with ' + half + ' · ' + pct(odds(half)), value: half });
    options.push({ label: 'Stand off', value: 0 });
    const party = yield { type: 'choice', owner: A.id, label: A.def.name + ' · boarding opportunity', sub: B.def.name + ' is below half hull with its ' + facingName + ' shield down. Your crew ' + A.crew + ' vs their ' + B.crew + '. Keep at least 1 aboard.' + (elite ? ' Elite crew: your boarders win every tie.' : bm ? ' ' + A.def.captain + ' leads: your boarders win ties in the first exchange.' : ''), options: options, auto: odds(max) >= 0.5 ? max : 0 };
    if (!party) return;
    A.boardedThisTurn = true; B.boardedThisTurn = true;
    A.crew -= party;
    const bd = g.boarding = { a: A.id, b: B.id, party: party, start: party, def: B.crew, defStart: B.crew, last: null };
    this.floater(B.id, 'word', 'BOARDERS AWAY', 0);
    yield { type: 'fx', kind: 'pods', A: A, B: B, n: party };
    let round = 0;
    while (bd.party > 0 && bd.def > 0) {
      const an = Math.min(3, bd.party), dn = Math.min(2, bd.def), tieA = elite || (bm && round === 0); round++;
      const ad = (yield { type: 'roll', owner: A.id, n: an, label: 'Boarding ' + B.def.name + ' · assault', sub: an + 'd6 for ' + bd.party + ' boarders · highest vs highest, ' + (tieA ? 'ties go to the boarders this exchange (' + (elite ? 'elite crew' : 'Boarding Master') + ')' : 'ties go to the defender') }).slice().sort((x, y) => y - x);
      const dd = (yield { type: 'roll', owner: B.id, n: dn, label: B.def.name + ' · defenders hold the corridors', sub: dn + 'd6 for ' + bd.def + ' defenders' }).slice().sort((x, y) => y - x);
      let al = 0, dl = 0;
      for (let k = 0; k < Math.min(an, dn); k++) { if (ad[k] > dd[k] || (tieA && ad[k] === dd[k])) dl++; else al++; }
      bd.party -= al; bd.def -= dl; B.crew = bd.def;
      bd.last = { a: ad, d: dd, al: al, dl: dl };
      this.record({ owner: A.id, label: 'Boarding ' + B.def.name + ' · boarders', dice: ad.map((v, k) => ({ v: v, kind: k < dn ? (v > dd[k] || (tieA && v === dd[k]) ? 'hit' : 'miss') : 'miss' })), result: 'kill ' + dl + ' · lose ' + al }, B.id);
      this.record({ owner: B.id, label: 'Boarding ' + B.def.name + ' · defenders', dice: dd.map((v, k) => ({ v: v, kind: k < an ? (v > ad[k] || (!tieA && v === ad[k]) ? 'save' : 'fail') : 'save' })), result: bd.party + ' boarders vs ' + bd.def + ' left' }, B.id);
      yield { type: 'fx', kind: 'melee', B: B, n: al + dl };
      if (bd.party > 0 && bd.def > 0) {
        const p = this.boardOdds(bd.party, bd.def, false, elite);
        const go = yield { type: 'choice', owner: A.id, label: 'Boarding ' + B.def.name + ' · ' + bd.party + ' boarders vs ' + bd.def + ' defenders', sub: 'Press on and you take the ship ' + pct(p) + ' of the time. Withdraw and the survivors return.', options: [{ label: 'Press the attack · ' + pct(p), value: 1, primary: true }, { label: 'Withdraw', value: 0 }], auto: p >= 0.4 ? 1 : 0 };
        if (!go) break;
      }
    }
    if (bd.def <= 0) {
      B.captured = true; B.capturedBy = A.def.side; B.crew = bd.party;
      this.floater(B.id, 'word', 'CAPTURED', 0);
      this.record({ owner: A.id, label: B.def.name + ' strikes its colours', result: 'Captured · ' + bd.party + ' prize crew aboard', dice: [] }, B.id);
      yield { type: 'fx', kind: 'captured', A: A, B: B };
    } else {
      A.crew += bd.party;
      this.floater(B.id, 'word', bd.party > 0 ? 'Boarders withdraw' : 'Boarders repelled', 0);
      this.record({ owner: B.id, label: 'Boarding of ' + B.def.name + ' fails', result: bd.party + ' boarders return to ' + A.def.name, dice: [] }, B.id);
    }
    g.boarding = null;
    this.inspDirty = true;
  }

  // Structural failure: the first time hull falls to 2/3 and to 1/3 of its starting value (rounded down),
  // the ship suffers an extra critical. The damaged ship's own player rolls it.
  *structural(s, before) {
    const H = s.def.hull, marks = [Math.floor(H * 2 / 3), Math.floor(H / 3)];
    for (const m of marks) {
      if (!(before > m && s.hull <= m && s.hull > 0)) continue;
      const c = (yield { type: 'roll', owner: s.id, n: 1, label: s.def.name + ' · structural failure', sub: 'Hull fell to ' + m + ' or below — 1d6 on the critical table' })[0];
      const crit = { k: this.D.CRITKEY[c], roll: c };
      let extra = '';
      if (crit.k === 'gundeck') {
        const sd = (yield { type: 'roll', owner: s.id, n: 1, label: s.def.name + ' · which gun deck?', sub: '1–3 port, 4–6 starboard' })[0];
        crit.side = sd <= 3 ? 'port' : 'stbd'; extra = ' (' + (sd <= 3 ? 'port' : 'starboard') + ')';
      }
      if (crit.k === 'breach') { s.hull = Math.max(0, s.hull - 1); this.g.taken[s.id] += 1; } else s.crits.push(crit);
      this.floater(s.id, 'word', 'Structural failure', 0);
      if (crit.k === 'fire') this.floater(s.id, 'fire', '', 1); else this.floater(s.id, 'word', this.critWord(crit), 1);
      this.record({ owner: s.id, label: s.def.name + ' · structural failure (hull ≤ ' + m + ')', dice: [{ v: c, kind: 'crit' }], result: this.D.CRIT[c] + extra }, s.id);
      this.impact(s.id, 0, 1);
      this.inspDirty = true;
    }
  }
}
