// Gunline · Ship data, roster building, geometry, movement envelopes and to-hit rules. Pure: no rendering.
// Methods are copied onto each board's Component (see src/shared/install.js); `this` is the game.
class GLCore {
  /* ───────────── DATA ───────────── */
  defs() {
    return {
      W: 160, H: 110,
      IDS: ['resolute', 'vigilant', 'maw', 'carrion'],
      FACINGS: ['fore', 'port', 'stbd', 'aft'],
      ART: {
        p_shell_he: '/_blob/7ba92a28b77f268534636b20cef6f862', p_shell_ap: '/_blob/6f6122af88bd896abe07d948b3977170',
        p_tracer_blue: '/_blob/2b59fa42d2edbee181f6a52e22c46739', p_plasma_red: '/_blob/a80f2714e66680f3a3ba7bc4619b7bbc',
        p_lance_cyan: '/_blob/d45e21c01f5d9fbb30540b193adbcf37', p_lance_violet: '/_blob/d81654b54e89fa15a534ee89f2476abe',
        p_boarding_torpedo: '/_blob/2ab41de6a3f32276f04722ca3be06867',
        m_cannon: '/_blob/7a6fb3c79aa3630d1ec067e020c06372', m_rail: '/_blob/5242bd328f512742de9d199c5ae64ac1', m_laser: '/_blob/14dc320e1114e1e257b3df4e396124e7',
        s_hit_cyan: '/_blob/73019e492566ed010ea32a272b09274b', s_hit_purple: '/_blob/43b399904d46bcb5419a17a6a7a01851', i_sparks_gold: '/_blob/9ce9125ee7637bd37181b6a62e10f713',
        x_small_orange: '/_blob/7b16720d98bfdf25905f7a3c64027b77', x_breach_red: '/_blob/9cca5611880a5440bc664f988ae734f8',
        x_capital_orange: '/_blob/76c9d2d750292cfa93d29cb2eae24fc3', x_reactor_violet: '/_blob/e088983b7a44693ca887c729c43e76bb'
      },
      // Captains and their traits. A ship's captain is part of its roster entry (campaign save or skirmish line-up).
      TRAITS: {
        gunnery: { name: 'Gunnery Master', text: 'With Lock On, re-roll the misses of this ship’s biggest volley, once per turn.' },
        daredevil: { name: 'Daredevil', text: 'All Ahead Full keeps this ship’s full Turn value.' },
        boarding: { name: 'Boarding Master', text: 'This ship’s boarders win ties in the first exchange of every boarding action.' },
        steady: { name: 'Steady Hand', text: 'Brace for Impact no longer halves this ship’s dice.' }
      },
      CAPTAINS: {
        varga: { name: 'Capt. Ilse Varga', trait: 'gunnery' }, rheel: { name: 'Capt. Tomas Rheel', trait: 'daredevil' },
        okafor: { name: 'Cmdr. Ama Okafor', trait: 'boarding' }, holt: { name: 'Capt. Davin Holt', trait: 'steady' },
        garrak: { name: 'Warlord Garrak', trait: 'boarding' }, vex: { name: 'Vex the Quick', trait: 'daredevil' }
      },
      // Torpedoes: run 20u a move toward where the target was, turning up to 60°; burn out after 3 moves; launch within 40u.
      TORP: { speed: 20, turn: 60, life: 3, range: 40, reach: 1.5, reachK: 0.35, dice: 2, plus: 0 },
      SHEETS: { x_small_orange: [4, 4, 16], x_breach_red: [4, 4, 16], x_capital_orange: [5, 4, 20], x_reactor_violet: [5, 4, 20] },
      SFX: {
        cannon_heavy: '/_blob/e5c3a8b827ea958ba638bc5e22722f6d', cannon_boom: '/_blob/16c5ec15006567069beea64c4179d022',
        laser_cannon: '/_blob/e78f9ec3eaf751da8a32675dae687819', laser_beam: '/_blob/316165810d97127243f5e71e03335ebb',
        grav_lance: '/_blob/c109ffca6dccef2900828c30e4e523c6', blaster_c: '/_blob/2219e8336481c7ff49d9c0d50f1ffaee',
        blaster_r: '/_blob/a312b1f4d57b8045fdb5cf38e4d35222', shield_zap: '/_blob/f1d7b43342da644ea6d8053f10f2e3a5',
        hit_small: '/_blob/46543e7230a2b6ce45992dcc511c31f3', hit_big: '/_blob/5efa14eef798feeeaa6810d3afabc8c9',
        explode_big: '/_blob/7e98b0566a0fafeb3ba22d4a7089c9f1', explode_med: '/_blob/16e49da1a0c68560f249805f2d1cf030',
        collision: '/_blob/6989f040f64c21ea04984b61f7147831', engine: '/_blob/31e9b0f9bd0ed0f53a36311d765f6a44',
        vo_sighted: '/_blob/48e58fc53c259a7f8d36c75fae7a9fe9'
      },
      SIDES: {
        concord: { name: 'Concord Navy', short: 'Concord', color: '#5aa9ff', hex: 0x5aa9ff, glow: 0x6fb6ff, bolt: 0x7cc0ff, lanceBolt: 0xbfe4ff, fill: 'rgba(90,169,255,0.2)', tagFg: '#d6e9ff' },
        reaver: { name: 'Reaver Clans', short: 'Reaver', color: '#ff6a3d', hex: 0xff6a3d, glow: 0xff5030, bolt: 0xff7a3d, lanceBolt: 0xff3cc8, fill: 'rgba(255,106,61,0.2)', tagFg: '#ffd9cc' }
      },
      CRIT: ['', 'Hull Breach', 'Fire!', 'Engines Hit', 'Steering Jammed', 'Gun Deck Hit', 'Bridge Hit'],
      CRITKEY: ['', 'breach', 'fire', 'engines', 'steering', 'gundeck', 'bridge'],
      ORDERS: [
        { id: 'steady', label: 'Steady', short: 'No modifiers', desc: 'Standard manoeuvre: move between half and full Speed, turn up to the Turn value.' },
        { id: 'aaf', label: 'All Ahead Full', short: 'Speed ×1.5 · Turn ½ · −1 to hit', desc: 'Must move at least full Speed, up to 1.5× Speed. Turn limit halved. This ship is −1 to hit.' },
        { id: 'about', label: 'Come About', short: 'Turn +30° · Speed ½', desc: 'Turn limit +30°, maximum move halved, minimum move 2.' },
        { id: 'lock', label: 'Lock On', short: '+1 to hit · Turn ½', desc: 'Gunners steady their aim: +1 to hit this turn, but the Turn limit is halved.' },
        { id: 'ram', label: 'Ram', short: 'Full speed · Turn ½ · ram', desc: 'Move at least full Speed, up to 1.5× Speed; Turn halved; −1 to hit. If an enemy ends within reach in your fore arc (your priority target first) you ram it: 1d6 + mass damage, ignoring shields and armour. You take half a d6.' },
        { id: 'brace', label: 'Brace for Impact', short: '+1 save · half dice', desc: 'Armour saves improve by 1 this turn, but every weapon rolls half dice (round up).' }
      ],
      CLASSES: {
        resolute: {
          id: 'resolute', side: 'concord', len: 8, beam: 1.5, name: 'CNS Resolute', cls: 'Dominion-class battleship · Concord Navy', color: '#5aa9ff', hex: 0x5aa9ff,
          speed: 12, turn: 45, hull: 14, shields: { fore: 2, port: 2, stbd: 2, aft: 1 }, armour: 4, crew: 8, ram: false,
          start: { x: -44, y: -14, h: 0 },
          weapons: [
            { id: 'port', name: 'Port broadside', dice: 7, range: 30, arcs: ['port'], broadside: true, side: 'port' },
            { id: 'stbd', name: 'Starboard broadside', dice: 7, range: 30, arcs: ['stbd'], broadside: true, side: 'stbd' },
            { id: 'lance', name: 'Prow lance', dice: 2, range: 30, arcs: ['fore'], lance: true },
            { id: 'turret', name: 'Dorsal turrets', dice: 2, range: 18, arcs: ['fore', 'port', 'stbd', 'aft'] }
          ],
          assets: { mesh: '/_blob/1fca825c5afff9c46079621b608990d1', base: '/_blob/f3ccc5c71b8e6ac2ef74b6f4d0ed9ca5', normal: '/_blob/753f29aba03865a232ca1701e429a756', rm: '/_blob/64f67c2fe01d74c018b3a4def2eec0b5' }
        },
        maw: {
          id: 'maw', side: 'reaver', len: 8, beam: 1.5, name: 'Maw of Ruin', cls: 'Ravager-class battleship · Reaver Clans', color: '#ff6a3d', hex: 0xff6a3d,
          speed: 16, turn: 60, hull: 13, shields: { fore: 3, port: 2, stbd: 2, aft: 1 }, armour: 5, crew: 7, ram: true, tractor: 8,
          start: { x: 44, y: 14, h: Math.PI },
          weapons: [
            { id: 'port', name: 'Port broadside', dice: 6, range: 24, arcs: ['port'], broadside: true, side: 'port' },
            { id: 'stbd', name: 'Starboard broadside', dice: 6, range: 24, arcs: ['stbd'], broadside: true, side: 'stbd' },
            { id: 'maw', name: 'Graviton maw', dice: 4, range: 18, arcs: ['fore'], lance: true },
            { id: 'turret', name: 'Spinal turrets', dice: 2, range: 18, arcs: ['fore', 'port', 'stbd', 'aft'] }
          ],
          assets: { mesh: '/_blob/c644ca5c0c860be99b90b776783c832d', base: '/_blob/a3fec9d6b439e84422b2180316fbad33', normal: '/_blob/1631962b096ed9a4432e4b3c0abb9c29', rm: '/_blob/7dfc69f5529eb78e929aebbda296f429' }
        },
        vigilant: {
          id: 'vigilant', side: 'concord', len: 6.5, beam: 1.5, name: 'CNS Vigilant', cls: 'Valiant-class cruiser · Concord Navy', color: '#5aa9ff', hex: 0x5aa9ff,
          speed: 14, turn: 50, hull: 8, shields: { fore: 2, port: 1, stbd: 1, aft: 1 }, armour: 4, crew: 6, ram: false, torps: 1,
          start: { x: -48, y: 8, h: 0 },
          weapons: [
            { id: 'port', name: 'Port broadside', dice: 4, range: 24, arcs: ['port'], broadside: true, side: 'port' },
            { id: 'stbd', name: 'Starboard broadside', dice: 4, range: 24, arcs: ['stbd'], broadside: true, side: 'stbd' },
            { id: 'lance', name: 'Prow lance', dice: 1, range: 24, arcs: ['fore'], lance: true },
            { id: 'turret', name: 'Dorsal turrets', dice: 2, range: 18, arcs: ['fore', 'port', 'stbd', 'aft'] }
          ],
          assets: { mesh: '/_blob/d4c9666d5b83c6c508d29f5c0c02e3ec', base: '/_blob/5c74e1d416531236a0cc3609c03fca6d', normal: '/_blob/a117c03feb593c44dc82b2ff023a0c1f', rm: '/_blob/ad70c2ec8e00d2f335da847ebef1a3fc' }
        },
        carrion: {
          id: 'carrion', side: 'reaver', len: 6.5, beam: 1, name: 'Carrion Wing', cls: 'Harrow-class raider · Reaver Clans', color: '#ff6a3d', hex: 0xff6a3d,
          speed: 18, turn: 60, hull: 10, shields: { fore: 3, port: 1, stbd: 1, aft: 0 }, armour: 5, crew: 4, ram: false, torps: 2,
          start: { x: 48, y: -8, h: Math.PI },
          weapons: [
            { id: 'port', name: 'Port broadside', dice: 5, range: 24, arcs: ['port'], broadside: true, side: 'port' },
            { id: 'stbd', name: 'Starboard broadside', dice: 5, range: 24, arcs: ['stbd'], broadside: true, side: 'stbd' },
            { id: 'talons', name: 'Talon lances', dice: 3, range: 18, arcs: ['fore'], lance: true },
            { id: 'turret', name: 'Spinal turrets', dice: 2, range: 18, arcs: ['fore', 'port', 'stbd', 'aft'] }
          ],
          assets: { mesh: '/_blob/08d8e56b994af5349f1a7e5a0b1eac58', base: '/_blob/b638cc5f369cb5d16c19d54534bc5104', normal: '/_blob/8da63acb2cebf790c7f9a82c6a3193d7', rm: '/_blob/efbe2e8fcaf666606aeb8ccd26999727' }
        },
        freighter: {
          id: 'freighter', side: 'concord', len: 7, beam: 1.4, rotY: Math.PI / 2, npc: true, name: 'Ore Freighter', cls: 'Ore freighter · Varn Combine', color: '#8fb8e0', hex: 0x8fb8e0,
          speed: 12, turn: 20, hull: 4, shields: { fore: 1, port: 1, stbd: 1, aft: 1 }, armour: 5, crew: 2, ram: false, start: { x: 0, y: 0, h: Math.PI }, weapons: [],
          assets: { mesh: '/_blob/1fa5df8ce84bed95fe23325f44b2e362', base: '/_blob/8a75273136ecf5340fa3ecc45893fee2', normal: '/_blob/ea0895e5f8c135c123ef5f566b01aee0', rm: '/_blob/073ae7a48cbe57b4123eef44d69b73fb' }
        },
        hydra: {
          id: 'hydra', side: 'reaver', len: 11, beam: 1.7, rotY: Math.PI / 2, static: true, name: 'Mother Hydra', cls: 'Hydra-class tender · Reaver Clans', color: '#ff6a3d', hex: 0xff6a3d,
          speed: 0, turn: 0, hull: 14, shields: { fore: 2, port: 2, stbd: 2, aft: 2 }, armour: 4, crew: 5, ram: false, start: { x: 0, y: 0, h: Math.PI }, weapons: [],
          assets: { mesh: '/_blob/1fa5df8ce84bed95fe23325f44b2e362', base: '/_blob/8a75273136ecf5340fa3ecc45893fee2', normal: '/_blob/ea0895e5f8c135c123ef5f566b01aee0', rm: '/_blob/073ae7a48cbe57b4123eef44d69b73fb' }
        },
        lair: {
          id: 'lair', side: 'reaver', len: 13, beam: 1, static: true, name: 'Lair Station', cls: 'Reaver station', color: '#ff6a3d', hex: 0xff6a3d,
          speed: 0, turn: 0, hull: 20, shields: { fore: 2, port: 2, stbd: 2, aft: 2 }, armour: 4, crew: 10, ram: false, start: { x: 0, y: 0, h: Math.PI },
          weapons: [{ id: 'turret', name: 'Station turrets', dice: 4, range: 20, arcs: ['fore', 'port', 'stbd', 'aft'] }],
          assets: { mesh: '/_blob/61f3bdf41de0d7f850ce3abbd0dad3e6', base: '/_blob/a05d33ec5191a3900bc29dadafcfcaa0', normal: '/_blob/0e8fd72339192966f2e9ebc06726b678', rm: '/_blob/7241d03f459c65ef36df002f044de3ad' }
        },
        aurel: {
          id: 'aurel', side: 'concord', len: 13, beam: 1, static: true, name: 'Station Aurel', cls: 'Concord orbital station', color: '#5aa9ff', hex: 0x5aa9ff,
          speed: 0, turn: 0, hull: 20, shields: { fore: 3, port: 3, stbd: 3, aft: 3 }, armour: 4, crew: 12, ram: false, start: { x: 0, y: 0, h: 0 },
          weapons: [{ id: 'turret', name: 'Station batteries', dice: 6, range: 24, arcs: ['fore', 'port', 'stbd', 'aft'] }],
          assets: { mesh: '/_blob/61f3bdf41de0d7f850ce3abbd0dad3e6', base: '/_blob/a05d33ec5191a3900bc29dadafcfcaa0', normal: '/_blob/0e8fd72339192966f2e9ebc06726b678', rm: '/_blob/7241d03f459c65ef36df002f044de3ad' }
        }
      }
    };
  }

