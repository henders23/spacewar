// Gunline · Turn flow: plotting state, orders, movement, torpedo runs and the dice-driven resolution driver.
// Methods are copied onto each board's Component (see src/shared/install.js); `this` is the game.
class GLTurn {
  /* ───────────── GAME FLOW ───────────── */
  newGame(silent, mission) {
    this.mission = mission || null;
    this.buildRoster(mission ? mission.roster : this.skirmishRoster());
    const S = this.D.SHIPS, ships = {};
    this.ids().forEach((id) => { ships[id] = this.mkShip(S[id]); });
    this.g = { turn: 1, phase: 'orders', side: 'concord', plotting: this.ids()[0], ships: ships, orders: {}, drafts: {}, dest: null, log: [], winner: null, overText: '', debrief: null };
    this.g.feat = mission ? JSON.parse(JSON.stringify(mission.features || {})) : {};
    this.g.torps = []; this.g.torpN = 0; this.ui.torp = false;
    this.ui.hover = null;
    this.anim = null;
    this.fx.forEach((f) => f.kill && f.kill());
    this.fx = [];
    this.g.summary = ''; this.g.taken = this.perShip(() => 0);
    this.g.turnRolls = this.perShip(() => []); this.g.tray = []; this.g.pending = null; this.g.floaters = this.perShip(() => []);
    this.seq = null; this.rolling = null; this.seqId = (this.seqId || 0) + 1; this.ui.tip = null;
    this.startPlotting('concord');
    if (this.three) {
      this.syncShipObjs();
      Promise.all(this.loadNeededModels()).then(() => { this.inspDirty = true; });
      this.placeShips();
      this.ids().forEach((id) => { const o = this.three.objs[id]; o.model.visible = true; o.glow.visible = true; o.ring.visible = true; o.dmgKey = null; o.list = 0; o.rollAmp = 0; o.ring.material.color.setHex(this.D.SHIPS[id].hex); });
      this.buildFeatures();
      this.syncTorps();
      this.killCam = null;
      this.frameShips(); this.refreshOverlays();
    }
    if (!silent) this.bump();
  }

  // Ships that join mid-battle arrive at the start of their turn.
  spawnArrivals() {
    const g = this.g;
    this.ids().forEach((id) => {
      const s = g.ships[id], d = s.def;
      if (!s.away || d.spawn > g.turn) return;
      if (d.spawnIf === 'freightersRemain' && !this.ids().some((k) => g.ships[k].def.cls === 'freighter' && this.active(g.ships[k]))) { s.away = false; s.fled = true; return; }
      s.away = false; s.x = d.start.x; s.y = d.start.y; s.h = d.start.h;
      this.floater(id, 'word', 'Arrives', 0);
    });
    this.placeShips();
  }

  startPlotting(side) {
    const g = this.g, list = this.ctrl(side);
    g.side = side; g.drafts = {}; g.dest = null;
    g.plotting = list[0] || g.plotting;
    this.ui.order = 'steady'; this.ui.torp = false;
    this.ui.target = this.defaultTarget(g.plotting);
    this.ui.sel = g.plotting;
    this.inspDirty = true;
  }

  switchPlot(id) {
    const g = this.g, d = g.drafts[id];
    g.plotting = id; g.dest = d ? d.dest : null;
    this.ui.order = d ? d.order : 'steady'; this.ui.torp = !!(d && d.torp);
    this.ui.target = d && d.target ? d.target : this.defaultTarget(id);
    this.ui.sel = id; this.inspDirty = true; this.ui.hover = null;
    this.refreshOverlays();
    this.bump();
  }

  defaultTarget(id) { const t = (this.g.lastTarget || {})[id]; return t && t !== 'auto' && this.active(this.g.ships[t]) ? t : 'auto'; }


  setTarget(id) {
    const g = this.g;
    if (g.phase !== 'orders') return;
    this.unlockAudio();
    this.ui.target = id;
    if (g.drafts[g.plotting]) g.drafts[g.plotting].target = id;
    g.lastTarget = g.lastTarget || {}; g.lastTarget[g.plotting] = id;
    this.refreshOverlays();
    this.bump();
  }

