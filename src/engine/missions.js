// Gunline · Campaign missions for the battle board: set-ups, objectives and writing the result back to the save.
// Methods are copied onto each board's Component (see src/shared/install.js); `this` is the game.
class GLMissions {
  onSave(sv) {
    this.save = sv;
    const g = this.g;
    if (sv && sv.current && !this.mission && g && g.turn === 1 && g.phase === 'orders' && !Object.keys(g.drafts).length) this.startMission(sv.current);
    else this.bump();
  }

  startMission(code) {
    const spec = this.missionSpec(code, this.save || {});
    if (spec) this.newGame(false, spec);
  }

  // Mission set-ups for Operation Iron Tide. Your deployed fleet comes from the save; enemies and map features from here.
  missionSpec(code, sv) {
    const mods = sv.mods || {}, W = this.D.W / 2, H = this.D.H / 2;
    const fleet = (sv.fleet || []).filter((f) => !f.sitsOut && !f.reserve);
    const deploy = (slots) => fleet.map((f, i) => {
      const sl = slots[i % slots.length], row = Math.floor(i / slots.length);
      return { id: f.id, cls: f.cls, side: 'concord', name: f.name, hull: f.hull, crew: f.crew, crits: f.crits, fit: f.fit, cap: this.capOf(f), prize: f.prize, battles: f.battles, campaignId: f.id, x: sl.x - row * 9, y: sl.y, h: sl.h };
    });
    const lb = mods.reaverLances ? 6 : 0;
    const raider = (id, name, x, y, h, extra) => Object.assign({ id: id, cls: 'carrion', name: name, x: x, y: y, h: h, lanceBonus: lb }, extra || {});
    const maw = (x, y, h, extra) => Object.assign({ id: 'e_maw', cls: 'maw', name: 'Maw of Ruin', x: x, y: y, h: h, lanceBonus: lb, cap: 'garrak' }, extra || {});
    const M = {
      m1: { name: 'Picket Line', type: 'Fleet engagement', turns: 0,
        roster: deploy([{ x: -44, y: -14, h: 0 }, { x: -48, y: 8, h: 0 }]).concat([maw(44, 14, Math.PI), raider('e_carrion', 'Carrion Wing', 48, -8, Math.PI, { cap: 'vex' })]) },
      m2a: { name: 'Convoy Run', type: 'Escort', turns: 9, exit: { edge: 'west', who: 'freighter' },
        roster: deploy([{ x: 4, y: -24, h: Math.PI }, { x: 14, y: 22, h: Math.PI }]).concat([
          { id: 'f1', cls: 'freighter', name: 'Freighter Ostra', x: 14, y: -8, h: Math.PI }, { id: 'f2', cls: 'freighter', name: 'Freighter Bell', x: 22, y: 0, h: Math.PI }, { id: 'f3', cls: 'freighter', name: 'Freighter Kaye', x: 14, y: 8, h: Math.PI },
          raider('e_r1', 'Bone Kite', -20, H - 4, -Math.PI / 2, { spawn: 3 }), raider('e_r2', 'Grief Hook', -44, H - 4, -Math.PI / 2, { spawn: 3 }),
          maw(-10, H - 4, -Math.PI / 2, { spawn: 5, spawnIf: 'freightersRemain' })]) },
      m2b: { name: 'Salvage Field', type: 'Raid', turns: 12, exit: { edge: 'east', who: 'player' },
        features: { beacons: [{ x: -14, y: 22 }, { x: 12, y: -18 }, { x: 34, y: 20 }], mines: [{ x: -9, y: 26 }, { x: 16, y: -22 }, { x: 30, y: 15 }, { x: 38, y: 25 }],
          rocks: [{ x: -30, y: 6, r: 4 }, { x: -6, y: 0, r: 5 }, { x: 0, y: 30, r: 3.5 }, { x: 22, y: 2, r: 4.5 }, { x: 42, y: -8, r: 3.5 }, { x: -18, y: -24, r: 4 }, { x: 8, y: -40, r: 3 }, { x: 52, y: 32, r: 4 }, { x: -40, y: 32, r: 3 }] },
        roster: deploy([{ x: -56, y: -6, h: 0 }, { x: -58, y: 12, h: 0 }]).concat([raider('e_r1', 'Sawtooth', 56, 10, Math.PI), raider('e_r2', 'Gutter Saint', 60, -20, Math.PI)]) },
      m3: { name: 'The Reaver Lair', type: 'Prize hunt', turns: 10,
        features: { rocks: [{ x: 26, y: -30, r: 4 }, { x: 58, y: 34, r: 4 }, { x: 10, y: 36, r: 3.5 }] },
        roster: deploy([{ x: -62, y: -10, h: 0 }, { x: -64, y: 12, h: 0 }]).concat([
          { id: 'e_hydra', cls: 'hydra', name: 'Mother Hydra', x: 48, y: 16, h: Math.PI }, { id: 'e_lair', cls: 'lair', name: 'Lair Station', x: 52, y: -14, h: Math.PI },
          maw(40, -34, Math.PI)]) },
      m4: { name: 'Kessel Gate', type: 'Breakthrough', turns: 10, exit: { edge: 'east', who: 'player' },
        features: { well: { x: 6, y: 0, r: 34, pull: 4 } },
        roster: deploy([{ x: -44, y: -14, h: 0 }, { x: -46, y: 14, h: 0 }]).concat([maw(18, 0, Math.PI), raider('e_r1', 'Sawtooth', 14, -30, Math.PI), raider('e_r2', 'Bone Kite', 14, 30, Math.PI)].concat(mods.extraRaider ? [raider('e_r3', 'Grief Hook', 34, 10, Math.PI)] : [])) },
      m5: { name: 'Iron Tide', type: 'Hold the station', turns: 8,
        roster: deploy([{ x: -14, y: -14, h: 0 }, { x: -14, y: 14, h: 0 }]).concat([
          { id: 'aurel', cls: 'aurel', name: 'Station Aurel', x: 0, y: 0, h: 0 },
          maw(58, 6, Math.PI, { hullMax: 16 }), raider('e_r1', 'Sawtooth', 62, -24, Math.PI),
          raider('e_r2', 'Bone Kite', 0, H - 4, -Math.PI / 2, { spawn: 4 }), raider('e_r3', 'Grief Hook', 0, -H + 4, Math.PI / 2, { spawn: 7 })].concat(mods.extraRaider ? [raider('e_r4', 'Gutter Saint', 64, 30, Math.PI)] : [])) }
    };
    const m = M[code]; if (!m) return null;
    m.code = code.toUpperCase(); m.features = m.features || {};
    return m;
  }