  /* ───────────── RULES ENGINE ───────────── */
  d6() { return 1 + Math.floor(Math.random() * 6); }

  norm(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; }

  deg(r) { return Math.round(r * 180 / Math.PI); }

  count(s, k) { return s.crits.filter((c) => c.k === k).length; }

  crippled(s) { return s.hull <= s.def.hull / 2; }

  ids() { return this.D.IDS; }

  sideOf(id) { return this.D.SHIPS[id].side; }

  active(s) { return !!s && !s.dead && !s.fled && !s.captured && !s.away && !s.escaped; }

  enemySide(side) { return side === 'concord' ? 'reaver' : 'concord'; }

  sideShips(side) { return this.ids().filter((id) => this.sideOf(id) === side && this.active(this.g.ships[id])); }

  perShip(f) { const o = {}; this.ids().forEach((id) => { o[id] = f(id); }); return o; }

  nearestEnemy(s) {
    let best = null, bd = 1e9;
    this.sideShips(this.enemySide(s.def.side)).forEach((id) => { const t = this.g.ships[id], d = Math.hypot(t.x - s.x, t.y - s.y); if (d < bd) { bd = d; best = t; } });
    return best;
  }

  mkShip(def) {
    const c = def.carry || {};
    return { def: def, id: def.id, x: def.start.x, y: def.start.y, h: def.start.h,
      hull: c.hull != null ? Math.max(1, Math.min(def.hull, c.hull)) : def.hull, crew: c.crew != null ? Math.min(def.crew, c.crew) : def.crew,
      crits: (c.crits || []).map((k) => Object.assign({}, k)), torps: def.torps || 0, heldTurn: 0, dead: false, fled: false, captured: false, escaped: false, away: (def.spawn || 0) > 1 };
  }