  allDrafted() { const g = this.g; return this.ctrl(g.side).every((id) => !!g.drafts[id]); }

  nextUndrafted() { const g = this.g, list = this.ctrl(g.side), i = list.indexOf(g.plotting); for (let k = 1; k <= list.length; k++) { const id = list[(i + k) % list.length]; if (!g.drafts[id]) return id; } return null; }


  shipAt(p) {
    const ids = this.ids();
    for (let i = 0; i < ids.length; i++) { const s = this.g.ships[ids[i]]; if (!s.dead && Math.hypot(s.x - p.x, s.y - p.y) < s.def.len * 0.56) return ids[i]; }
    return null;
  }


  pushLog(head, entries) { this.g.log.unshift({ head: head, entries: entries }); if (this.g.log.length > 30) this.g.log.pop(); }


  setDest(mx, my) {
    const g = this.g;
    if (g.phase !== 'orders') return;
    const s = g.ships[g.plotting];
    g.dest = this.clampDest(s, this.ui.order, mx, my);
    g.drafts[g.plotting] = { dest: g.dest, order: this.ui.order, target: this.ui.target, torp: this.ui.torp };
    this.refreshOverlays();
    this.bump();
  }

  // Undo the plotted course for the ship being plotted (its order and target choice stay selected).
  clearPlot() {
    const g = this.g;
    if (g.phase !== 'orders' || !g.drafts[g.plotting]) return;
    delete g.drafts[g.plotting]; g.dest = null;
    this.refreshOverlays(); this.bump();
  }

  // A light copy of a ship for the replay log: where it was and what it was when the effect played.
  snapShip(s) { return s ? { id: s.id, def: s.def, x: s.x, y: s.y, h: s.h, hull: s.hull, crits: s.crits.slice() } : s; }

  // Torpedo target: the priority target if it is within launch range, otherwise the nearest enemy in range.
  torpTarget(s, tid) {
    const g = this.g, R0 = this.D.TORP.range, dist = (t) => Math.hypot(t.x - s.x, t.y - s.y);
    const t = tid && tid !== 'auto' ? g.ships[tid] : null;
    if (t && this.active(t) && t.def.side !== s.def.side && dist(t) <= R0) return t;
    const c = this.sideShips(this.enemySide(s.def.side)).map((k) => g.ships[k]).filter((x) => dist(x) <= R0).sort((a, b) => dist(a) - dist(b));
    return c[0] || null;
  }

  canTorp(s) { return !!s && (s.torps || 0) > 0 && this.active(s) && !this.count(s, 'bridge') && !!this.torpTarget(s, this.ui.target); }


  toggleTorp() {
    const g = this.g;
    this.unlockAudio();
    if (g.phase !== 'orders') return;
    const s = g.ships[g.plotting];
    this.ui.torp = !this.ui.torp && this.canTorp(s);
    if (g.drafts[g.plotting]) g.drafts[g.plotting].torp = this.ui.torp;
    this.refreshOverlays();
    this.bump();
  }

  pickOrder(id) {
    const g = this.g;
    this.unlockAudio();
    if (g.phase !== 'orders') return;
    this.ui.order = id;
    if (g.dest) { const s = g.ships[g.plotting]; g.dest = this.clampDest(s, id, g.dest.x, g.dest.y); g.drafts[g.plotting] = { dest: g.dest, order: id, target: this.ui.target, torp: this.ui.torp }; }
    this.refreshOverlays();
    this.bump();
  }

  commitOrders() {
    const g = this.g;
    this.unlockAudio();
    if (g.phase !== 'orders' || !this.allDrafted()) return;
    this.ctrl(g.side).forEach((id) => { g.orders[id] = { order: g.drafts[id].order, dest: g.drafts[id].dest, target: g.drafts[id].target || 'auto', torp: !!g.drafts[id].torp }; });
    g.dest = null; this.ui.hover = null; this.ui.order = 'steady'; this.ui.torp = false;
    if (g.side === 'concord') {
      if (this.modeHot()) { g.phase = 'handoff'; g.drafts = {}; this.refreshOverlays(); this.bump(); return; }
      this.aiOrders('reaver');
    }
    this.beginMovement();
  }