  // Objectives and outcome, checked at the end of every turn.
  missionCheck() {
    const g = this.g, m = this.mission, T = g.turn, ids = this.ids(), sh = (id) => g.ships[id];
    const mine = ids.filter((id) => sh(id).def.side === 'concord' && !sh(id).def.npc && !sh(id).def.static);
    const myLive = mine.filter((id) => this.active(sh(id))).length;
    const foes = ids.filter((id) => sh(id).def.side === 'reaver');
    const foesLeft = foes.filter((id) => this.active(sh(id)) || sh(id).away).length;
    const limit = m.turns && T >= m.turns;
    const res = { over: false, won: false, lines: [], credits: 0, renown: 0, secondary: false };
    const L = (ok, text) => res.lines.push({ ok: ok, text: text });
    if (m.code === 'M1') {
      L(foesLeft === 0, 'Destroy, capture or drive off the Reaver vanguard');
      res.over = foesLeft === 0 || myLive === 0; res.won = foesLeft === 0 && myLive > 0;
      if (res.won) { res.credits = 400; res.renown = 1; }
    } else if (m.code === 'M2A') {
      const fr = ids.filter((id) => sh(id).def.cls === 'freighter'), esc = fr.filter((id) => sh(id).escaped).length, lost = fr.filter((id) => sh(id).dead || sh(id).captured).length, on = fr.filter((id) => this.active(sh(id))).length;
      L(esc >= 2, 'At least 2 freighters exit the west edge by turn 9 (' + esc + ' escaped)');
      L(lost === 0 && esc === 3, 'Secondary: all 3 freighters get through (' + lost + ' lost so far)');
      res.over = on === 0 || limit || (myLive === 0 && foesLeft > 0) || (foesLeft === 0 && on === 0);
      if (foesLeft === 0 && on > 0) { res.over = true; L(true, 'The raiders are gone; the remaining freighters reach the yards'); }
      const saved = res.over && foesLeft === 0 ? esc + on : esc;
      res.won = saved >= 2; res.secondary = saved === 3 && lost === 0;
      res.credits = 250 * saved; res.renown = res.secondary ? 1 : 0;
    } else if (m.code === 'M2B') {
      const got = (g.feat.beacons || []).filter((b) => b.got).length, out = mine.filter((id) => sh(id).escaped).length;
      L(got >= 2 && out > 0, 'Recover 2 of 3 salvage beacons and exit the east edge by turn 12 (' + got + ' recovered, ' + out + ' out)');
      L(got === 3, 'Secondary: recover all 3');
      res.over = myLive === 0 || limit; res.won = got >= 2 && out > 0; res.secondary = got === 3 && res.won;
      res.credits = 200 * (res.won ? got : 0) + (res.secondary ? 150 : 0); res.renown = res.won ? 1 : 0;
    } else if (m.code === 'M3') {
      const hy = ids.filter((id) => sh(id).def.cls === 'hydra').map(sh)[0], mw = sh('e_maw');
      const took = hy && hy.captured && hy.capturedBy === 'concord', gone = hy && (hy.dead || (hy.captured && hy.capturedBy !== 'concord'));
      L(!!took, 'Capture Mother Hydra by boarding (destroying her fails the mission)');
      res.secondary = !!(mw && (mw.dead || mw.captured || this.crippled(mw)));
      L(res.secondary, 'Secondary: cripple the Maw of Ruin');
      res.over = took || gone || myLive === 0 || limit; res.won = !!took;
      res.credits = res.won ? 500 : 0; res.renown = res.won ? 2 + (res.secondary ? 1 : 0) : 0;
    } else if (m.code === 'M4') {
      const out = mine.filter((id) => sh(id).escaped).length, lostN = mine.filter((id) => sh(id).dead || sh(id).captured).length;
      L(out >= 2, 'Get 2 ships off the east edge by turn 10 (' + out + ' through)');
      res.over = myLive === 0 || limit;
      if (res.over && limit) mine.forEach((id) => { const s = sh(id); if (this.active(s)) { s.captured = true; s.capturedBy = 'reaver'; } });
      res.won = out >= 2; res.secondary = res.won && lostN === 0;
      L(res.secondary, 'Secondary: lose no ships');
      res.credits = res.won ? 600 : 0; res.renown = res.won ? 1 + (res.secondary ? 1 : 0) : 0;
    } else if (m.code === 'M5') {
      const st = sh('aurel'), mw = sh('e_maw'), stOk = st && !st.dead && !st.captured;
      L(stOk && (T >= 8 || foesLeft === 0), 'Station Aurel survives 8 turns (turn ' + T + ')');
      res.secondary = !!(mw && (mw.dead || mw.captured));
      L(res.secondary, 'Secondary: destroy or capture the Maw of Ruin');
      res.over = !stOk || limit || foesLeft === 0; res.won = stOk && (limit || foesLeft === 0);
      res.credits = res.won ? 800 : 0; res.renown = res.won ? 3 + (res.secondary ? 1 : 0) : 0;
    }
    return res;
  }