  skirmishRoster() { const cap = { resolute: 'varga', vigilant: 'rheel', maw: 'garrak', carrion: 'vex' }; return ['resolute', 'vigilant', 'maw', 'carrion'].map((k) => ({ id: k, cls: k, cap: cap[k] })); }


  // Campaign saves made before captains had ids name them in text.
  capOf(f) {
    if (f.cap !== undefined) return f.cap || null;
    const t = String(f.captain || ''), C = this.D.CAPTAINS;
    return Object.keys(C).filter((k) => t.indexOf(C[k].name.split(' ').pop()) >= 0)[0] || null;
  }

  trait(s, key) { return !!s && s.def.capTrait === key; }


  // Build this battle's ships from class templates: each ship inherits its class and carries its own name, side,
  // position, damage, crew and fitted upgrades.
  buildRoster(list) {
    const C = this.D.CLASSES, SHIPS = {}, IDS = [];
    list.forEach((it) => {
      const base = C[it.cls], d = Object.create(base), side = it.side || base.side, SD = this.D.SIDES[side];
      d.id = it.id; d.cls = it.cls; d.name = it.name || base.name; d.side = side; d.color = SD.color; d.hex = SD.hex;
      d.weapons = base.weapons.map((w) => Object.assign({}, w)); d.shields = Object.assign({}, base.shields);
      d.start = { x: it.x != null ? it.x : base.start.x, y: it.y != null ? it.y : base.start.y, h: it.h != null ? it.h : base.start.h };
      d.spawn = it.spawn || 0; d.spawnIf = it.spawnIf || null; d.fit = Object.assign({}, it.fit || {});
      d.carry = { hull: it.hull, crew: it.crew, crits: it.crits };
      const cp = it.cap && this.D.CAPTAINS[it.cap]; d.cap = cp ? it.cap : null; d.captain = cp ? cp.name : ''; d.capTrait = cp ? cp.trait : null; d.prize = !!it.prize; d.battles = it.battles || 0; d.campaignId = it.campaignId || null;
      if (it.hullMax) d.hull = it.hullMax;
      if (it.lanceBonus) d.weapons.forEach((w) => { if (w.lance) w.range += it.lanceBonus; });
      this.applyFit(d);
      SHIPS[d.id] = d; IDS.push(d.id);
    });
    this.D.SHIPS = SHIPS; this.D.IDS = IDS;
  }