  beginMovement() {
    const g = this.g;
    g.phase = 'moving';
    this.autoOrders();
    g.taken = this.perShip(() => 0); g.turnRolls = this.perShip(() => []); g.floaters = this.perShip(() => []);
    this.ui.tip = null;
    const ent = [];
    this.ids().forEach((id) => {
      const s = g.ships[id], o = g.orders[id];
      if (!o || !this.active(s)) { delete g.orders[id]; return; }
      if (g.feat && g.feat.well && !s.def.static) o.dest = this.bend(o.dest);
      o.path = this.path(s, o.dest);
      const ord = this.D.ORDERS.filter((x) => x.id === o.order)[0];
      ent.push({ side: id, text: s.def.name + ': ' + ord.label + ' — moves ' + o.path.d.toFixed(1) + 'u.' });
    });
    this.pushLog('TURN ' + g.turn, ent);
    // Replay log for this turn: start poses and paths now, effects as they play.
    g.replay = { turn: g.turn, start: {}, paths: {}, fx: [] };
    this.ids().forEach((id) => { const s = g.ships[id]; g.replay.start[id] = { x: s.x, y: s.y, h: s.h }; if (g.orders[id] && g.orders[id].path) g.replay.paths[id] = g.orders[id].path; });
    this.launchTorps();
    this.syncTorps(); this.placeTorps(0, false);
    this.anim = { kind: 'move', t0: performance.now(), dur: 2600 / this.speedMul() };
    this.userCam = false;
    g.shieldUsed = {}; g.boarding = null;
    this.ids().forEach((id) => { g.ships[id].boardedThisTurn = false; });
    this.engineHum(true);
    if (g.turn === 1) this.sfx('vo_sighted', 0.9, 0.3, 1);
    this.refreshOverlays();
    this.bump();
  }