  // Write the battle's outcome back to the campaign: damage, crew, losses, prizes, rewards, progress.
  endMission(res) {
    const g = this.g, m = this.mission, sv = JSON.parse(JSON.stringify(this.save || {}));
    if (!sv.fleet) return;
    const key = m.code.toLowerCase(), lost = [], prizes = [], fleet = [];
    sv.fleet.forEach((f) => {
      const s = g.ships[f.id];
      if (!s) { f.sitsOut = false; fleet.push(f); return; }
      if (s.dead || s.captured) {
        lost.push(f.name + (s.dead ? ' (destroyed)' : ' (captured)'));
        const cp = this.capOf(f); if (cp) sv.capsLost = (sv.capsLost || []).concat([cp]);
        return;
      }
      f.hull = Math.max(1, s.hull); f.crew = Math.max(1, s.crew); f.crits = s.crits.map((c) => ({ k: c.k, roll: c.roll, side: c.side || null }));
      f.battles = (f.battles || 0) + 1; f.sitsOut = false;
      fleet.push(f);
    });
    this.ids().forEach((id) => {
      const s = g.ships[id];
      if (s.captured && s.capturedBy === 'concord' && s.def.side === 'reaver') {
        prizes.push(s.def.name);
        fleet.push({ id: 'p_' + s.def.cls + '_' + (Date.now() % 1e6), cls: s.def.cls, name: s.def.name, hull: Math.max(1, s.hull), crew: Math.max(1, s.crew), crits: [], fit: {}, battles: 0, cap: null, prize: true, sitsOut: false });
      }
    });
    sv.fleet = fleet;
    sv.credits = (sv.credits || 0) + res.credits; sv.renown = (sv.renown || 0) + res.renown;
    sv.done = sv.done || {}; sv.done[key] = res.won ? 'won' : 'failed';
    if (key === 'm2a' || key === 'm2b') sv.done[key === 'm2a' ? 'm2b' : 'm2a'] = 'skipped';
    sv.mods = sv.mods || {};
    if (!res.won && key === 'm2a') sv.mods.dockPrice = 1.25;
    if (!res.won && key === 'm2b') sv.mods.reaverLances = true;
    if (!res.won && key === 'm3') sv.mods.extraRaider = true;
    if (key === 'm2a' && res.secondary) sv.okafor = true;
    if (key === 'm1' || key === 'm2a' || key === 'm2b') sv.docked = null;
    sv.current = null;
    sv.debrief = { code: m.code, name: m.name, won: res.won, lines: res.lines, credits: res.credits, renown: res.renown, lost: lost, prizes: prizes, turn: g.turn, at: Date.now() };
    sv.history = (sv.history || []).concat([{ code: m.code, won: res.won, turn: g.turn }]);
    sv.results = Object.assign({}, sv.results, { [key]: sv.debrief });
    this.save = sv;
    this.storeSave(sv);
    g.debrief = Object.assign({}, res, { lost: lost, prizes: prizes, saved: this.store ? this.store.mode : 'memory' });
  }
}