  // Refit upgrades that change the battle rules (torpedo tubes and tractor beams are not simulated yet).
  applyFit(d) {
    const f = d.fit || {}, has = (u) => Object.keys(f).some((k) => f[k] === u);
    if (has('heavy_bs')) { d.weapons.forEach((w) => { if (w.broadside) w.dice += 1; }); d.turn = d.turn - 5; }
    if (has('long_lance')) d.weapons.forEach((w) => { if (w.lance) w.range += 6; });
    if (has('shields')) d.shields.fore = (d.shields.fore || 0) + 1;
    if (has('drives')) d.speed = d.speed + 2;
    if (has('thrusters')) d.turn = d.turn + 10;
    if (has('marines')) d.crew = d.crew + 2;
    if (has('ram')) d.ram = true;
    if (has('torpedoes')) d.torps = (d.torps || 0) + 2;
    if (has('tractor')) d.tractor = 8;
    d.gunners = has('gunners'); d.dcTeams = has('dc_teams'); d.plating = has('plating'); d.ecm = has('ecm'); d.pd = has('pd');
  }

  // Ships a player (or the AI) gives orders to: not scripted freighters or fixed stations.
  ctrl(side) { return this.sideShips(side).filter((id) => { const d = this.D.SHIPS[id]; return !d.npc && !d.static; }); }


