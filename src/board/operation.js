// Gunline · Operation board: campaign map, briefings, drydock, captains. Save storage: src/shared/store.js.
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { mission: null, ship: null, slot: 'weapons', fit: {}, rep: {}, sv: null, mode: 'loading', confirmReset: false };
    this.storeInit((sv) => this.onSave(sv));
  }

  // The campaign save itself is read and written by src/shared/store.js (storeInit / storeSave).
  onStoreMode(mode) { this.setState({ mode: mode }); }

  onSave(sv) {
    const mode = this.store ? this.store.mode : 'memory';
    if (!sv || !sv.fleet) { sv = this.freshSave(); if (mode !== 'memory') this.storeSave(sv); }
    sv.fleet.forEach((f) => { if (f.cap === undefined) f.cap = this.capOf(f); });
    this.setState({ sv: sv, mode: mode });
  }

  write(sv, extra) { this.storeSave(sv); this.setState(Object.assign({ sv: sv }, extra || {})); }
  cur() { return this.state.sv || this.freshSave(); }
  copy() { return JSON.parse(JSON.stringify(this.cur())); }

  freshSave() {
    return { v: 1, op: 'iron_tide', credits: 600, renown: 0, done: {}, dockLeft: {}, current: null, mods: {}, results: {}, history: [], debrief: null,
      fleet: [
        { id: 'resolute', cls: 'resolute', name: 'CNS Resolute', hull: 14, crew: 8, crits: [], fit: {}, battles: 0, cap: 'varga' },
        { id: 'vigilant', cls: 'vigilant', name: 'CNS Vigilant', hull: 8, crew: 6, crits: [], fit: {}, battles: 0, cap: 'rheel' }
      ] };
  }

  data() {
    if (this.D) return this.D;
    const U = [
      { id: 'heavy_bs', slot: 'weapons', name: 'Heavy broadside batteries', cost: 300, effect: '+1 die on each broadside; Turn −5° from the extra mass' },
      { id: 'long_lance', slot: 'weapons', name: 'Long-focus lances', cost: 200, effect: 'Lance range +6u' },
      { id: 'torpedoes', slot: 'weapons', name: 'Torpedo tubes', cost: 350, effect: '+2 torpedoes per battle: launched from the bow at an enemy within 40u, 2d6 damage ignoring shields and armour' },
      { id: 'pd', slot: 'defence', name: 'Point-defence grid', cost: 150, effect: 'Enemy lances are −1 to hit this ship; shoots down incoming torpedoes on 4+' },
      { id: 'shields', slot: 'defence', name: 'Reinforced shield emitters', cost: 250, effect: '+1 fore shield' },
      { id: 'plating', slot: 'defence', name: 'Ablative plating', cost: 200, effect: 'Armour saves +1 against the first volley each turn' },
      { id: 'drives', slot: 'engines', name: 'Overcharged drives', cost: 200, effect: 'Speed +2u' },
      { id: 'thrusters', slot: 'engines', name: 'Vectored thrusters', cost: 150, effect: 'Turn +10°' },
      { id: 'marines', slot: 'crew', name: 'Marine detachment', cost: 120, effect: 'Crew +2 (bigger boarding parties, harder to board)' },
      { id: 'gunners', slot: 'crew', name: 'Veteran gun crews', cost: 250, effect: 'Re-roll 1s to hit with broadsides' },
      { id: 'dc_teams', slot: 'crew', name: 'Damage-control teams', cost: 150, effect: 'Criticals repaired on 4+ (Fire! on 3+)' },
      { id: 'ram', slot: 'special', name: 'Ram prow', cost: 180, effect: 'Ram damage +2; ramming shock −1' },
      { id: 'tractor', slot: 'special', name: 'Tractor beam', cost: 300, effect: 'After movement, roll off to drag an enemy within 8u up to 4u closer and hold it (−4u Speed next move)' },
      { id: 'ecm', slot: 'special', name: 'ECM suite', cost: 220, effect: 'Enemies at long range (>24u) are −1 to hit this ship' }
    ];
    const CLS = {
      resolute: { cls: 'Dominion-class battleship', hull: 14, crew: 8, slots: ['weapons', 'defence', 'engines', 'crew', 'special'] },
      vigilant: { cls: 'Valiant-class cruiser', hull: 8, crew: 6, slots: ['weapons', 'defence', 'engines', 'crew'] },
      maw: { cls: 'Ravager-class battleship', hull: 13, crew: 7, slots: ['weapons', 'engines', 'crew'] },
      carrion: { cls: 'Harrow-class raider', hull: 10, crew: 4, slots: ['weapons', 'engines', 'crew'] },
      hydra: { cls: 'Hydra-class tender', hull: 14, crew: 5, slots: ['defence', 'crew'] }
    };
    const CRIT = { breach: 'Hull Breach', fire: 'Fire!', engines: 'Engines Hit', steering: 'Steering Jammed', gundeck: 'Gun Deck Hit', bridge: 'Bridge Hit' };
    const M = {
      m1: { code: 'M1', name: 'Picket Line', type: 'FLEET ENGAGEMENT', x: 14, y: 45, brief: 'The Reaver vanguard is probing the Varn picket: the Maw of Ruin and its raider escort. Break them before the rest of the clan follows.', terrain: 'Open space, 160 × 110u',
        blocks: [['ENEMY', '#ff8a8a', ['Maw of Ruin (Ravager-class battleship)', 'Carrion Wing (Harrow-class raider)']],
                 ['OBJECTIVES', '#ffc94d', ['Destroy, capture or drive off both Reaver ships']],
                 ['REWARDS', '#7be3a4', ['+400 credits, +1 renown', 'Any ship you board and capture joins your fleet as a prize']]] },
      m2a: { code: 'M2A', name: 'Convoy Run', type: 'ESCORT', x: 43, y: 23, brief: 'Three ore freighters must cross the Varn shallows to the yards. Reaver raiders will come in from the north edge from turn 3.', terrain: 'Open space; freighters steam west at 12u a turn',
        blocks: [['ENEMY', '#ff8a8a', ['Two Harrow-class raiders arrive on turn 3', 'Maw of Ruin arrives on turn 5 if any freighter is still on the map']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: at least 2 freighters exit the west edge by turn 9', 'Secondary: all 3 get through']],
                 ['SPECIAL RULES', '#8cc4ff', ['Freighters have Hull 4, Shields 1 all round, no weapons, and hold their course']],
                 ['REWARDS', '#7be3a4', ['+250 credits per freighter saved', 'Secondary: +1 renown and Cmdr. Ama Okafor joins as a captain']],
                 ['IF YOU FAIL', '#ff8a8a', ['The yards cannot supply you: drydock prices +25% for the rest of the operation']]] },
      m2b: { code: 'M2B', name: 'Salvage Field', type: 'RAID', x: 43, y: 67, brief: 'A wrecked Concord cruiser lies in the Tessaly asteroid belt with its lance foci intact. Recover the salvage before the Reavers strip it.', terrain: 'Asteroid field: rocks block fire and hole hulls',
        blocks: [['ENEMY', '#ff8a8a', ['Two Harrow-class raiders', 'Proximity mines around the wreck (2d6 to any ship ending within 3u)']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: recover 2 of 3 salvage beacons (end a move within 5u), then exit the east edge by turn 12', 'Secondary: recover all 3']],
                 ['SPECIAL RULES', '#8cc4ff', ['A ship that ends its move inside an asteroid takes D3 (no saves)', 'Asteroids block line of fire between ships']],
                 ['REWARDS', '#7be3a4', ['+200 credits per beacon and +1 renown', 'Secondary: +150 credits']],
                 ['IF YOU FAIL', '#ff8a8a', ['The Reavers refit with the salvage: their lances get +6u range for the rest of the operation']]] },
      d1: { code: 'D1', name: 'Drydock Varn', type: 'DRYDOCK', x: 70, y: 45, dock: true, brief: 'Repair, recruit and refit before pushing into Reaver space. Use the drydock section below, then leave dock to unlock M3.', terrain: 'Safe harbour',
        blocks: [['SERVICES', '#8cc4ff', ['Hull 40 credits per point · criticals 60 each · crew 30 each', 'Upgrades from the catalogue']]] },
      m3: { code: 'M3', name: 'The Reaver Lair', type: 'PRIZE HUNT', x: 95, y: 45, brief: 'Prisoners point to the tender Mother Hydra, which refuels every Reaver raid. Take her intact.', terrain: 'Reaver station in a debris ring; the station guns fire at anything within 20u',
        blocks: [['ENEMY', '#ff8a8a', ['Mother Hydra (Hull 14, Crew 5, no guns, cannot move)', 'Lair Station: 4d6 turrets at 20u, all arcs', 'Maw of Ruin on guard']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: capture Mother Hydra by boarding by turn 10. Destroying her fails the mission', 'Secondary: cripple the Maw of Ruin']],
                 ['REWARDS', '#7be3a4', ['Mother Hydra joins your fleet', '+500 credits, +2 renown (+1 for the secondary)']],
                 ['IF YOU FAIL', '#ff8a8a', ['The Reavers keep their supply line: +1 Reaver raider in M4 and M5']]] },
      m4: { code: 'M4', name: 'Kessel Gate', type: 'BREAKTHROUGH', x: 120, y: 64, brief: 'The Reaver blockade line holds the only jump route to Station Aurel. Punch through it.', terrain: 'A gravity well in the centre drags every course toward it',
        blocks: [['ENEMY', '#ff8a8a', ['Maw of Ruin and two raiders across the middle of the map']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: get 2 ships off the east edge by turn 10', 'Secondary: lose no ships']],
                 ['REWARDS', '#7be3a4', ['+600 credits, +1 renown (+1 for the secondary)']],
                 ['IF YOU FAIL', '#ff8a8a', ['Ships still in the zone after turn 10 are captured']]] },
      d2: { code: 'D2', name: 'Forward Base Sela', type: 'DRYDOCK', x: 136, y: 24, dock: true, brief: 'Last chance to repair before the final battle. Leave dock to unlock M5.', terrain: 'Safe harbour',
        blocks: [['SERVICES', '#8cc4ff', ['Repairs only; no new upgrades (no shipyard)']]] },
      m5: { code: 'M5', name: 'Iron Tide', type: 'HOLD THE STATION', x: 150, y: 49, brief: 'The Maw of Ruin leads the Reaver tide against Station Aurel. Hold the station until the home fleet arrives.', terrain: 'Station Aurel in the centre (Hull 20, shields 3, 6d6 at 24u)',
        blocks: [['ENEMY', '#ff8a8a', ['Maw of Ruin as flagship (refitted, Hull 16) with a raider', 'Reinforcements on turns 4 and 7']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: Station Aurel survives 8 turns', 'Secondary: destroy or capture the Maw of Ruin']],
                 ['REWARDS', '#7be3a4', ['+800 credits, +3 renown (+1 for the secondary). Operation complete']]] }
    };
    const order = ['m1', 'm2a', 'm2b', 'd1', 'm3', 'm4', 'd2', 'm5'];
    // Captains: the same traits the battle board applies.
    const caps = [
      { id: 'varga', name: 'Capt. Ilse Varga', trait: 'Gunnery Master', effect: 'With Lock On, re-roll the misses of this ship’s biggest volley, once per turn.', join: 'With the squadron from the start' },
      { id: 'rheel', name: 'Capt. Tomas Rheel', trait: 'Daredevil', effect: 'All Ahead Full keeps this ship’s full Turn value.', join: 'With the squadron from the start' },
      { id: 'okafor', name: 'Cmdr. Ama Okafor', trait: 'Boarding Master', effect: 'This ship’s boarders win ties in the first exchange of every boarding action.', join: 'Joins after M2A if every freighter gets through', key: 'okafor' },
      { id: 'holt', name: 'Capt. Davin Holt', trait: 'Steady Hand', effect: 'Brace for Impact no longer halves this ship’s dice.', join: 'For hire at Forward Base Sela (300 credits)', key: 'holt' }
    ];
    this.D = { U: U, CLS: CLS, CRIT: CRIT, M: M, order: order, caps: caps, costs: { hull: 40, crit: 60, crew: 30 } };
    return this.D;
  }

  // Where the operation stands: each node's state, and which drydock (if any) the fleet is at.
  progress(sv) {
    const d = sv.done || {}, left = sv.dockLeft || {}, st = {};
    const after2 = !!(d.m2a || d.m2b);
    st.m1 = d.m1 ? d.m1 : 'open';
    ['m2a', 'm2b'].forEach((k) => { st[k] = d[k] ? d[k] : d.m1 ? 'open' : 'locked'; });
    st.d1 = after2 ? (left.d1 ? 'won' : 'dock') : 'locked';
    st.m3 = d.m3 ? d.m3 : left.d1 ? 'open' : 'locked';
    st.m4 = d.m4 ? d.m4 : d.m3 ? 'open' : 'locked';
    st.d2 = d.m4 ? (left.d2 ? 'won' : 'dock') : 'locked';
    st.m5 = d.m5 ? d.m5 : left.d2 ? 'open' : 'locked';
    const dock = !d.m1 ? 'start' : st.d1 === 'dock' ? 'd1' : st.d2 === 'dock' ? 'd2' : null;
    return { st: st, dock: dock, complete: !!d.m5 };
  }

  price(n) { const k = (this.cur().mods || {}).dockPrice || 1; return Math.round(n * k); }
  cls(f) { return this.data().CLS[f.cls] || this.data().CLS.carrion; }

  draftFit(f) { return this.state.fit[f.id] || f.fit || {}; }

  spentOf(st) {
    const D = this.data(), sv = this.cur(); let n = 0;
    sv.fleet.forEach((f) => {
      const r = st.rep[f.id] || {};
      n += this.price((r.hull || 0) * D.costs.hull + (r.crit || 0) * D.costs.crit + (r.crew || 0) * D.costs.crew);
      const dfit = st.fit[f.id]; if (!dfit) return;
      Object.keys(dfit).forEach((sl) => { if (dfit[sl] && dfit[sl] !== (f.fit || {})[sl]) { const u = D.U.filter((x) => x.id === dfit[sl])[0]; if (u) n += this.price(u.cost); } });
    });
    return n;
  }

  ship(id) { const sv = this.cur(); return sv.fleet.filter((f) => f.id === id)[0] || sv.fleet[0]; }

  setRep(id, key, delta) {
    const D = this.data(), f = this.ship(id), C = this.cls(f), rep = Object.assign({}, this.state.rep), r = Object.assign({ hull: 0, crit: 0, crew: 0 }, rep[id]);
    const lim = { hull: C.hull - f.hull, crit: (f.crits || []).length, crew: C.crew + ((this.draftFit(f).crew === 'marines') ? 2 : 0) - f.crew }[key];
    const next = Math.max(0, Math.min(lim, r[key] + delta));
    const st = { rep: Object.assign(rep, { [id]: Object.assign(r, { [key]: next }) }), fit: this.state.fit };
    if (this.spentOf(st) > this.cur().credits) return;
    this.setState({ rep: st.rep });
  }

  setFit(id, slot, uid) {
    const f = this.ship(id), fit = Object.assign({}, this.state.fit), nf = Object.assign({}, this.draftFit(f));
    if (uid) nf[slot] = uid; else delete nf[slot];
    fit[id] = nf;
    if (this.spentOf({ rep: this.state.rep, fit: fit }) > this.cur().credits) return;
    this.setState({ fit: fit });
  }

  // Apply the drafted work orders to the save. Heavy repairs or new upgrades keep a ship in dock for the next mission.
  confirmWork() {
    const sv = this.copy(), spent = this.spentOf(this.state);
    sv.fleet.forEach((f) => {
      const r = this.state.rep[f.id] || {}, df = this.state.fit[f.id];
      let fresh = false;
      if (df) { Object.keys(df).forEach((sl) => { if (df[sl] && df[sl] !== (f.fit || {})[sl]) fresh = true; }); f.fit = Object.assign({}, df); }
      const C = this.cls(f);
      f.hull = Math.min(C.hull, f.hull + (r.hull || 0));
      f.crits = (f.crits || []).slice(r.crit || 0);
      f.crew = f.crew + (r.crew || 0);
      if ((r.hull || 0) > 4 || fresh) f.sitsOut = true;
    });
    sv.credits = sv.credits - spent;
    this.write(sv, { rep: {}, fit: {} });
  }

  leaveDock() { const sv = this.copy(), p = this.progress(sv); if (!p.dock || p.dock === 'start') return; sv.dockLeft = Object.assign({}, sv.dockLeft, { [p.dock]: true }); this.write(sv, { rep: {}, fit: {}, mission: p.dock === 'd1' ? 'm3' : 'm5' }); }
  ready(k) { const sv = this.copy(); sv.current = k; this.write(sv); }
  standDown() { const sv = this.copy(); sv.current = null; this.write(sv); }
  toggleReserve(id) { const sv = this.copy(); sv.fleet.forEach((f) => { if (f.id === id) f.reserve = !f.reserve; }); this.write(sv); }
  recall() { const sv = this.copy(); sv.fleet.forEach((f) => { f.sitsOut = false; }); this.write(sv); }
  dismiss() { const sv = this.copy(); if (sv.debrief) sv.debrief.seen = true; this.write(sv); }
  restart() {
    if (!this.state.confirmReset) { this.setState({ confirmReset: true }); return; }
    this.write(this.freshSave(), { confirmReset: false, rep: {}, fit: {}, mission: 'm1', ship: 'resolute' });
  }

  // Saves from before captains had ids name them in text.
  capOf(f) {
    if (f.cap !== undefined) return f.cap || null;
    const t = String(f.captain || '');
    return (this.data().caps.filter((c) => t.indexOf(c.name.split(' ').pop()) >= 0)[0] || {}).id || null;
  }

  // Captains you can give a ship: the starting two, plus Okafor and Holt once earned, minus any lost with their ships.
  roster(sv) {
    const lost = sv.capsLost || [];
    return this.data().caps.filter((c) => (!c.key || sv[c.key]) && lost.indexOf(c.id) < 0).map((c) => c.id);
  }

  assignCap(shipId, capId) {
    const sv = this.copy();
    sv.fleet.forEach((f) => { if (capId && f.cap === capId) f.cap = null; });
    sv.fleet.forEach((f) => { if (f.id === shipId) f.cap = capId || null; });
    this.write(sv);
  }

  hireHolt() {
    const sv = this.copy(), P = this.progress(sv), fee = this.price(300);
    if (P.dock !== 'd2' || sv.holt || sv.credits - this.spentOf(this.state) < fee) return;
    sv.holt = true; sv.credits -= fee;
    this.write(sv);
  }

  vet(n) { n = n || 0; return n >= 6 ? 'Elite · ' + n + ' battles' : n >= 3 ? 'Veteran · ' + n + ' battles' : n >= 1 ? 'Trained · ' + n + ' battle' + (n === 1 ? '' : 's') : 'Green · no battles'; }

  renderVals() {
    const D = this.data(), st = this.state, sv = this.cur(), P = this.progress(sv);
    const fmt = (n) => Math.round(n).toLocaleString('en-GB');
    const spent = this.spentOf(st), left = sv.credits - spent;
    const firstOpen = D.order.filter((k) => P.st[k] === 'open' || P.st[k] === 'dock')[0] || 'm5';
    const mk = st.mission && D.M[st.mission] ? st.mission : (sv.current || firstOpen);
    const look = { won: ['COMPLETED', '#11301f', '#7be3a4', '#7be3a4'], failed: ['FAILED', '#3a1212', '#ff8a8a', '#ff8a8a'], skipped: ['NOT FLOWN', '#1a2335', '#93a3bf', '#5a6a86'], open: ['AVAILABLE', '#3a2a08', '#ffc94d', '#ffc94d'], dock: ['DRYDOCK', '#16243d', '#8cc4ff', '#5aa9ff'], locked: ['LOCKED', '#1a2335', '#93a3bf', '#5a6a86'], ready: ['READY TO LAUNCH', '#3a2a08', '#ffc94d', '#ffc94d'] };
    const stOf = (k) => (sv.current === k && P.st[k] === 'open' ? 'ready' : P.st[k]);
    const nodes = D.order.map((k) => {
      const m = D.M[k], s = stOf(k), L = look[s], on = mk === k, dock = !!m.dock;
      return {
        name: m.code + ' · ' + m.name, sub: s === 'ready' ? 'ready to launch' : m.type.toLowerCase(), subCol: L[3], glyph: dock ? '' : (s === 'won' ? '✓' : s === 'failed' ? '✗' : m.code.replace('M', '')),
        aria: m.code + ' ' + m.name + ', ' + L[0].toLowerCase(), pressed: on ? 'true' : 'false', pick: () => this.setState({ mission: k }),
        style: 'position: absolute; left: ' + (m.x / 1.6).toFixed(2) + '%; top: ' + (m.y / 0.9).toFixed(2) + '%; transform: translate(-50%, -22px); display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0; background: transparent; border: 0; cursor: pointer; min-width: 44px; min-height: 44px;',
        dotStyle: 'display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: ' + (dock ? '6px; transform: rotate(45deg)' : '50%') + '; font-family: JetBrains Mono, monospace; font-size: 13px; font-weight: 700; background: ' + (on ? L[3] : '#0d1220') + '; color: ' + (on ? '#070a12' : L[3]) + '; box-shadow: 0 0 0 2px ' + L[3] + (on ? ', 0 0 16px ' + L[3] : '') + ';'
      };
    });
    // Route lines: green for legs already flown.
    const flown = (a, b) => { const sa = P.st[a], sb = P.st[b]; return (sa === 'won' || sa === 'failed') && (sb === 'won' || sb === 'failed' || sb === 'dock'); };
    const legs = [['m1', 'm2a'], ['m1', 'm2b'], ['m2a', 'd1'], ['m2b', 'd1'], ['d1', 'm3'], ['m3', 'm4'], ['m4', 'd2'], ['d2', 'm5']];
    const rs = {}; legs.forEach((l, i) => { const sa = P.st[l[0]], sb = P.st[l[1]]; rs['l' + i] = flown(l[0], l[1]) ? 'stroke: #7be3a4' : (sa === 'won' || sa === 'failed') && sb === 'open' ? 'stroke: #ffc94d; stroke-dasharray: 1.6 1.2' : 'stroke: #33425f; stroke-dasharray: 1.6 1.2'; });

    const deploy = sv.fleet.filter((f) => !f.sitsOut && !f.reserve);
    const mm = D.M[mk], ms = stOf(mk), L = look[ms], res = (sv.results || {})[mk];
    const blocks = mm.blocks.map((b) => ({ title: b[0], col: b[1], items: b[2] }));
    if (res) blocks.unshift({ title: 'RESULT · TURN ' + res.turn, col: res.won ? '#7be3a4' : '#ff8a8a', items: res.lines.map((l) => (l.ok ? '✓ ' : '✗ ') + l.text).concat(['+' + res.credits + ' credits · +' + res.renown + ' renown']).concat(res.lost.length ? ['Lost: ' + res.lost.join(', ')] : []).concat(res.prizes.length ? ['Prizes: ' + res.prizes.join(', ')] : []) });
    const canReady = ms === 'open' && deploy.length > 0;
    const m = {
      code: mm.code, name: mm.name, type: mm.type, status: L[0], stBg: L[1], stFg: L[2], brief: mm.brief, terrain: mm.terrain,
      force: mm.dock ? 'Whole fleet' : deploy.length ? deploy.map((f) => f.name).join(' + ') : 'No ships ready',
      blocks: blocks, canReady: canReady, isReady: ms === 'ready',
      readyLabel: 'Ready the fleet for ' + mm.code, readyAct: () => this.ready(mk), standDown: () => this.standDown(),
      canLeave: ms === 'dock' && P.dock === mk, leaveLabel: 'Leave ' + mm.name + (mk === 'd1' ? ' and unlock M3' : ' and unlock M5'), leaveAct: () => this.leaveDock(),
      noLaunch: !canReady && ms !== 'ready' && !(ms === 'dock' && P.dock === mk),
      lockNote: ms === 'won' ? (mm.dock ? 'Fleet has left dock' : 'Mission complete') : ms === 'failed' ? 'Mission failed: the operation moves on' : ms === 'skipped' ? 'Not flown: you took the other fork' : ms === 'open' ? 'No ships ready: every ship is in dock or reserve' : 'Locked: complete the earlier missions first',
      showRecall: ms === 'open' && !deploy.length && sv.fleet.some((f) => f.sitsOut), recall: () => this.recall()
    };

    const dockOpen = !!P.dock, repairsOnly = P.dock === 'd2';
    const sid = (sv.fleet.filter((f) => f.id === st.ship)[0] || sv.fleet[0] || {}).id;
    const ships = sv.fleet.map((f) => {
      const C = this.cls(f), r = Object.assign({ hull: 0, crit: 0, crew: 0 }, st.rep[f.id]), on = sid === f.id, col = f.prize ? '#d7b8ff' : '#5aa9ff';
      const hull = f.hull + r.hull, dfit = this.draftFit(f), newFit = Object.keys(dfit).some((sl) => dfit[sl] && dfit[sl] !== (f.fit || {})[sl]);
      const pips = []; for (let i = 0; i < C.hull; i++) pips.push('width: 10px; height: 12px; border-radius: 2px; ' + (i < f.hull ? 'background: ' + col : i < hull ? 'background: #7be3a4' : 'background: #1a2335; box-shadow: inset 0 0 0 1px #2a3650'));
      const tag = f.sitsOut ? ['IN DOCK', '#16243d', '#8cc4ff'] : f.reserve ? ['RESERVE', '#1a2335', '#93a3bf'] : f.prize ? ['PRIZE', '#2a1a3a', '#d7b8ff'] : f.hull < C.hull || (f.crits || []).length ? ['DAMAGED', '#3a2208', '#ffc94d'] : ['READY', '#11301f', '#7be3a4'];
      const maxCrew = C.crew + (dfit.crew === 'marines' ? 2 : 0);
      return {
        name: f.name, cls: C.cls + (f.prize ? ' · prize' : ''), col: col, tag: tag[0], tagBg: tag[1], tagFg: tag[2], pips: pips, hull: hull + '/' + C.hull, crew: (f.crew + r.crew) + '/' + maxCrew, vet: this.vet(f.battles), captain: f.cap ? (D.caps.filter((c) => c.id === f.cap).map((c) => c.name + ' · ' + c.trait)[0] || 'No captain assigned') : 'No captain assigned',
        sitsOut: (r.hull > 4 || newFit) && !f.sitsOut, pressed: on ? 'true' : 'false', pick: () => this.setState({ ship: f.id, slot: C.slots.indexOf(st.slot) >= 0 ? st.slot : C.slots[0] }),
        style: 'flex: 1 1 260px; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px 16px; border-radius: 10px; cursor: pointer; text-align: left; ' + (on ? 'background: #111c33; border: 1px solid ' + col + '; box-shadow: 0 0 0 1px ' + col + ';' : 'background: #0d1220; border: 1px solid #1c2638;')
      };
    });
    let sel = { name: '—', repairs: [], crits: [], hasCrits: false, slots: [], options: [], noSlots: true, reserveLabel: '', reserveAct: () => {}, reserveNote: '', capOpts: [] };
    if (sid) {
      const f = this.ship(sid), C = this.cls(f), r = Object.assign({ hull: 0, crit: 0, crew: 0 }, st.rep[sid]);
      const sq = (dis) => 'width: 44px; height: 44px; border-radius: 6px; font-size: 18px; font-weight: 700; cursor: ' + (dis ? 'not-allowed' : 'pointer') + '; ' + (dis ? 'background: #111a2c; color: #4a5a7a; border: 1px solid #1c2638;' : 'background: #16243d; color: #e6edf8; border: 1px solid #33425f;');
      const dfit = this.draftFit(f), maxCrew = C.crew + (dfit.crew === 'marines' ? 2 : 0), crits = f.crits || [];
      const rep = [
        ['hull', 'Repair hull', (f.hull + r.hull) + '/' + C.hull + ' · ' + this.price(D.costs.hull) + ' credits per point' + (r.hull > 4 ? ' · needs dock time' : ''), C.hull - f.hull, this.price(D.costs.hull)],
        ['crit', 'Clear criticals', (crits.length - r.crit) + ' left · ' + this.price(D.costs.crit) + ' credits each', crits.length, this.price(D.costs.crit)],
        ['crew', 'Recruit crew', (f.crew + r.crew) + '/' + maxCrew + ' · ' + this.price(D.costs.crew) + ' credits each', maxCrew - f.crew, this.price(D.costs.crew)]
      ].map((x) => {
        const cur = r[x[0]], minusOff = !dockOpen || cur <= 0, plusOff = !dockOpen || cur >= x[3] || left < x[4];
        return { label: x[1], detail: x[2], minus: () => this.setRep(sid, x[0], -1), plus: () => this.setRep(sid, x[0], 1), minusOff: minusOff, plusOff: plusOff, minusStyle: sq(minusOff), plusStyle: sq(plusOff), minusAria: 'Less: ' + x[1], plusAria: 'More: ' + x[1] };
      });
      const critChips = crits.map((c, i) => ({ name: (D.CRIT[c.k] || c.k) + (c.k === 'gundeck' && c.side ? ' (' + c.side + ')' : '') + (i < r.crit ? ' · repaired' : ''), style: 'font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; ' + (i < r.crit ? 'background: #11301f; color: #7be3a4; border: 1px solid #1f5a39;' : 'background: #3a2208; color: #ffc94d; border: 1px solid #6b4310;') }));
      const slotLabel = { weapons: 'WEAPONS', defence: 'DEFENCE', engines: 'ENGINES', crew: 'CREW', special: 'SPECIAL' };
      const slot = C.slots.indexOf(st.slot) >= 0 ? st.slot : C.slots[0];
      const slots = C.slots.map((sl) => {
        const u = D.U.filter((x) => x.id === dfit[sl])[0], on = sl === slot, isNew = u && dfit[sl] !== (f.fit || {})[sl];
        return { label: slotLabel[sl], fit: u ? u.name + (isNew ? ' · new' : '') : 'Empty', fitCol: u ? '#7be3a4' : '#93a3bf', pressed: on ? 'true' : 'false', pick: () => this.setState({ slot: sl }),
          style: 'flex: 1 1 150px; min-height: 52px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; padding: 6px 10px; border-radius: 6px; cursor: pointer; text-align: left; ' + (on ? 'background: #16243d; border: 1px solid #5aa9ff;' : 'background: #0a1222; border: 1px solid #26324a;') };
      });
      const options = D.U.filter((u) => u.slot === slot).map((u) => {
        const installed = dfit[slot] === u.id, owned = (f.fit || {})[slot] === u.id, extra = installed || owned ? 0 : this.price(u.cost), off = !installed && (!dockOpen || repairsOnly || extra > left);
        const btn = installed ? 'Remove' : !dockOpen ? 'No shipyard' : repairsOnly ? 'Repairs only' : extra > left ? 'Too costly' : owned ? 'Refit' : 'Install';
        return { name: u.name, effect: u.effect, cost: fmt(this.price(u.cost)) + ' cr', btn: btn, off: off || (installed && !dockOpen),
          act: () => this.setFit(sid, slot, installed ? null : u.id),
          style: 'display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 10px 12px; border-radius: 8px; ' + (installed ? 'background: #0f2a1c; border: 1px solid #1f5a39;' : 'background: #080c16; border: 1px solid #1c2638;'),
          btnStyle: 'min-height: 44px; min-width: 96px; padding: 0 12px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: ' + (off ? 'not-allowed' : 'pointer') + '; ' + (installed ? 'background: transparent; color: #e6edf8; border: 1px solid #33425f;' : off ? 'background: #111a2c; color: #4a5a7a; border: 1px solid #1c2638;' : 'background: #5aa9ff; color: #070a12; border: 0;') };
      });
      sel = { name: f.name, repairs: rep, crits: critChips, hasCrits: critChips.length > 0, slots: slots, options: options, noSlots: C.slots.length === 0,
        reserveLabel: f.reserve ? 'In reserve: deploy it' : 'Deploys: hold it in reserve', reserveAct: () => this.toggleReserve(sid),
        capOpts: this.roster(sv).map((id) => D.caps.filter((c) => c.id === id)[0]).concat([{ id: null, name: 'No captain' }]).map((c) => {
          const on = (f.cap || null) === c.id, elsewhere = c.id && sv.fleet.filter((x) => x.cap === c.id && x.id !== f.id)[0];
          return { name: c.id ? c.name.replace(/^(Capt\.|Cmdr\.) /, '') + (c.trait ? ' · ' + c.trait : '') : c.name, sub: elsewhere ? 'moves from ' + elsewhere.name.replace('CNS ', '') : '', pressed: on ? 'true' : 'false', pick: () => this.assignCap(f.id, c.id),
            style: 'min-height: 44px; flex: 1 1 140px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 4px 10px; border-radius: 6px; cursor: pointer; text-align: left; font-size: 12px; font-weight: 600; ' + (on ? 'background: #10223a; color: #cfe4ff; border: 1px solid #5aa9ff;' : 'background: #0a1222; color: #c5d1e6; border: 1px solid #26324a;') };
        }),
        reserveNote: f.sitsOut ? 'In dock for work orders: sits out the next mission.' : f.reserve ? 'Held back: it will not fly the next mission.' : 'Flies the next mission.' };
    }
    const dockName = P.dock === 'start' ? 'Fleet yard, before M1' : P.dock ? D.M[P.dock].name : 'No drydock in reach';
    const dockNote = !P.dock ? 'Your fleet is in the field. Repairs and refits open at D1 Drydock Varn (after M2) and D2 Forward Base Sela (after M4); the next battle starts with every scar from the last.'
      : repairsOnly ? 'Forward Base Sela has no shipyard: repairs and crew only.' : 'Damage, criticals and crew losses carry over from the last battle. A ship having more than 4 hull repaired, or a new upgrade fitted, needs dock time and sits out the next mission.';
    const db = sv.debrief && !sv.debrief.seen ? sv.debrief : null;
    const done = ['m1', 'm2a', 'm2b', 'm3', 'm4', 'm5'].filter((k) => (sv.done || {})[k] === 'won' || (sv.done || {})[k] === 'failed').length;
    const lostAll = !sv.fleet.length;
    return {
      creditsLeft: fmt(left), renown: String(sv.renown || 0), missions: done + ' / 5', fleetN: sv.fleet.length + (sv.fleet.length === 1 ? ' hull' : ' hulls'),
      where: P.complete ? 'Complete' : P.dock ? 'In dock' : 'In the field',
      storage: st.mode === 'db' ? (this.store && this.store.shared ? 'Campaign saved in this canvas (one save for the canvas, synced across your devices); the battle board reads and writes the same save.' : 'Campaign saved to your private record in this canvas; the battle board reads and writes the same save.') : st.mode === 'local' ? 'Campaign saved in this browser (the canvas database was not available here); the battle board shares it.' : st.mode === 'loading' ? 'Loading your campaign…' : 'This view cannot save: progress lasts until you close it.',
      showDebrief: !!db, db: db ? { title: db.code + ' · ' + db.name + ': ' + (db.won ? 'mission accomplished' : 'mission failed'), col: db.won ? '#7be3a4' : '#ff8a8a', lines: db.lines.map((l) => ({ mark: l.ok ? '✓' : '✗', col: l.ok ? '#7be3a4' : '#ff8a8a', text: l.text })), rewards: '+' + db.credits + ' credits · +' + db.renown + ' renown', lost: db.lost.length ? 'Lost: ' + db.lost.join(', ') : 'No ships lost', prizes: db.prizes.length ? 'Prizes joining your fleet: ' + db.prizes.join(', ') : '', hasPrizes: db.prizes.length > 0 } : { title: '', col: '#7be3a4', lines: [], rewards: '', lost: '', prizes: '', hasPrizes: false },
      dismiss: () => this.dismiss(),
      showEnd: P.complete || lostAll, endText: lostAll ? 'Your squadron is lost. Restart the operation to try again.' : 'Operation Iron Tide is over: ' + (sv.done.m5 === 'won' ? 'Station Aurel held. ' : 'Station Aurel fell. ') + (sv.renown || 0) + ' renown earned.',
      restart: () => this.restart(), restartLabel: st.confirmReset ? 'Click again to wipe this campaign' : 'Restart operation', restartStyle: 'min-height: 44px; padding: 0 14px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; ' + (st.confirmReset ? 'background: #ff8a8a; color: #1a0606; border: 0;' : 'background: transparent; color: #e6edf8; border: 1px solid #33425f;'),
      rs: rs,
      nodes: nodes, m: m, ships: ships, sel: sel,
      dockTitle: '2 · Drydock · ' + dockName, dockNote: dockNote, dockOpen: dockOpen, spent: fmt(spent), credits: fmt(sv.credits),
      reset: () => this.setState({ fit: {}, rep: {} }), confirm: () => this.confirmWork(), canConfirm: dockOpen && (spent > 0 || Object.keys(st.fit).length > 0), noConfirm: !(dockOpen && (spent > 0 || Object.keys(st.fit).length > 0)),
      captains: D.caps.map((c) => {
        const ship = sv.fleet.filter((f) => f.cap === c.id)[0], lost = (sv.capsLost || []).indexOf(c.id) >= 0, have = this.roster(sv).indexOf(c.id) >= 0;
        const canHire = c.id === 'holt' && !sv.holt && P.dock === 'd2', fee = this.price(300), afford = left >= fee;
        const where = lost ? 'Lost with their ship' : ship ? 'Commands ' + ship.name : have ? 'Unassigned: pick a ship in the drydock panel above' : c.join;
        return { name: c.name, trait: c.trait, effect: c.effect, where: where, canHire: canHire, hire: () => this.hireHolt(), hireLabel: afford ? 'Hire for ' + fee + ' credits' : 'Needs ' + fee + ' credits', hireOff: !afford };
      }),
      catalogue: D.U.map((u) => ({ name: u.name, slot: ({ weapons: 'Weapons', defence: 'Defence', engines: 'Engines', crew: 'Crew', special: 'Special' })[u.slot], cost: fmt(this.price(u.cost)), effect: u.effect }))
    };
  }
}