  // Launch new torpedoes from the bow, then plan this move for every torpedo in flight. Each turns up to 60°
  // toward where its target was when orders were given, then runs its full speed; if the run passes within reach
  // of where the target ends its move, it hits. A torpedo whose target is gone re-homes on the nearest enemy within 30u.
  launchTorps() {
    const g = this.g, TP = this.D.TORP;
    g.torps = (g.torps || []).filter((t) => !t.gone);
    this.ids().forEach((id) => {
      const s = g.ships[id], o = g.orders[id];
      if (!o || !o.torp || !(s.torps > 0) || !this.active(s) || this.count(s, 'bridge')) return;
      const tg = this.torpTarget(s, o.target); if (!tg) return;
      s.torps -= 1; g.torpN = (g.torpN || 0) + 1;
      const bow = s.def.len * 0.55;
      g.torps.push({ id: 't' + g.torpN, side: s.def.side, owner: id, target: tg.id, x: s.x + Math.cos(s.h) * bow, y: s.y + Math.sin(s.h) * bow, h: s.h, life: TP.life, fresh: true });
      g.turnRolls[id].push({ owner: id, label: s.def.name + ' launches a torpedo', result: 'at ' + tg.def.name + ' · ' + s.torps + ' left', dice: [] });
      this.sfx('grav_lance', 0.4, 0.1, 1.6);
    });
    const endOf = (k) => { const o = g.orders[k]; return o && o.path ? o.path.at(1) : g.ships[k]; };
    g.torps.forEach((t) => {
      let T = g.ships[t.target];
      if (!this.active(T)) {
        const fx = this.sideShips(this.enemySide(t.side)).map((k) => g.ships[k]).filter((x) => Math.hypot(x.x - t.x, x.y - t.y) <= 30).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y));
        T = fx[0] || null; if (T) t.target = T.id;
      }
      t.from = { x: t.x, y: t.y, h: t.h };
      if (!T) { t.to = { x: t.x + Math.cos(t.h) * TP.speed, y: t.y + Math.sin(t.h) * TP.speed, h: t.h }; t.hit = false; t.life -= 1; return; }
      const run = this.torpRun(t, T, endOf(T.id), T.def);
      t.hit = run.hit; t.to = run.to;
      t.life -= 1;
    });
  }

  // One torpedo move. It steers (up to 60°) for where its target was when orders were given (aim), runs its full
  // speed, and strikes if the run passes within reach of where the target ends its move (end). Shared by the real
  // move and the plotting threat display, so the prediction is exact.
  torpRun(t, aim, end, targetDef) {
    const TP = this.D.TORP, want = Math.atan2(aim.y - t.y, aim.x - t.x), lim = TP.turn * Math.PI / 180;
    const h = t.h + Math.max(-lim, Math.min(lim, this.norm(want - t.h))), ux = Math.cos(h), uy = Math.sin(h);
    const along = Math.max(0, Math.min(TP.speed, (end.x - t.x) * ux + (end.y - t.y) * uy));
    const cx = t.x + ux * along, cy = t.y + uy * along, reach = TP.reach + targetDef.len * TP.reachK;
    const hit = Math.hypot(end.x - cx, end.y - cy) <= reach;
    return { hit: hit, reach: reach, h: h, full: { x: t.x + ux * TP.speed, y: t.y + uy * TP.speed }, to: hit ? { x: cx, y: cy, h: h } : { x: t.x + ux * TP.speed, y: t.y + uy * TP.speed, h: h } };
  }

  // Torpedoes reach the end of their run: hits are queued for gunnery, burnt-out or off-map ones are removed.
  landTorps() {
    const g = this.g, W = this.D.W / 2 + 10, H = this.D.H / 2 + 10;
    g.torpHits = [];
    (g.torps || []).forEach((t) => {
      if (!t.to) return;
      t.x = t.to.x; t.y = t.to.y; t.h = t.to.h; t.fresh = false;
      if (t.hit && this.active(g.ships[t.target])) { g.torpHits.push(t); t.gone = true; return; }
      if (t.life <= 0 || Math.abs(t.x) > W || Math.abs(t.y) > H) { t.gone = true; t.fizzled = true; }
    });
    g.torps = g.torps.filter((t) => !t.gone || g.torpHits.indexOf(t) >= 0);
    this.syncTorps();
  }


  afterMove() {
    this.engineHum(false);
    const g = this.g, moved = this.ids().filter((id) => g.orders[id] && g.orders[id].path);
    g.collided = false;
    moved.forEach((id) => { const s = g.ships[id], e = g.orders[id].path.at(1); s.x = e.x; s.y = e.y; s.h = this.norm(e.h); });
    // Disengagement: ending outside the arena means the ship has fled.
    moved.forEach((id) => {
      const s = g.ships[id];
      if (Math.abs(s.x) > this.D.W / 2 || Math.abs(s.y) > this.D.H / 2) {
        if (this.exitOk(s)) { s.escaped = true; this.floater(id, 'word', 'Escaped', 0); g.turnRolls[id].push({ owner: id, label: s.def.name + ' escapes', result: 'off the ' + this.mission.exit.edge + ' edge', dice: [] }); }
        else s.fled = true;
      }
    });
    this.featureHazards();
    this.landTorps();
    // Ram orders: an enemy within reach in the fore arc (priority target first) gets rammed during gunnery.
    g.rams = [];
    this.ids().forEach((id) => {
      const A = g.ships[id], o = g.orders[id];
      if (!o || o.order !== 'ram' || !this.active(A)) return;
      const reach = 4 + A.def.len * 0.5;
      const cands = this.sideShips(this.enemySide(A.def.side)).map((k) => g.ships[k]).filter((B) => Math.hypot(B.x - A.x, B.y - A.y) <= reach && this.arcOf(A, B.x, B.y) === 'fore');
      if (!cands.length) return;
      const B = cands.filter((c) => c.id === o.target)[0] || cands.sort((a, b) => Math.hypot(a.x - A.x, a.y - A.y) - Math.hypot(b.x - A.x, b.y - A.y))[0];
      g.rams.push({ a: id, b: B.id });
    });
    const rammed = (a, b) => g.rams.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    // Accidental collisions between every other pair of ships still in the fight.
    const live = this.ids().filter((id) => this.active(g.ships[id]));
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const A = g.ships[live[i]], B = g.ships[live[j]], dist = Math.hypot(A.x - B.x, A.y - B.y);
      if (dist >= 4 || rammed(A.id, B.id)) continue;
      const foes = A.def.side !== B.def.side;
      const ramA = foes && A.def.ram && this.arcOf(A, B.x, B.y) === 'fore', ramB = foes && B.def.ram && this.arcOf(B, A.x, A.y) === 'fore';
      const toB = ramA ? this.d6() : 1 + Math.floor(Math.random() * 3), toA = ramB ? this.d6() : 1 + Math.floor(Math.random() * 3);
      A.hull = Math.max(0, A.hull - toA); B.hull = Math.max(0, B.hull - toB);
      g.taken[A.id] += toA; g.taken[B.id] += toB; g.collided = true;
      this.floater(A.id, 'hull', '−' + toA); this.floater(B.id, 'hull', '−' + toB);
      g.turnRolls[A.id].push({ owner: B.id, label: 'Collision with ' + B.def.name, result: (ramB ? 'Rammed: ' : '') + toA + ' damage', dice: [] });
      g.turnRolls[B.id].push({ owner: A.id, label: 'Collision with ' + A.def.name, result: (ramA ? 'Rammed: ' : '') + toB + ' damage', dice: [] });
      const ux = (B.x - A.x) / (dist || 1), uy = (B.y - A.y) / (dist || 1), push = (4 - dist) / 2;
      A.x -= ux * push; A.y -= uy * push; B.x += ux * push; B.y += uy * push;
      if (this.three) this.boom('x_small_orange', this.m2v((A.x + B.x) / 2, (A.y + B.y) / 2, 1.5), 4.5, 0.7);
      this.sfx('collision', 1); this.addShake(1.1); this.kick(A.id, 0.25); this.kick(B.id, -0.25);
    }
    // Tractor beams lock on once ships have settled: the priority target within range, otherwise the nearest enemy.
    g.tractors = [];
    this.ids().forEach((id) => {
      const A = g.ships[id], R0 = A.def.tractor;
      if (!R0 || !this.active(A)) return;
      const dist = (B) => Math.hypot(B.x - A.x, B.y - A.y);
      const c = this.sideShips(this.enemySide(A.def.side)).map((k) => g.ships[k]).filter((B) => !B.def.static && dist(B) <= R0);
      if (!c.length) return;
      const pt = g.orders[id] && g.orders[id].target, B = c.filter((b) => b.id === pt)[0] || c.sort((a, b) => dist(a) - dist(b))[0];
      g.tractors.push({ a: id, b: B.id });
    });
    this.placeShips();
    this.startGunnery();
  }


  startGunnery() {
    const g = this.g;
    g.phase = 'firing'; g.tray = []; g.pending = null;
    this.hitPts = {};
    this.rolling = null;
    this.seqId = (this.seqId || 0) + 1;
    this.seq = this.resolutionSeq();
    this.bump();
    this.advance(undefined);
  }

  advance(val) { if (this.seq) this.handle(this.seq.next(val)); }


  handle(r) {
    const id = this.seqId;
    while (!r.done) {
      const q = r.value;
      if (q.type === 'roll') {
        if (!this.autoAll && this.isHuman(q.owner)) { this.g.pending = q; this.bump(); return; }
        const dice = this.rollN(q.n);
        if (this.autoAll || !this.three) { r = this.seq.next(dice); continue; }
        this.tumble(q, dice, () => setTimeout(() => { if (this.alive && id === this.seqId) this.advance(dice); }, 420 / this.speedMul()));
        return;
      }
      if (q.type === 'choice') {
        if (this.autoAll || !this.isHuman(q.owner)) { r = this.seq.next(q.auto); continue; }
        this.g.pending = q; this.bump(); return;
      }
      if (q.type === 'fx') {
        if (this.autoAll || !this.three) { r = this.seq.next(); continue; }
        if (this.g.replay) this.g.replay.fx.push(Object.assign({}, q, { A: this.snapShip(q.A), B: this.snapShip(q.B), t: q.t ? Object.assign({}, q.t) : q.t, from: q.from ? Object.assign({}, q.from) : q.from }));
        const ms = this.playFx(q);
        setTimeout(() => { if (this.alive && id === this.seqId) this.advance(); }, ms);
        return;
      }
      r = this.seq.next();
    }
    this.seq = null;
    this.finishTurn();
  }

  // Player picked an option in a choice step (board / press on / withdraw).
  choose(v) {
    this.unlockAudio();
    const q = this.g.pending;
    if (!q || q.type !== 'choice') return;
    this.g.pending = null;
    this.advance(v);
  }

  // Player clicked "Roll".
  rollPending() {
    this.unlockAudio();
    const q = this.g.pending;
    if (!q || q.type !== 'roll' || this.rolling) return;
    const dice = this.rollN(q.n), id = this.seqId;
    this.tumble(q, dice, () => { if (id !== this.seqId) return; this.g.pending = null; this.advance(dice); });
  }

  // Floating combat text above a ship: 'shield' (blue number), 'hull' (yellow number), 'word' (critical damage), 'fire' (flame + yellow number).
  floater(id, kind, text, idx) {
    if (this.autoAll) return;
    const g = this.g;
    if (!g.floaters) g.floaters = this.perShip(() => []);
    g.floaters[id].push({ kind: kind, text: text, delay: (idx || 0) * 0.35 });
    this.bump();
  }

  critWord(c) {
    return { breach: 'Hull breach', fire: '', engines: 'Engines damaged', steering: 'Steering damaged', gundeck: 'Weapons damaged', bridge: 'Bridge hit' }[c.k];
  }

  record(rec, about) {
    const g = this.g;
    g.tray.push(rec);
    if (about) g.turnRolls[about].push(rec);
    if (!this.autoAll) this.bump();
  }

  finishTurn() {
    const g = this.g;
    g.pending = null;
    if (this.mission) {
      const res = this.missionCheck();
      if (res.over) {
        g.phase = 'over'; g.winner = res.won ? 'concord' : 'reaver'; g.debrief = res;
        this.endMission(res);
        this.anim = null; this.inspDirty = true; this.refreshOverlays(); this.bump();
        return;
      }
      g.turn += 1; g.phase = 'orders'; g.orders = {};
      this.spawnArrivals();
      this.startPlotting('concord');
      this.anim = null; this.inspDirty = true; this.refreshOverlays(); this.bump();
      return;
    }
    const cOut = this.sideShips('concord').length === 0, rOut = this.sideShips('reaver').length === 0;
    const fate = (side) => { const sh = this.ids().filter((id) => this.sideOf(id) === side).map((id) => g.ships[id]); return sh.every((x) => x.dead) ? 'destroyed' : sh.some((x) => x.captured) ? 'taken' : 'broken'; };
    if (cOut || rOut) {
      g.phase = 'over';
      if (cOut && rOut) { g.winner = 'draw'; g.overText = 'Both squadrons are out of the fight. Mutual destruction — nobody holds the field.'; }
      else if (rOut) { g.winner = 'concord'; g.overText = 'The Reaver squadron is ' + ({ destroyed: 'destroyed', taken: 'destroyed or taken', broken: 'broken and fleeing' })[fate('reaver')] + ' after ' + g.turn + ' turns. The Concord holds the field.'; }
      else { g.winner = 'reaver'; g.overText = 'The Concord squadron is ' + ({ destroyed: 'destroyed', taken: 'destroyed or taken', broken: 'broken and withdrawing' })[fate('concord')] + ' after ' + g.turn + ' turns. The Reavers claim the field.'; }
    } else {
      g.turn += 1; g.phase = 'orders'; g.orders = {};
      this.spawnArrivals();
      this.startPlotting('concord');
    }
    this.anim = null;
    this.inspDirty = true;
    this.refreshOverlays();
    this.bump();
  }
}