  // Scripted units: stations hold position, freighters steam straight ahead at their speed.
  autoOrders() {
    const g = this.g;
    this.ids().forEach((id) => {
      const s = g.ships[id], d = s.def;
      if (!this.active(s)) return;
      if (d.static) g.orders[id] = { order: 'steady', dest: { x: s.x, y: s.y }, target: 'auto' };
      else if (d.npc) g.orders[id] = { order: 'steady', dest: { x: s.x + Math.cos(s.h) * d.speed, y: s.y + Math.sin(s.h) * d.speed }, target: 'auto' };
    });
  }

  exitOk(s) {
    const ex = this.mission && this.mission.exit; if (!ex) return false;
    const edge = ex.edge === 'west' ? s.x < -this.D.W / 2 : ex.edge === 'east' ? s.x > this.D.W / 2 : false;
    const who = ex.who === 'freighter' ? s.def.cls === 'freighter' : (s.def.side === 'concord' && !s.def.npc && !s.def.static);
    return edge && who;
  }

  // Asteroid strikes (D3, no saves), mines (2d6, once) and salvage beacons (picked up by your warships).
  featureHazards() {
    const g = this.g, F = g.feat || {};
    this.ids().forEach((id) => {
      const s = g.ships[id]; if (!this.active(s) || s.def.static) return;
      (F.rocks || []).forEach((k) => {
        if (Math.hypot(s.x - k.x, s.y - k.y) < k.r + 1.6) {
          const d = 1 + Math.floor(Math.random() * 3);
          s.hull = Math.max(0, s.hull - d); g.taken[id] += d;
          this.floater(id, 'word', 'Asteroid strike', 0); this.floater(id, 'hull', '−' + d, 1);
          g.turnRolls[id].push({ owner: id, label: 'Struck an asteroid', result: d + ' damage (no saves)', dice: [] });
          if (this.three) this.boom('x_small_orange', this.m2v(s.x, s.y, 1.4), 3.5, 0.6);
        }
      });
      (F.mines || []).forEach((k) => {
        if (k.live && Math.hypot(s.x - k.x, s.y - k.y) < 3) {
          k.live = false;
          const d = this.d6() + this.d6();
          s.hull = Math.max(0, s.hull - d); g.taken[id] += d;
          this.floater(id, 'word', 'Mine!', 0); this.floater(id, 'hull', '−' + d, 1);
          g.turnRolls[id].push({ owner: id, label: 'Proximity mine', result: d + ' damage (2d6, no saves)', dice: [] });
          if (this.three) { this.boom('x_breach_red', this.m2v(k.x, k.y, 1.4), 5, 0.8); this.sfx('hit_big', 0.8); this.addShake(0.8); }
        }
      });
      if (s.def.side === 'concord' && !s.def.npc) (F.beacons || []).forEach((k) => {
        if (!k.got && Math.hypot(s.x - k.x, s.y - k.y) < 5) { k.got = true; this.floater(id, 'word', 'Salvage recovered', 0); if (this.three) this.flash('i_sparks_gold', this.m2v(k.x, k.y, 1.5), 4, 0.5, true); }
      });
      if (s.hull <= 0 && !s.dead) { s.dead = true; s.deadAt = performance.now(); if (this.three) this.explode(s); }
    });
    this.updateFeatures();
  }

  // Gravity well: every destination within its pull is dragged toward the centre.
  bend(d) {
    const w = this.g.feat.well, dx = w.x - d.x, dy = w.y - d.y, r = Math.hypot(dx, dy);
    if (r > w.r || r < 0.5) return d;
    const k = Math.min(r, w.pull * (1 - r / w.r) + 1.2);
    return { x: d.x + dx / r * k, y: d.y + dy / r * k };
  }

  defMod(B, r, w) { return (B.def.ecm && r > 24 ? 1 : 0) + (B.def.pd && w.lance ? 1 : 0); }


  // Asteroids block fire between ships.
  blocked(A, T) {
    const rocks = (this.g.feat && this.g.feat.rocks) || [];
    for (let i = 0; i < rocks.length; i++) {
      const k = rocks[i], dx = T.x - A.x, dy = T.y - A.y, L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((k.x - A.x) * dx + (k.y - A.y) * dy) / L2));
      if (Math.hypot(A.x + dx * t - k.x, A.y + dy * t - k.y) < k.r * 0.85) return true;
    }
    return false;
  }

  env(s, order) {
    const held = s.heldTurn && this.g && s.heldTurn === this.g.turn ? 4 : 0;
    const speed = Math.max(4, s.def.speed - 4 * this.count(s, 'engines') - held);
    let turn = Math.max(15, s.def.turn - 15 * this.count(s, 'steering'));
    let minMove = speed / 2, maxMove = speed;
    if (order === 'aaf' || order === 'ram') { minMove = speed; maxMove = speed * 1.5; if (!(order === 'aaf' && s.def && s.def.capTrait === 'daredevil')) turn = turn / 2; }
    if (order === 'about') { minMove = 2; maxMove = speed / 2; turn = turn + 30; }
    if (order === 'lock') { turn = turn / 2; }
    return { speed: speed, turn: turn, minMove: minMove, maxMove: maxMove };
  }

  clampDest(s, order, px, py) {
    const e = this.env(s, order);
    const tl = e.turn * Math.PI / 180;
    let d = Math.hypot(px - s.x, py - s.y);
    let b = d < 1e-6 ? 0 : this.norm(Math.atan2(py - s.y, px - s.x) - s.h);
    b = Math.max(-tl, Math.min(tl, b));
    d = Math.max(e.minMove, Math.min(e.maxMove, d));
    return { x: s.x + d * Math.cos(s.h + b), y: s.y + d * Math.sin(s.h + b) };
  }

  // Constant-curvature arc from (x,y,h) through dest. Final heading = h + 2·bearing.
  path(s, dest) {
    const x0 = s.x, y0 = s.y, h0 = s.h;
    const dx = dest.x - x0, dy = dest.y - y0, d = Math.hypot(dx, dy);
    const b = d < 1e-6 ? 0 : this.norm(Math.atan2(dy, dx) - h0);
    if (Math.abs(b) < 1e-3) {
      return { b: 0, d: d, at: (t) => ({ x: x0 + dx * t, y: y0 + dy * t, h: h0 }) };
    }
    const R = d / (2 * Math.abs(Math.sin(b))), sg = Math.sign(b);
    const cx = x0 - sg * R * Math.sin(h0), cy = y0 + sg * R * Math.cos(h0);
    return { b: b, d: d, at: (t) => { const hh = h0 + 2 * b * t; return { x: cx + sg * R * Math.sin(hh), y: cy - sg * R * Math.cos(hh), h: hh }; } };
  }

  arcOf(s, tx, ty) {
    const a = this.norm(Math.atan2(ty - s.y, tx - s.x) - s.h) * 180 / Math.PI;
    if (Math.abs(a) <= 45) return 'fore';
    if (a > 45 && a <= 135) return 'port';
    if (a < -45 && a >= -135) return 'stbd';
    return 'aft';
  }

  toHitTN(range, narrow, order, s) {
    let tn = range <= 12 ? 3 : range <= 24 ? 4 : 5;
    if (narrow) tn += 1;
    if (order === 'aaf' || order === 'ram') tn += 1;
    if (order === 'lock') tn -= 1;
    if (this.count(s, 'bridge') > 0) tn += 1;
    return Math.max(2, Math.min(6, tn));
  }

  weaponDice(s, w, order) {
    let d = w.dice;
    if (w.broadside && this.crippled(s)) d = Math.ceil(d / 2);
    if (w.broadside) { const n = s.crits.filter((c) => c.k === 'gundeck' && c.side === w.side).length; for (let i = 0; i < n; i++) d = Math.ceil(d / 2); }
    if (order === 'brace' && s.def.capTrait !== 'steady') d = Math.ceil(d / 2);
    return d;
  }

  critName(c) { return this.D.CRIT[c.roll] + (c.side ? ' (' + (c.side === 'port' ? 'port' : 'starboard') + ')' : ''); }


  modeHot() { return (this.props.mode || 'Versus AI') === 'Hot-seat'; }

  speedMul() { const v = Number(this.props.animSpeed); return v > 0 ? v : 1; }

  /* ───────────── DICE-DRIVEN GUNNERY ─────────────
     resolutionSeq() is a generator that yields every roll it needs ({type:'roll', owner, n, ...})
     and every animation beat ({type:'fx'}). The driver (advance/handle) waits for a click when the
     roll belongs to a human player and rolls automatically for the AI. */
  isHuman(id) { return this.modeHot() || this.sideOf(id) === 'concord'; }

  rollN(n) { const a = []; for (let i = 0; i < n; i++) a.push(this.d6()); return a; }

  arcDice(s, f) { let n = 0; s.def.weapons.forEach((w) => { if (w.arcs.indexOf(f) >= 0) n += this.weaponDice(s, w, 'steady'); }); return n; }

  shieldLeft(s, f) { const used = ((this.g.shieldUsed || {})[s.id] || {})[f] || 0; return Math.max(0, (s.def.shields[f] || 0) - used); }
}
