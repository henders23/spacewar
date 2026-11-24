// Gunline · battle board: 3D scene, effects, input and view values. Rules live in src/engine.
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { v: 0 };
    this.ui = { order: 'steady', enemyArcs: false, loading: true, loadNote: 'Loading 3D engine…', hover: null, sel: 'resolute' };
    this.initEngine();
    this.cam = { tx: 0, tz: 0, dist: 118, tilt: 0.62, yaw: 0 };
    this.userCam = false;
    this.setCanvas = (el) => { if (el) this.canvas = el; };
    this.setInspect = (el) => { if (el) this.inspCanvas = el; };
    this.labelEls = {}; this.labelY = {}; this.labelRefs = {}; this.tipOn = {}; this.pickOn = {};
    // Per-ship handlers are created on demand (and cached) because the roster changes from battle to battle.
    this.lref = (id) => this.labelRefs[id] || (this.labelRefs[id] = (el) => { if (el) this.labelEls[id] = el; });
    this.tipFn = (id) => this.tipOn[id] || (this.tipOn[id] = () => { this.ui.tip = id; this.bump(); });
    this.pickFn = (id) => this.pickOn[id] || (this.pickOn[id] = () => this.selectShip(id));
    this.ui.target = 'auto'; this.ui.arcBadges = true; this.ui.muted = false;
    this.shake = 0; this.slowUntil = 0;
    this.badgeEls = {}; this.badgeRefs = {}; this.targetOn = {};
    this.badgeRef = (k) => this.badgeRefs[k] || (this.badgeRefs[k] = (el) => { if (el) this.badgeEls[k] = el; });
    this.targetFn = (id) => this.targetOn[id] || (this.targetOn[id] = () => this.setTarget(id));
    this.torpClick = () => this.toggleTorp();
    this.startMissionClick = () => { if (this.save && this.save.current) this.startMission(this.save.current); };
    this.skirmish = () => { this.newGame(); };
    this.targetAuto = () => this.setTarget('auto');
    this.toggleSound = () => { this.unlockAudio(); this.ui.muted = !this.ui.muted; if (this.audio) this.audio.master.gain.value = this.ui.muted ? 0 : 0.8; this.bump(); };
    this.toggleBadges = () => { this.ui.arcBadges = !this.ui.arcBadges; this.bump(); };
    this.nextShip = () => {
      const ids = this.ids().filter((id) => !this.g.ships[id].dead);
      this.selectShip(ids[(ids.indexOf(this.ui.sel) + 1) % ids.length]);
    };
    this.rollClick = () => this.rollPending();
    this.tipOff = () => { this.ui.tip = null; this.bump(); };
    // Double-click: plot this ship here, then move on to the next unplotted ship; on the last one, commit the fleet.
    this.onDbl = (e) => {
      if (!this.g || this.g.phase !== 'orders') return;
      const p = this.pickMap(e); if (!p || this.shipAt(p)) return;
      this.setDest(p.x, p.y);
      const next = this.nextUndrafted();
      if (next) this.switchPlot(next); else this.commitOrders();
    };
    this.onDown = (e) => this.pointerDown(e);
    this.onMove = (e) => this.pointerMove(e);
    this.onUp = (e) => this.pointerUp(e);
    this.onLeave = () => { this.ui.hover = null; this.drag = null; this.refreshHover(); };
    this.onWheel = (e) => this.wheelZoom(e);
    this.noMenu = (e) => e.preventDefault();
    // A mission in progress restarts from the saved fleet; once its result is written, the button starts a skirmish instead.
    this.restart = () => { if (this.mission && this.g.phase !== 'over') this.startMission(this.mission.code.toLowerCase()); else this.newGame(); };
    this.commit = () => this.commitOrders();
    this.takeOver = () => { this.g.phase = 'orders'; this.startPlotting('reaver'); this.refreshOverlays(); this.bump(); };
    this.toggleEnemyArcs = () => { this.ui.enemyArcs = !this.ui.enemyArcs; this.refreshOverlays(); this.bump(); };
    this.zoomIn = () => { this.cam.dist = Math.max(22, this.cam.dist * 0.8); };
    this.zoomOut = () => { this.cam.dist = Math.min(230, this.cam.dist * 1.25); };
    this.recenter = () => this.frameShips();
    this.newGame(true);
    this.storeInit((sv) => this.onSave(sv));
  }

  updatePreview() {
    const g = this.g, grp = this.three && this.three.preview;
    if (grp) this.disposeGroup(grp);
    if (g.phase !== 'orders' || !g.ships[g.plotting]) { this.pv = null; return; }
    const me = g.ships[g.plotting];
    let pose = null, src = '';
    if (this.ui.hover) { const hd = this.clampDest(me, this.ui.order, this.ui.hover.x, this.ui.hover.y); pose = this.path(me, hd).at(1); src = 'hover'; }
    else if (g.dest) { pose = this.path(me, g.dest).at(1); src = 'plotted'; }
    if (!pose) { this.pv = { ship: me.def.name, empty: true }; return; }
    const r = this.previewFrom(me, pose);
    this.pv = { ship: me.def.name, src: src, r: r };
    if (!grp) return;
    const T = this.three.T;
    // Where the enemies are assumed to be, and lines to whatever this position would hit.
    r.enemies.forEach((e) => {
      const ring = this.circle(e.x, e.y, e.def.len * 0.6, 0xc5d1e6, 0.35); grp.add(ring);
      const d = r.deal[e.id];
      if (d && d.dmg > 0.05) {
        const l = new T.Line(new T.BufferGeometry().setFromPoints([this.m2v(pose.x, pose.y, 0.9), this.m2v(e.x, e.y, 0.9)]), new T.LineBasicMaterial({ toneMapped: false, color: 0xffc94d, transparent: true, opacity: Math.min(0.95, 0.25 + d.dmg * 0.18) }));
        grp.add(l);
      }
    });
    // Threats: torpedo lanes (red where they would strike this position), tractor reach rings.
    r.threats.forEach((t) => {
      if (t.kind === 'torp') {
        const p0 = this.m2v(t.from.x, t.from.y, 0.5), p1 = this.m2v(t.to.x, t.to.y, 0.5), q = this.flatQuad('none', t.reach * 2, 1, false, t.hit ? 0xff4d4d : 0xffa040);
        q.position.copy(p0).lerp(p1, 0.5); this.aim(q, p0, p1); q.userData.mesh.scale.y = p0.distanceTo(p1);
        q.userData.mesh.material.opacity = (t.hit ? 0.3 : 0.12) * (t.live ? 1 : 0.7); grp.add(q);
        grp.add(this.torpLine(t.from.x, t.from.y, t.to.x, t.to.y, t.hit ? 0.95 : 0.5));
      } else if (t.kind === 'tractor') grp.add(this.circle(t.at.x, t.at.y, t.r, 0xb59bff, 0.4));
    });
  }

  selectShip(id) {
    const g = this.g;
    this.ui.sel = id; this.inspDirty = true;
    if (g.phase === 'orders' && this.sideOf(id) === g.side && this.active(g.ships[id]) && id !== g.plotting && this.ctrl(g.side).indexOf(id) >= 0) { this.switchPlot(id); return; }
    this.bump();
  }

  bump() { this.setState({ v: (this.state.v || 0) + 1 }); }

  /* ───────────── AUDIO ─────────────
     Web Audio, unlocked on the first click/tap (browsers block sound until then). */
  unlockAudio() {
    if (this.autoAll || typeof window === 'undefined') return;
    if (this.audio) { if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = new AC(), master = ctx.createGain(), comp = ctx.createDynamicsCompressor();
    master.gain.value = this.ui.muted ? 0 : 0.8; master.connect(ctx.destination);
    comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(master);
    this.audio = { ctx: ctx, master: master, bus: comp, buf: {}, last: {} };
    Object.keys(this.D.SFX).forEach((k) => {
      fetch(this.D.SFX[k]).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, bad) => ctx.decodeAudioData(b, ok, bad))).then((buf) => { this.audio.buf[k] = buf; }).catch(() => {});
    });
  }

  sfx(name, vol, delay, rate) {
    const A = this.audio; if (!A || this.ui.muted || this.autoAll) return;
    const buf = A.buf[name]; if (!buf) return;
    const at = A.ctx.currentTime + (delay || 0);
    if (A.last[name] && Math.abs(A.last[name] - at) < 0.035) return;
    A.last[name] = at;
    const src = A.ctx.createBufferSource(), g = A.ctx.createGain();
    src.buffer = buf; src.playbackRate.value = rate || (0.93 + Math.random() * 0.14);
    g.gain.value = vol == null ? 1 : vol;
    src.connect(g); g.connect(A.bus); src.start(at);
  }

  weaponSfx(A, w) {
    const c = A.def.side === 'concord';
    if (w.lance) return c ? 'laser_beam' : 'grav_lance';
    if (w.broadside) return c ? (A.def.len >= 8 ? 'cannon_boom' : 'cannon_heavy') : 'laser_cannon';
    return c ? 'blaster_c' : 'blaster_r';
  }

  engineHum(on) {
    const A = this.audio; if (!A || !A.buf.engine) return;
    const t = A.ctx.currentTime;
    if (on) {
      if (A.engine) return;
      const src = A.ctx.createBufferSource(), g = A.ctx.createGain();
      src.buffer = A.buf.engine; src.loop = true;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.6);
      src.connect(g); g.connect(A.bus); src.start(); A.engine = { src: src, g: g };
    } else if (A.engine) {
      const e = A.engine; A.engine = null;
      e.g.gain.cancelScheduledValues(t); e.g.gain.setValueAtTime(e.g.gain.value, t); e.g.gain.linearRampToValueAtTime(0, t + 0.8); e.src.stop(t + 0.9);
    }
  }

  // Dice clatter, synthesised from filtered noise bursts (the pack has no dice sound).
  diceRattle(n) {
    const A = this.audio; if (!A || this.ui.muted || this.autoAll) return;
    const ctx = A.ctx;
    if (!A.noise) { const len = Math.floor(ctx.sampleRate * 0.03), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); A.noise = b; }
    const clicks = Math.min(11, 3 + n);
    for (let i = 0; i < clicks; i++) {
      const t = ctx.currentTime + i * 0.04 + Math.random() * 0.03, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = A.noise; src.playbackRate.value = 0.6 + Math.random() * 0.8;
      f.type = 'bandpass'; f.frequency.value = 1600 + Math.random() * 2400; f.Q.value = 3;
      g.gain.value = 0.55 * (1 - i / clicks) + 0.12;
      src.connect(f); f.connect(g); g.connect(A.bus); src.start(t);
    }
  }

  // Brief tumbling-dice animation before the real faces are revealed.
  tumble(q, dice, done) {
    let k = 0;
    this.diceRattle(q.n);
    this.rolling = { q: q, faces: dice.map(() => this.d6()) };
    this.bump();
    const step = () => {
      if (!this.alive) return;
      k++;
      if (k >= 6) { this.rolling = null; done(); return; }
      this.rolling.faces = dice.map(() => this.d6());
      this.bump();
      setTimeout(step, 65);
    };
    setTimeout(step, 65);
  }

  playFx(q) {
    if (q.kind === 'bolts') {
      let maxT = 0;
      q.shots.forEach((sh, i) => { const t = i * 0.08 / this.speedMul(); maxT = Math.max(maxT, t); this.bolt(q.A, q.B, sh, t, i); });
      return (maxT + 0.55 / this.speedMul()) * 1000;
    }
    if (q.kind === 'shield') { this.shieldFlash(q.id, 0); this.sfx('shield_zap', 0.8); return 320; }
    if (q.kind === 'explode') { this.explode(q.ship); return 2900; }
    if (q.kind === 'ram') {
      const A = q.A, B = q.B, mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      this.boom('x_breach_red', this.m2v(mx, my, 1.6), 6, 0.8);
      for (let i = 0; i < 3; i++) this.boom('x_small_orange', this.m2v(mx + (Math.random() - 0.5) * 4, my + (Math.random() - 0.5) * 4, 1.5), 3, 0.6, 0.1 + i * 0.1);
      this.sfx('collision', 1, 0, 0.9); this.sfx('hit_big', 0.8, 0.05);
      this.addShake(2); this.kick(A.id, 0.3); this.kick(B.id, -0.35); this.slowUntil = performance.now() + 450;
      return 1100;
    }
    if (q.kind === 'pods') {
      const T = this.three.T, A = q.A, B = q.B, SD = this.D.SIDES[A.def.side];
      for (let i = 0; i < Math.min(6, q.n); i++) {
        const from = this.m2v(A.x + (Math.random() - 0.5) * 3, A.y + (Math.random() - 0.5) * 3, 1.8), to = this.hullPoint(B);
        const sp = this.flatQuad('p_boarding_torpedo', 0.7, 1.25, false, SD.bolt); this.aim(sp, from, to); this.three.fxg.add(sp);
        sp.material = sp.userData.mesh.material;
        const fx = { t: -i * 0.12 };
        fx.update = (dt) => { fx.t += dt; if (fx.t < 0) { sp.position.copy(from); return true; } const k = Math.min(1, fx.t / 0.9); sp.position.copy(from).lerp(to, k * k * (3 - 2 * k)); sp.position.y += Math.sin(k * Math.PI) * 2; if (k >= 1) { this.three.fxg.remove(sp); sp.material.dispose(); sp.userData.mesh.geometry.dispose(); this.flash('i_sparks_gold', to, 1.4, 0.25, true); return false; } return true; };
        fx.kill = () => this.three.fxg.remove(sp);
        this.fx.push(fx);
      }
      this.sfx('shield_zap', 0.5, 0, 0.7);
      return 1500;
    }
    if (q.kind === 'melee') {
      const B = q.B;
      for (let i = 0; i < Math.max(2, q.n * 2); i++) this.flash(i % 2 ? 'i_sparks_gold' : 'm_rail', this.hullPoint(B), 1 + Math.random() * 0.8, 0.25, true);
      this.sfx('blaster_c', 0.45, 0); this.sfx('blaster_r', 0.45, 0.12); this.sfx('hit_small', 0.35, 0.2);
      return 650;
    }
    if (q.kind === 'torpedo') {
      const B = q.B, at = this.m2v(q.t.x, q.t.y, 1.4), hp = this.hullPoint(B);
      this.boom('x_breach_red', hp, 7, 0.9); this.boom('x_capital_orange', at, 4, 0.7, 0.08);
      this.sfx('hit_big', 1); this.sfx('explode_med', 0.7, 0.06);
      this.addShake(1.6); this.kick(B.id, 0.3); this.slowUntil = performance.now() + 350;
      return 1000;
    }
    if (q.kind === 'tractor') {
      const t3 = this.three, T = t3.T, A = q.A, B = q.B, o = t3.objs[B.id], to = { x: B.x, y: B.y }, dur = 1.1 / this.speedMul();
      const beam = this.flatQuad('p_lance_violet', 1.6, 1, true, 0xb59bff), core = this.flatQuad('none', 0.35, 1, false, 0xe9e0ff), halo = this.flatQuad('none', 2.2, 1, false, 0x8a6cff);
      [beam, core, halo].forEach((q2) => { q2.userData.mesh.material.depthTest = false; q2.userData.mesh.renderOrder = 5; t3.fxg.add(q2); });
      const glow = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: t3.glowTex, color: 0xb59bff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false })); glow.scale.setScalar(5); glow.renderOrder = 5; t3.fxg.add(glow);
      const fx = { t: 0 };
      fx.update = (dt) => {
        fx.t += dt; const k = Math.min(1, fx.t / dur), e = k * k * (3 - 2 * k);
        const bx = q.won ? q.from.x + (to.x - q.from.x) * e : q.from.x, by = q.won ? q.from.y + (to.y - q.from.y) * e : q.from.y;
        if (o) o.root.position.set(bx, 0, -by);
        const hy = Math.max(A.def.deckY || 2, B.def.deckY || 2) + 1.2, p0 = this.m2v(A.x, A.y, hy), p1 = this.m2v(bx, by, hy), len = p0.distanceTo(p1);
        const op = (q.won ? 1 : 1 - k) * (k > 0.85 && q.won ? (1 - k) / 0.15 : 1), pulse = Math.sin(fx.t * 30);
        [[beam, 1.4 + 0.5 * pulse, 0.9], [core, 0.5 + 0.12 * pulse, 1], [halo, 1.7 + 0.4 * pulse, 0.6]].forEach((a) => { a[0].position.copy(p0).lerp(p1, 0.5); this.aim(a[0], p0, p1); a[0].userData.mesh.scale.set(a[1], len, 1); a[0].userData.mesh.material.opacity = a[2] * op; });
        glow.position.copy(p1); glow.material.opacity = 0.8 * (1 - k * 0.5);
        if (k >= 1) { [beam, core, halo].forEach((q2) => { t3.fxg.remove(q2); q2.userData.mesh.material.dispose(); }); t3.fxg.remove(glow); glow.material.dispose(); return false; }
        return true;
      };
      fx.kill = () => { [beam, core, halo, glow].forEach((q2) => t3.fxg.remove(q2)); };
      this.fx.push(fx);
      this.sfx('grav_lance', 0.6, 0, 0.6);
      if (!q.won) this.flash('s_hit_purple', this.m2v(q.from.x, q.from.y, 1.5), 3, 0.35, true);
      return dur * 1000 + 150;
    }
    if (q.kind === 'torpKill') { this.flash('i_sparks_gold', this.m2v(q.t.x, q.t.y, 1.4), 3, 0.4, true); this.boom('x_small_orange', this.m2v(q.t.x, q.t.y, 1.4), 2.5, 0.5); this.sfx('blaster_c', 0.5); return 600; }
    if (q.kind === 'captured') {
      const o = this.three.objs[q.B.id];
      o.ring.material.color.setHex(this.D.SIDES[q.A.def.side].hex); o.glow.visible = false;
      this.spark(q.B.x, q.B.y, 0xffffff, 8); this.sfx('hit_big', 0.5);
      return 1200;
    }
    return 0;
  }

  /* ───────────── THREE.JS SCENE ───────────── */
  componentDidMount() {
    this.alive = true;
    let tries = 0;
    const wait = () => {
      if (!this.alive) return;
      const T = window.THREE;
      if (!this.canvas) this.canvas = document.querySelector('[data-broadside-canvas]');
      if (T && T.GLTFLoader && this.canvas) { this.init3D(); return; }
      if (++tries > 200) { this.ui.loadNote = '3D engine failed to load.'; this.bump(); return; }
      setTimeout(wait, 75);
    };
    wait();
  }

  componentWillUnmount() {
    this.alive = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    if (this.ro2) this.ro2.disconnect();
    if (this.insp) this.insp.r.dispose();
    if (this.three) this.three.renderer.dispose();
  }

  init3D() {
    const T = window.THREE;
    const canvas = this.canvas;
    const renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new T.Scene();
    scene.background = new T.Color(0x000000);
    const camera = new T.PerspectiveCamera(40, 1.6, 0.5, 2000);
    scene.add(new T.HemisphereLight(0xbfd4ff, 0x1a1420, 0.9));
    const key = new T.DirectionalLight(0xfff1e0, 2.4); key.position.set(40, 80, 30); scene.add(key);
    const rim = new T.DirectionalLight(0x7fa8ff, 1.0); rim.position.set(-50, 30, -60); scene.add(rim);
    this.three = { T: T, renderer: renderer, scene: scene, camera: camera, objs: {}, overlay: new T.Group(), hover: new T.Group(), preview: new T.Group(), fxg: new T.Group(), ray: new T.Raycaster(), plane: new T.Plane(new T.Vector3(0, 1, 0), 0) };
    scene.add(this.three.overlay); scene.add(this.three.hover); scene.add(this.three.preview); scene.add(this.three.fxg);
    this.three.glowTex = this.radialTex();
    this.three.tex = {};
    const tl = new T.TextureLoader();
    Object.keys(this.D.ART).forEach((k) => tl.load(this.D.ART[k], (t) => { t.encoding = T.sRGBEncoding; this.three.tex[k] = t; }));
    this.buildBackdrop();
    this.three.models = {}; this.three.featG = new T.Group(); scene.add(this.three.featG);
    this.syncShipObjs();
    this.placeShips();
    this.frameShips(true);
    this.refreshOverlays();
    const fit = () => {
      const p = canvas.parentElement; if (!p) return;
      const w = Math.max(1, p.clientWidth), h = Math.max(1, p.clientHeight);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    fit();
    if (window.ResizeObserver) { this.ro = new ResizeObserver(fit); this.ro.observe(canvas.parentElement); }
    this.last = performance.now();
    const loop = (now) => { if (!this.alive) return; this.frame(now); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    this.initInspector();
    this.ui.loadNote = 'Loading ship models…';
    this.bump();
    this.buildFeatures();
    Promise.all(this.loadNeededModels()).then((r) => {
      this.ui.loading = false;
      if (r.indexOf(null) >= 0) this.pushLog('SYSTEM', [{ side: 'sys', text: 'A ship model could not load; showing a stand-in hull.' }]);
      this.refreshOverlays();
      this.bump();
    });
  }

  radialTex() {
    const T = this.three.T, c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }

  buildBackdrop() {
    const T = this.three.T, sc = this.three.scene, W = this.D.W, H = this.D.H;
    const n = 2000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 400 + Math.random() * 500, th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 1.6 - 0.6);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = -Math.abs(r * Math.cos(ph)) - 40; pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const k = 0.25 + Math.random() * 0.55, tint = Math.random();
      col[i * 3] = k * (tint < 0.2 ? 0.8 : 1); col[i * 3 + 1] = k * 0.92; col[i * 3 + 2] = k * (tint > 0.75 ? 1 : 0.85);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    sc.add(new T.Points(g, new T.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85 })));
    // Faint reference grid (orientation aid only — movement is free, not square-based)
    const lp = [];
    for (let x = -W / 2; x <= W / 2; x += 10) lp.push(x, 0, -H / 2, x, 0, H / 2);
    for (let y = -H / 2; y <= H / 2; y += 10) lp.push(-W / 2, 0, y, W / 2, 0, y);
    const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(lp, 3));
    sc.add(new T.LineSegments(gg, new T.LineBasicMaterial({ toneMapped: false, color: 0x1a2a44, transparent: true, opacity: 0.35 })));
    const bp = [-W / 2, 0, -H / 2, W / 2, 0, -H / 2, W / 2, 0, H / 2, -W / 2, 0, H / 2];
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(bp, 3));
    sc.add(new T.LineLoop(bg, new T.LineBasicMaterial({ toneMapped: false, color: 0x3a5a8a, transparent: true, opacity: 0.8 })));
  }

  buildShipObj(def) {
    const T = this.three.T;
    const root = new T.Group();
    const model = new T.Group(); root.add(model);
    // Stand-in hull until the real model arrives
    const stand = new T.Group();
    const mat = new T.MeshStandardMaterial({ color: 0x8a94a6, metalness: 0.6, roughness: 0.45 });
    const hullM = new T.Mesh(new T.BoxGeometry(1.8, 1.1, 6), mat); hullM.position.y = 0.8; stand.add(hullM);
    const prow = new T.Mesh(new T.ConeGeometry(0.9, 2, 4), mat); prow.rotation.x = Math.PI / 2; prow.position.set(0, 0.8, 4); stand.add(prow);
    model.add(stand);
    const ring = new T.Mesh(new T.RingGeometry(4.8, 5.2, 48), new T.MeshBasicMaterial({ toneMapped: false, color: def.hex, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; root.add(ring);
    const glow = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: this.three.glowTex, color: this.D.SIDES[def.side].glow, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
    const k8 = def.len / 8;
    ring.scale.setScalar(k8);
    glow.position.set(0, 1.3, -4.3 * k8); glow.scale.set(2.6, 2.6, 1); root.add(glow);
    const shield = new T.Mesh(new T.SphereGeometry(1, 28, 18), new T.MeshBasicMaterial({ toneMapped: false, color: def.hex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    shield.scale.set(3.0 * Math.max(k8, def.beam > 1.2 ? k8 : 1.3), 2.1, 5.4 * k8); shield.position.y = 1.2; root.add(shield);
    this.three.scene.add(root);
    return { root: root, model: model, stand: stand, ring: ring, glow: glow, shield: shield, flash: 0, ghostSrc: null };
  }

  // Each ship class's model loads once; every ship of that class gets its own copy.
  loadClassModel(cls) {
    this.modelP = this.modelP || {};
    if (this.modelP[cls]) return this.modelP[cls];
    const T = this.three.T, def = this.D.CLASSES[cls], a = def.assets;
    const tl = new T.TextureLoader();
    const tex = (u) => new Promise((ok) => tl.load(u, ok, undefined, () => ok(null)));
    const p = fetch(a.mesh).then((r) => r.json()).then((j) => {
      const bin = atob(j.glb), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return Promise.all([new Promise((ok, bad) => new T.GLTFLoader().parse(buf.buffer, '', ok, bad)), tex(a.base), tex(a.normal), tex(a.rm)]);
    }).then((res) => {
      const gltf = res[0], base = res[1], normal = res[2], rm = res[3];
      [base, normal, rm].forEach((t) => { if (t) { t.flipY = false; t.anisotropy = 4; } });
      if (base) base.encoding = T.sRGBEncoding;
      const mat = new T.MeshStandardMaterial({ map: base, normalMap: normal, roughnessMap: rm, metalnessMap: rm, metalness: rm ? 0.45 : 0.4, roughness: rm ? 1 : 0.55, color: base ? (def.tint || 0xffffff) : 0x8a94a6 });
      const m = gltf.scene;
      m.traverse((o) => { if (o.isMesh) o.material = mat; });
      const holder = new T.Group(); holder.add(m);
      if (def.rotY) m.rotation.y = def.rotY;
      holder.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(holder), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
      // Length normalised to the class length; beam and height scaled so hulls read broad and solid from above.
      const k = def.len / size.z, kx = k * def.beam, ky = k * 1.3;
      def.halfBeamU = size.x * kx / 2;
      def.deckY = 0.3 + size.y * ky * 0.8;
      holder.scale.set(kx, ky, k);
      holder.position.set(-c.x * kx, -box.min.y * ky + 0.3, -c.z * k);
      this.three.models[cls] = holder;
      this.ids().forEach((id) => { if (this.D.SHIPS[id].cls === cls) this.attachModel(id); });
      return true;
    }).catch(() => null);
    this.modelP[cls] = p;
    return p;
  }

  loadNeededModels() { const cls = {}; this.ids().forEach((id) => { cls[this.D.SHIPS[id].cls] = 1; }); return Object.keys(cls).map((c) => this.loadClassModel(c)); }


  attachModel(id) {
    const o = this.three.objs[id], src = this.three.models[this.D.SHIPS[id].cls];
    if (!o || !src || o.attached) return;
    const m = src.clone(true);
    if (o.stand.parent) o.model.remove(o.stand);
    o.model.add(m); o.ghostSrc = m; o.attached = true;
    this.inspAdd(id, m);
  }

  // Keep one 3D object per ship in this battle's roster.
  syncShipObjs() {
    const t3 = this.three; if (!t3) return;
    Object.keys(t3.objs).forEach((id) => {
      if (this.D.SHIPS[id] && t3.objs[id].defRef === this.D.SHIPS[id]) return;
      t3.scene.remove(t3.objs[id].root);
      if (this.insp && this.insp.models[id]) { this.insp.sc.remove(this.insp.models[id]); delete this.insp.models[id]; }
      delete t3.objs[id];
    });
    this.ids().forEach((id) => { if (!t3.objs[id]) { const o = this.buildShipObj(this.D.SHIPS[id]); o.defRef = this.D.SHIPS[id]; t3.objs[id] = o; this.attachModel(id); } });
  }

  // Mission map features: asteroids, mines, salvage beacons, the gravity well and the exit edge.
  buildFeatures() {
    const t3 = this.three; if (!t3 || !t3.featG) return;
    const T = t3.T, grp = t3.featG, F = this.g.feat || {}, W = this.D.W / 2, H = this.D.H / 2;
    this.disposeGroup(grp);
    (F.rocks || []).forEach((k, i) => {
      const geo = new T.IcosahedronGeometry(k.r, 1), pos = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) { const f = 0.75 + 0.45 * Math.abs(Math.sin(v * 12.9898 + i * 7.1)); pos.setXYZ(v, pos.getX(v) * f, pos.getY(v) * f * 0.6, pos.getZ(v) * f); }
      geo.computeVertexNormals();
      const rock = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x3a3631, roughness: 1, metalness: 0, flatShading: true }));
      rock.position.set(k.x, 0.6, -k.y); rock.rotation.set(i, i * 2.3, i * 0.7); grp.add(rock);
    });
    (F.nebula || []).forEach((n, i) => {
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + i, rr = k === 0 ? 0 : n.r * 0.55;
        const sp = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: t3.glowTex, color: k % 2 ? 0x6a4fb8 : 0x3f5fa8, transparent: true, opacity: 0.32, depthWrite: false }));
        sp.position.set(n.x + Math.cos(a) * rr, 0.4 + k * 0.05, -(n.y + Math.sin(a) * rr)); sp.scale.setScalar(n.r * (k === 0 ? 2.2 : 1.4)); grp.add(sp);
      }
      grp.add(this.circle(n.x, n.y, n.r, 0x9a7bff, 0.35));
    });
    (F.beacons || []).forEach((b) => {
      const g2 = new T.Group(); g2.userData.beacon = b;
      const ring = new T.Mesh(new T.RingGeometry(1.4, 1.9, 32), new T.MeshBasicMaterial({ toneMapped: false, color: 0xffc94d, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; g2.add(ring);
      const sp = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: t3.glowTex, color: 0xffc94d, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); sp.position.y = 1.2; sp.scale.setScalar(3); g2.add(sp);
      g2.add(this.circle(0, 0, 5, 0xffc94d, 0.4));
      g2.position.set(b.x, 0.1, -b.y); grp.add(g2);
    });
    (F.mines || []).forEach((k) => {
      const sp = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: t3.glowTex, color: 0xff3b3b, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      sp.position.set(k.x, 1, -k.y); sp.scale.setScalar(1.8); sp.userData.mine = k; grp.add(sp);
    });
    if (F.well) {
      const wg = new T.Group(); wg.userData.well = true;
      for (let i = 1; i <= 4; i++) wg.add(this.circle(0, 0, F.well.r * i / 4, 0x9a7bff, 0.12 + 0.08 * (4 - i)));
      for (let a = 0; a < 6; a++) {
        const pts = []; for (let t = 0; t <= 24; t++) { const rr = F.well.r * (1 - t / 26), ang = a * Math.PI / 3 + t * 0.12; pts.push(new T.Vector3(Math.cos(ang) * rr, 0.08, Math.sin(ang) * rr)); }
        wg.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ toneMapped: false, color: 0xb59bff, transparent: true, opacity: 0.35 })));
      }
      wg.position.set(F.well.x, 0, -F.well.y); grp.add(wg);
    }
    const ex = this.mission && this.mission.exit;
    if (ex) {
      const band = new T.Mesh(new T.PlaneGeometry(4, this.D.H), new T.MeshBasicMaterial({ toneMapped: false, color: 0x7be3a4, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false }));
      band.rotation.x = -Math.PI / 2; band.position.set(ex.edge === 'west' ? -W + 2 : W - 2, 0.05, 0); grp.add(band);
    }
  }

  // One marker per torpedo in flight: warhead art, a drive glow in the launcher's colour, and a small ring.
  syncTorps() {
    const t3 = this.three; if (!t3) return;
    const T = t3.T, g = this.g, live = {};
    if (!t3.torpG) { t3.torpG = new T.Group(); t3.scene.add(t3.torpG); t3.torpObjs = {}; }
    (g.torps || []).forEach((t) => { if (!t.gone) live[t.id] = t; });
    Object.keys(t3.torpObjs).forEach((k) => { if (!live[k]) { this.disposeGroup(t3.torpObjs[k]); t3.torpG.remove(t3.torpObjs[k]); delete t3.torpObjs[k]; } });
    Object.keys(live).forEach((k) => {
      if (t3.torpObjs[k]) return;
      const SD = this.D.SIDES[live[k].side], grp = new T.Group();
      const body = this.flatQuad('p_boarding_torpedo', 1.3, 2.8, false, SD.bolt); body.rotation.y = Math.PI; grp.add(body);
      const glow = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: t3.glowTex, color: SD.glow, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(3.2); glow.position.set(0, 0, 1.6); grp.add(glow);
      const ring = new T.Mesh(new T.RingGeometry(1.5, 1.8, 24), new T.MeshBasicMaterial({ toneMapped: false, color: 0xffa040, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -0.7; grp.add(ring);
      t3.torpObjs[k] = grp; t3.torpG.add(grp);
    });
    this.placeTorps(1, true);
  }

  // Torpedo markers along their run (k = 0…1 of the move), or at rest.
  placeTorps(k, rest) {
    const t3 = this.three; if (!t3 || !t3.torpObjs) return;
    (this.g.torps || []).forEach((t) => {
      const o = t3.torpObjs[t.id]; if (!o) return;
      let x = t.x, y = t.y, h = t.h;
      if (!rest && t.from && t.to) { x = t.from.x + (t.to.x - t.from.x) * k; y = t.from.y + (t.to.y - t.from.y) * k; h = t.to.h; }
      o.position.set(x, 1.4, -y); o.rotation.y = h + Math.PI / 2;
    });
  }

  updateFeatures() {
    const t3 = this.three; if (!t3 || !t3.featG) return;
    t3.featG.children.forEach((c) => { if (c.userData.beacon) c.visible = !c.userData.beacon.got; if (c.userData.mine) c.visible = c.userData.mine.live !== false; });
  }

  initInspector() {
    const T = this.three.T, cv = this.inspCanvas || document.querySelector('[data-bs-inspect]');
    if (!cv) return;
    const r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.3;
    r.setClearColor(0x000000, 0);
    const sc = new T.Scene();
    sc.add(new T.HemisphereLight(0xdfe8ff, 0x202030, 1.1));
    const d = new T.DirectionalLight(0xffffff, 2.2); d.position.set(4, 20, 6); sc.add(d);
    // Orthographic, straight down, bow toward the top of the panel: 15u across = the SVG overlay's 300 px.
    const cam = new T.OrthographicCamera(-7.5, 7.5, 7.5, -7.5, 0.1, 100);
    cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
    this.insp = { T: T, r: r, sc: sc, cam: cam, models: {} };
    const fit = () => { const p = cv.parentElement; if (!p) return; r.setSize(Math.max(1, p.clientWidth), Math.max(1, p.clientHeight), false); this.inspDirty = true; };
    fit();
    if (window.ResizeObserver) { this.ro2 = new ResizeObserver(fit); this.ro2.observe(cv.parentElement); }
    this.inspDirty = true;
  }

  inspAdd(id, src) {
    if (!this.insp) return;
    const g = new this.insp.T.Group();
    g.add(src.clone(true));
    g.rotation.y = Math.PI;
    this.insp.sc.add(g);
    this.insp.models[id] = g;
    this.inspDirty = true;
  }

  renderInspector() {
    const I = this.insp; if (!I) return;
    Object.keys(I.models).forEach((id) => { I.models[id].visible = id === this.ui.sel && !this.g.ships[id].dead; });
    I.r.render(I.sc, I.cam);
    this.inspDirty = false;
  }


  // Blue shield / red dice badges on each side of every ship, in screen space.
  placeBadges() {
    const t3 = this.three, w = this.canvas.clientWidth, h = this.canvas.clientHeight, ang = { fore: 0, port: Math.PI / 2, stbd: -Math.PI / 2, aft: Math.PI };
    this.ids().forEach((id) => {
      const s = this.g.ships[id], o = t3.objs[id], gone = !o || s.dead || s.fled || s.captured || s.away || s.escaped, hd = o.root.rotation.y - Math.PI / 2, rr = 5 * s.def.len / 8 + 1.3;
      this.D.FACINGS.forEach((f) => {
        const el = this.badgeEls[id + ':' + f]; if (!el) return;
        if (gone || !this.ui.arcBadges) { el.style.transform = 'translate(-9999px, 0)'; return; }
        const a = hd + ang[f], v = new t3.T.Vector3(o.root.position.x + Math.cos(a) * rr, 0.6, o.root.position.z - Math.sin(a) * rr).project(t3.camera);
        if (v.z > 1) { el.style.transform = 'translate(-9999px, 0)'; return; }
        el.style.transform = 'translate(' + ((v.x + 1) / 2 * w).toFixed(1) + 'px, ' + ((1 - v.y) / 2 * h).toFixed(1) + 'px) translate(-50%, -50%)';
      });
    });
  }

  // Name tags that float above each ship in screen space.
  placeLabels() {
    const t3 = this.three, w = this.canvas.clientWidth, h = this.canvas.clientHeight, placed = [];
    this.ids().forEach((id) => {
      const el = this.labelEls[id]; if (!el) return;
      const s = this.g.ships[id], o = t3.objs[id];
      if (s.fled || s.away || s.escaped || (s.dead && performance.now() - (s.deadAt || 0) > 3200)) { el.style.transform = 'translate(-9999px, 0)'; return; }
      const v = o.root.position.clone(); v.y = 4.2; v.project(t3.camera);
      if (v.z > 1) { el.style.transform = 'translate(-9999px, 0)'; return; }
      const x = (v.x + 1) / 2 * w, lw = el.offsetWidth || 100, lh = (el.offsetHeight || 20) + 3;
      let y = (1 - v.y) / 2 * h;
      // Nudge upward while this tag would overlap one already placed this frame.
      for (let guard = 0; guard < 6; guard++) {
        const hit = placed.find((q) => Math.abs(q.x - x) < (q.w + lw) / 2 && Math.abs(q.y - y) < lh);
        if (!hit) break;
        y = hit.y - lh;
      }
      placed.push({ x: x, y: y, w: lw });
      this.labelY[id] = y / h;
      el.style.zIndex = this.ui.tip === id ? '20' : '1';
      el.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px) translate(-50%, -100%)';
    });
  }

  m2v(x, y, h) { return new this.three.T.Vector3(x, h || 0, -y); }


  placeShips() {
    if (!this.three) return;
    this.ids().forEach((id) => {
      const s = this.g.ships[id], o = this.three.objs[id]; if (!o) return;
      o.root.position.set(s.x, 0, -s.y);
      o.root.rotation.y = s.h + Math.PI / 2;
      o.root.visible = !s.away && !s.escaped;
    });
  }

  frameShips(instant) {
    const live = this.ids().map((id) => this.g.ships[id]).filter((s) => !s.dead);
    if (!live.length) return;
    let cx = 0, cy = 0, span = 0;
    live.forEach((s) => { cx += s.x; cy += s.y; });
    cx /= live.length; cy /= live.length;
    live.forEach((a) => live.forEach((b) => { span = Math.max(span, Math.hypot(a.x - b.x, a.y - b.y)); }));
    this.cam.tx = cx; this.cam.tz = -cy;
    this.cam.dist = Math.min(200, Math.max(span + 34, 60) * 1.15);
  }

  disposeGroup(g) {
    while (g.children.length) {
      const c = g.children.pop();
      c.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); if (o.material && !o.userData.sharedMat) o.material.dispose(); });
    }
  }

  sector(x, y, r0, r1, a0, a1, color, op, lineOp) {
    const T = this.three.T, grp = new T.Group();
    const geo = new T.RingGeometry(Math.max(0.01, r0), r1, 64, 1, a0, a1 - a0);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ toneMapped: false, color: color, transparent: true, opacity: op, side: T.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, -y); grp.add(m);
    if (lineOp) {
      const pts = [], N = 48;
      for (let i = 0; i <= N; i++) { const a = a0 + (a1 - a0) * i / N; pts.push(this.m2v(x + r1 * Math.cos(a), y + r1 * Math.sin(a), 0.07)); }
      for (let i = N; i >= 0; i--) { const a = a0 + (a1 - a0) * i / N; pts.push(this.m2v(x + r0 * Math.cos(a), y + r0 * Math.sin(a), 0.07)); }
      const lg = new T.BufferGeometry().setFromPoints(pts);
      grp.add(new T.LineLoop(lg, new T.LineBasicMaterial({ toneMapped: false, color: color, transparent: true, opacity: lineOp })));
    }
    return grp;
  }

  circle(x, y, r, color, op) {
    const T = this.three.T, pts = [];
    for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(this.m2v(x + r * Math.cos(a), y + r * Math.sin(a), 0.06)); }
    const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ toneMapped: false, color: color, transparent: true, opacity: op, dashSize: 1.2, gapSize: 1.2 }));
    l.computeLineDistances();
    return l;
  }

  arcsFor(grp, def, x, y, h, op) {
    const D = Math.PI / 180;
    const ranges = {};
    def.weapons.forEach((w) => w.arcs.forEach((a) => { if (w.dice > 1) ranges[a] = Math.max(ranges[a] || 0, w.range); }));
    const span = { fore: [-45, 45], port: [45, 135], stbd: [-135, -45], aft: [135, 225] };
    Object.keys(span).forEach((a) => {
      const r = ranges[a]; if (!r) return;
      const strong = a === 'port' || a === 'stbd' || a === 'fore';
      grp.add(this.sector(x, y, 0, r, h + span[a][0] * D, h + span[a][1] * D, def.hex, strong ? op : op * 0.5, strong ? op * 4 : op * 2));
    });
    grp.add(this.circle(x, y, 12, 0xffffff, 0.18));
    grp.add(this.circle(x, y, 24, 0xffffff, 0.12));
  }

  targetLine(x0, y0, x1, y1, op) {
    const T = this.three.T;
    const l = new T.Line(new T.BufferGeometry().setFromPoints([this.m2v(x0, y0, 0.6), this.m2v(x1, y1, 0.6)]), new T.LineDashedMaterial({ toneMapped: false, color: 0xff4d4d, transparent: true, opacity: op, dashSize: 1.4, gapSize: 0.9 }));
    l.computeLineDistances();
    return l;
  }

  torpLine(x0, y0, x1, y1, op) {
    const T = this.three.T;
    const l = new T.Line(new T.BufferGeometry().setFromPoints([this.m2v(x0, y0, 0.9), this.m2v(x1, y1, 0.9)]), new T.LineDashedMaterial({ toneMapped: false, color: 0xffa040, transparent: true, opacity: op, dashSize: 0.5, gapSize: 0.9 }));
    l.computeLineDistances();
    return l;
  }

  reticle(t, op) {
    const T = this.three.T, r = t.def.len * 0.75, grp = new T.Group();
    const ring = new T.Mesh(new T.RingGeometry(r, r + 0.35, 48), new T.MeshBasicMaterial({ toneMapped: false, color: 0xff4d4d, transparent: true, opacity: op, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; grp.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, tick = new T.Mesh(new T.PlaneGeometry(0.3, 1.4), new T.MeshBasicMaterial({ toneMapped: false, color: 0xff4d4d, transparent: true, opacity: op, side: T.DoubleSide, depthWrite: false }));
      tick.rotation.x = -Math.PI / 2; tick.rotation.z = a; tick.position.set(Math.sin(a) * (r + 1.1), 0, Math.cos(a) * (r + 1.1)); grp.add(tick);
    }
    grp.position.set(t.x, 0.12, -t.y);
    return grp;
  }

  pathLine(s, dest, color, op) {
    const T = this.three.T, p = this.path(s, dest), pts = [];
    for (let i = 0; i <= 32; i++) { const q = p.at(i / 32); pts.push(this.m2v(q.x, q.y, 0.25)); }
    return new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ toneMapped: false, color: color, transparent: true, opacity: op }));
  }

  ghost(def, x, y, h, op) {
    const T = this.three.T, src = this.three.objs[def.id].ghostSrc, grp = new T.Group();
    if (src) {
      const c = src.clone(true);
      c.traverse((o) => { if (o.isMesh) { o.userData.shared = true; o.material = new T.MeshBasicMaterial({ toneMapped: false, color: def.hex, transparent: true, opacity: op, depthWrite: false }); } });
      grp.add(c);
    } else {
      const m = new T.Mesh(new T.ConeGeometry(1.2, 6, 4), new T.MeshBasicMaterial({ toneMapped: false, color: def.hex, transparent: true, opacity: op }));
      m.rotation.x = Math.PI / 2; m.position.y = 0.8; grp.add(m);
    }
    const ring = new T.Mesh(new T.RingGeometry(1.0, 1.5, 32), new T.MeshBasicMaterial({ toneMapped: false, color: def.hex, transparent: true, opacity: Math.min(1, op * 2.2), side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.rotation.z = 0; grp.add(ring);
    grp.position.set(x, 0, -y); grp.rotation.y = h + Math.PI / 2;
    return grp;
  }

  refreshOverlays() {
    if (!this.three) return;
    const ov = this.three.overlay, g = this.g;
    this.disposeGroup(ov);
    if (g.phase !== 'orders' || !g.ships[g.plotting]) { this.refreshHover(); return; }
    const me = g.ships[g.plotting];
    const e = this.env(me, this.ui.order), D = Math.PI / 180;
    ov.add(this.sector(me.x, me.y, e.minMove, e.maxMove, me.h - e.turn * D, me.h + e.turn * D, me.def.hex, 0.24, 1));
    // Courses already plotted for the rest of this side's ships
    this.ctrl(g.side).forEach((id) => {
      const d = g.drafts[id]; if (id === g.plotting || !d) return;
      const s = g.ships[id], end = this.path(s, d.dest).at(1);
      ov.add(this.pathLine(s, d.dest, s.def.hex, 0.55));
      ov.add(this.ghost(s.def, end.x, end.y, end.h, 0.22));
    });
    // Priority-target lines: bright for the ship being plotted, dim for the rest of the squadron.
    this.ctrl(g.side).forEach((id) => {
      const d = g.drafts[id], tid = id === g.plotting ? this.ui.target : (d && d.target);
      if (!tid || tid === 'auto' || !this.active(g.ships[tid])) return;
      const s = g.ships[id], t = g.ships[tid], from = d ? this.path(s, d.dest).at(1) : s, bright = id === g.plotting;
      ov.add(this.targetLine(from.x, from.y, t.x, t.y, bright ? 0.9 : 0.4));
      ov.add(this.reticle(t, bright ? 0.9 : 0.45));
    });
    // Torpedoes in flight (dashed line to what they are homing on) and this ship's planned launch.
    (g.torps || []).forEach((t) => { const T2 = g.ships[t.target]; if (!t.gone && this.active(T2)) ov.add(this.torpLine(t.x, t.y, T2.x, T2.y, t.side === g.side ? 0.55 : 0.8)); });
    if (this.ui.torp) { const tg = this.torpTarget(me, this.ui.target); if (tg) { const bow = me.def.len * 0.55; ov.add(this.torpLine(me.x + Math.cos(me.h) * bow, me.y + Math.sin(me.h) * bow, tg.x, tg.y, 0.95)); ov.add(this.reticle(tg, 0.6)); } }
    if (this.ui.enemyArcs) this.sideShips(this.enemySide(g.side)).forEach((id) => { const f = g.ships[id]; this.arcsFor(ov, f.def, f.x, f.y, f.h, 0.05); });
    if (me.def.tractor) { const at = g.dest ? this.path(me, g.dest).at(1) : me; ov.add(this.circle(at.x, at.y, me.def.tractor, 0xb59bff, 0.55)); }
    if (g.dest) {
      const end = this.path(me, g.dest).at(1);
      ov.add(this.pathLine(me, g.dest, me.def.hex, 0.95));
      this.arcsFor(ov, me.def, end.x, end.y, end.h, 0.06);
      ov.add(this.ghost(me.def, end.x, end.y, end.h, 0.38));
    } else {
      this.arcsFor(ov, me.def, me.x, me.y, me.h, 0.035);
    }
    this.refreshHover();
  }

  refreshHover() {
    if (!this.three) return;
    this.updatePreview();
    const now = performance.now();
    if (!this.pvTimer) this.pvTimer = setTimeout(() => { this.pvTimer = null; if (this.alive) this.bump(); }, Math.max(0, 90 - (now - (this.pvAt || 0))));
    this.pvAt = now;
    const hv = this.three.hover, g = this.g;
    this.disposeGroup(hv);
    if (g.phase !== 'orders') return;
    const me = g.ships[g.plotting];
    if (this.ui.hover) {
      const hd = this.clampDest(me, this.ui.order, this.ui.hover.x, this.ui.hover.y);
      const he = this.path(me, hd).at(1);
      hv.add(this.pathLine(me, hd, 0xffffff, 0.45));
      hv.add(this.ghost(me.def, he.x, he.y, he.h, 0.16));
    }
  }

  /* ───────────── EFFECTS ───────────── */
  // One shot: pack art on the battle plane. Hits strike the shield bubble (if that facing still has shields) or a real
  // point on the hull; misses fly past the ship and on into space.
  bolt(A, B, shot, delay, i) {
    if (!this.three) return;
    const w = shot.w, c = A.def.side === 'concord', lance = !!w.lance, SD = this.D.SIDES[A.def.side];
    const side = w.side === 'port' ? 1 : w.side === 'stbd' ? -1 : 0;
    const along = lance ? A.def.len * 0.48 : ((i % 6) / 5 - 0.5) * A.def.len * 0.75, beam = (A.def.halfBeamU || 1.2) + 0.2;
    const ox = A.x + Math.cos(A.h) * along + Math.cos(A.h + Math.PI / 2) * side * beam;
    const oy = A.y + Math.sin(A.h) * along + Math.sin(A.h + Math.PI / 2) * side * beam;
    const from = this.m2v(ox, oy, 1.4);
    const spec = lance ? { key: c ? 'p_lance_cyan' : 'p_lance_violet', wid: 1.6, len: 0, add: true, fly: 0.14, muzzle: c ? 'm_rail' : 'm_laser', col: SD.lanceBolt }
      : w.broadside ? (c ? { key: A.def.len >= 8 ? 'p_shell_he' : 'p_shell_ap', wid: 1.05, len: 2.1, add: false, fly: 0.5, muzzle: 'm_cannon', col: SD.bolt } : { key: 'p_plasma_red', wid: 1.6, len: 2.0, add: true, fly: 0.45, muzzle: 'm_laser', col: SD.bolt })
      : (c ? { key: 'p_tracer_blue', wid: 0.65, len: 1.45, add: true, fly: 0.34, muzzle: 'm_rail', col: SD.bolt } : { key: 'p_plasma_red', wid: 1.0, len: 1.25, add: true, fly: 0.34, muzzle: 'm_laser', col: SD.bolt });
    // Where it goes.
    let to, end, kind;
    if (shot.hit && shot.onShield) {
      const R0 = Math.max(3.2, B.def.len * 0.6), dx = from.x - B.x, dz = from.z + B.y, dl = Math.hypot(dx, dz) || 1;
      to = this.m2v(B.x, B.y, 1.4).add(new this.three.T.Vector3(dx / dl * R0 + (Math.random() - 0.5) * 1.2, 0, dz / dl * R0 + (Math.random() - 0.5) * 1.2)); end = to; kind = 'shield';
    } else if (shot.hit) { to = this.hullPoint(B); end = to; kind = 'hull'; }
    else {
      const hp = this.m2v(B.x, B.y, 1.3), dx = hp.x - from.x, dz = hp.z - from.z, dl = Math.hypot(dx, dz) || 1, px = -dz / dl, pz = dx / dl;
      const off = ((B.def.halfBeamU || 1.2) + 1.6 + Math.random() * 3.2) * (Math.random() < 0.5 ? -1 : 1);
      to = hp.clone().add(new this.three.T.Vector3(px * off, 0.2, pz * off));
      const ux = to.x - from.x, uz = to.z - from.z, ul = Math.hypot(ux, uz) || 1;
      end = to.clone().add(new this.three.T.Vector3(ux / ul * (22 + Math.random() * 10), 0, uz / ul * (22 + Math.random() * 10))); kind = 'miss';
    }
    const q = this.flatQuad(spec.key, spec.wid, spec.len || 1, spec.add, spec.col);
    q.visible = false; this.three.fxg.add(q); this.aim(q, from, end);
    const total = from.distanceTo(end), reach = from.distanceTo(to);
    const fly = spec.fly / this.speedMul() * (lance ? 1 : Math.max(0.6, reach / 22)), flyEnd = lance ? fly : fly * total / reach;
    const fx = { t: -delay, hitDone: false, fired: false };
    fx.update = (dt) => {
      fx.t += dt;
      if (fx.t < 0) return true;
      if (!fx.fired) {
        fx.fired = true; q.visible = true;
        this.flash(spec.muzzle, from, lance ? 3.2 : (w.broadside ? 2.6 : 1.5), 0.2, true);
        this.sfx(this.weaponSfx(A, w), Math.max(0.35, (lance ? 1 : 0.85) - i * 0.07));
        if (w.broadside && i % 3 === 0) this.kick(A.id, -side * 0.035);
        if (lance) this.addShake(0.25);
      }
      const m = q.userData.mesh;
      if (lance) {
        // Beam: snaps out to its end point, then fades.
        const L = from.distanceTo(end), k = Math.min(1, fx.t / fly);
        q.position.copy(from).lerp(end, 0.5 * k); m.scale.set(spec.wid, Math.max(0.1, L * k), 1);
        m.material.opacity = fx.t < fly ? 1 : Math.max(0, 1 - (fx.t - fly) / 0.35);
      } else {
        const k = Math.min(1, fx.t / flyEnd);
        q.position.copy(from).lerp(end, k);
        m.material.opacity = kind === 'miss' && k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
        if (kind !== 'miss' && fx.t >= fly) q.visible = false;
      }
      if (!fx.hitDone && fx.t >= fly) {
        fx.hitDone = true;
        if (kind === 'shield') {
          this.flash(B.def.side === 'concord' ? 's_hit_cyan' : 's_hit_purple', to, lance ? 4 : 2.8, 0.35, true);
          this.shieldFlash(B.id, 0); this.sfx('shield_zap', 0.35);
        } else if (kind === 'hull') {
          this.boom(lance ? 'x_breach_red' : 'x_small_orange', to, lance ? 4.2 : 2.6, lance ? 0.7 : 0.55);
          this.flash('i_sparks_gold', to, 1.6, 0.25, true);
          (this.hitPts[B.id] = this.hitPts[B.id] || []).push(to.clone());
          this.sfx('hit_small', lance ? 0.6 : 0.32); this.addShake(lance ? 0.35 : 0.12);
        }
      }
      const life = lance ? fly + 0.4 : flyEnd + 0.05;
      if (fx.t > life) { this.three.fxg.remove(q); q.userData.mesh.geometry.dispose(); q.userData.mesh.material.dispose(); return false; }
      return true;
    };
    fx.kill = () => this.three.fxg.remove(q);
    this.fx.push(fx);
  }

  /* Sprite art from the projectile/explosion pack. */
  // A flat textured quad lying on the battle plane, its image 'up' pointing along `dir` (three-space x/z).
  flatQuad(key, wid, len, additive, fallbackCol) {
    const T = this.three.T, tex = this.three.tex[key];
    const mat = new T.MeshBasicMaterial({ toneMapped: false, map: tex || null, color: tex ? 0xffffff : (fallbackCol || 0xffffff), transparent: true, depthWrite: false, side: T.DoubleSide, blending: additive ? T.AdditiveBlending : T.NormalBlending });
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
    m.rotation.x = -Math.PI / 2; m.scale.set(wid, len, 1);
    const grp = new T.Group(); grp.add(m); grp.userData.mesh = m;
    return grp;
  }

  aim(grp, from, to) { grp.rotation.y = Math.atan2(-(to.x - from.x), -(to.z - from.z)); }


  // One-shot camera-facing flash (muzzle flash, shield hit, sparks).
  flash(key, pos, size, dur, additive) {
    if (!this.three) return;
    const T = this.three.T, tex = this.three.tex[key];
    if (!tex) { this.spark(pos.x, -pos.z, 0xffffff, size * 0.6); return; }
    const sp = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: tex, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending }));
    sp.position.copy(pos); sp.material.rotation = Math.random() * Math.PI * 2; this.three.fxg.add(sp);
    const fx = { t: 0 };
    fx.update = (dt) => { fx.t += dt; const k = fx.t / dur; sp.scale.setScalar(size * (0.7 + 0.5 * k)); sp.material.opacity = Math.max(0, 1 - k * k); if (k >= 1) { this.three.fxg.remove(sp); sp.material.dispose(); return false; } return true; };
    fx.kill = () => this.three.fxg.remove(sp);
    this.fx.push(fx);
  }

  // Animated explosion from a sprite sheet; fades out over its last quarter.
  boom(key, pos, size, dur, delay) {
    if (!this.three) return;
    const T = this.three.T, base = this.three.tex[key], sh = this.D.SHEETS[key];
    if (!base) { this.spark(pos.x, -pos.z, 0xffa040, size * 0.8); return; }
    const tex = base.clone(); tex.needsUpdate = true;
    tex.repeat.set(1 / sh[0], 1 / sh[1]);
    const sp = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: tex, transparent: true, depthWrite: false }));
    sp.position.copy(pos); sp.scale.setScalar(size); sp.material.rotation = Math.random() * Math.PI * 2; sp.visible = false; sp.renderOrder = 7;
    this.three.fxg.add(sp);
    const fx = { t: -(delay || 0) };
    fx.update = (dt) => {
      fx.t += dt; if (fx.t < 0) return true;
      sp.visible = true;
      const k = fx.t / dur, f = Math.min(sh[2] - 1, Math.floor(k * sh[2])), cx = f % sh[0], cy = Math.floor(f / sh[0]);
      tex.offset.set(cx / sh[0], 1 - (cy + 1) / sh[1]);
      sp.material.opacity = k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.25);
      if (k >= 1) { this.three.fxg.remove(sp); sp.material.dispose(); tex.dispose(); return false; }
      return true;
    };
    fx.kill = () => this.three.fxg.remove(sp);
    this.fx.push(fx);
  }

  // A real point on a ship's hull (world space), for hits that land.
  hullPoint(B) {
    const al = (Math.random() - 0.5) * B.def.len * 0.8, bm = (Math.random() - 0.5) * (B.def.halfBeamU || 1.2) * 1.5;
    return this.m2v(B.x + Math.cos(B.h) * al + Math.cos(B.h + Math.PI / 2) * bm, B.y + Math.sin(B.h) * al + Math.sin(B.h + Math.PI / 2) * bm, 1.3);
  }

  spark(x, y, col, size) {
    if (!this.three) return;
    const T = this.three.T;
    const sp = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: this.three.glowTex, color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    sp.position.copy(this.m2v(x, y, 1.6)); this.three.fxg.add(sp);
    const fx = { t: 0 };
    fx.update = (dt) => { fx.t += dt; const k = fx.t / 0.45; sp.scale.setScalar(size * (0.4 + k)); sp.material.opacity = Math.max(0, 1 - k); if (k >= 1) { this.three.fxg.remove(sp); sp.material.dispose(); return false; } return true; };
    fx.kill = () => this.three.fxg.remove(sp);
    this.fx.push(fx);
  }

  shieldFlash(id, delay) {
    if (!this.three) return;
    const o = this.three.objs[id], fx = { t: -delay };
    fx.update = (dt) => { fx.t += dt; if (fx.t < 0) return true; o.shield.material.opacity = Math.max(0, 0.35 * (1 - fx.t / 0.9)); return fx.t < 0.9; };
    this.fx.push(fx);
  }

  explode(s) {
    if (!this.three) return;
    const o = this.three.objs[s.id];
    this.sfx(s.def.len >= 8 ? 'explode_big' : 'explode_med', 1, 0, 1);
    this.addShake(1.8); this.slowUntil = performance.now() + 1300;
    const c = this.cam;
    this.killCam = { t0: performance.now(), x: s.x, z: -s.y, saved: this.killCam ? this.killCam.saved : { tx: c.tx, tz: c.tz, dist: c.dist, tilt: c.tilt } };
    const big = s.def.side === 'concord' ? 'x_capital_orange' : 'x_reactor_violet';
    for (let i = 0; i < 4; i++) this.boom('x_small_orange', this.hullPoint(s), 3 + Math.random() * 2, 0.6, i * 0.1);
    this.boom(big, this.m2v(s.x, s.y, 1.6), s.def.len * 2.6, 1.7, 0.25);
    const fx = { t: 0 };
    fx.update = (dt) => { fx.t += dt; if (fx.t > 0.6) { o.model.visible = false; o.glow.visible = false; o.ring.visible = false; return false; } return true; };
    this.fx.push(fx);
  }

  // Kill-cam: swoop low onto the dying ship, hold through the blast, then return the view.
  runKillCam(now) {
    const k = this.killCam, t = (now - k.t0) / 1000, c = this.cam, S = k.saved;
    const ease = (a) => (a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a));
    const shot = { tx: k.x, tz: k.z, dist: 26, tilt: 0.95 };
    const mix = (a, b, e) => ({ tx: a.tx + (b.tx - a.tx) * e, tz: a.tz + (b.tz - a.tz) * e, dist: a.dist + (b.dist - a.dist) * e, tilt: a.tilt + (b.tilt - a.tilt) * e });
    const v = t < 2.2 ? mix(S, shot, ease(t / 0.6)) : t < 2.9 ? mix(shot, S, ease((t - 2.2) / 0.7)) : S;
    c.tx = v.tx; c.tz = v.tz; c.dist = v.dist; c.tilt = v.tilt;
    if (t >= 2.9) this.killCam = null;
  }

  addShake(a) { this.shake = Math.min(2.5, this.shake + a); }


  // Roll the hull about its keel (recoil or a heavy hit); decays as a damped wobble.
  kick(id, amp) { if (!this.three) return; const o = this.three.objs[id]; o.rollAmp = Math.max(-0.35, Math.min(0.35, (o.rollAmp || 0) * 0.4 + amp)); o.rollT = 0; }


  // Damage landing on a ship: debris flashes, a hull-impact sound, camera shake, a jolt, and a slow-mo beat on criticals.
  impact(id, dmg, crits) {
    if (this.autoAll || !this.three) return;
    const s = this.g.ships[id], pts = ((this.hitPts || {})[id] || []).slice(-6);
    for (let i = 0; i < Math.min(6, 1 + dmg + crits); i++) {
      const pt = pts.length ? pts[i % pts.length] : this.hullPoint(s);
      this.boom(crits && i === 0 ? 'x_breach_red' : 'x_small_orange', pt, 3.2 + Math.random() * 1.6 + (crits && i === 0 ? 1.5 : 0), 0.75, i * 0.09);
    }
    this.sfx(dmg >= 3 || crits ? 'hit_big' : 'hit_small', 0.95);
    this.addShake(0.3 + 0.14 * dmg + 0.3 * crits);
    this.kick(id, (Math.random() < 0.5 ? -1 : 1) * Math.min(0.3, 0.06 + 0.05 * dmg));
    if (crits) this.slowUntil = performance.now() + 240;
  }

  // Persistent damage: embers rise from burning ships, smoke trails crippled ones.
  // Damage dressing attached to the ship model (so nothing is left behind on the board):
  // scorch marks per hull point lost, small flames that grow with damage, big flames for Fire!, venting when crippled.
  syncDamage(id) {
    if (!this.three) return;
    const T = this.three.T, s = this.g.ships[id], o = this.three.objs[id], def = s.def;
    if (!o.dmg) { o.dmg = new T.Group(); o.model.add(o.dmg); }
    const lost = def.hull - s.hull, fires = this.count(s, 'fire'), crip = this.crippled(s) && !s.dead;
    const key = lost + '/' + fires + '/' + crip;
    if (o.dmgKey === key) return;
    o.dmgKey = key;
    o.dmg.children.slice().forEach((c) => { o.dmg.remove(c); if (c.material) c.material.dispose(); });
    const hb = (def.halfBeamU || 1.2) * 0.62, hl = def.len * 0.42, y = def.deckY || 1.2, salt = this.ids().indexOf(id) + 1;
    const pt = (i) => {
      const a = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453, b = Math.sin((i + 1) * 39.346 + salt * 11.135) * 24634.6345;
      return [((a - Math.floor(a)) * 2 - 1) * hb, y, ((b - Math.floor(b)) * 2 - 1) * hl];
    };
    const sprite = (opts, p, sc) => { const sp = new T.Sprite(new T.SpriteMaterial(Object.assign({ toneMapped: false, map: this.three.glowTex, transparent: true, depthTest: false, depthWrite: false }, opts))); sp.position.set(p[0], p[1], p[2]); sp.scale.setScalar(sc); sp.renderOrder = 5; o.dmg.add(sp); return sp; };
    for (let i = 0; i < Math.min(12, lost); i++) sprite({ color: 0x120804, opacity: 0.8 }, pt(i), 1.1 + (i % 3) * 0.25);
    const small = Math.min(6, Math.ceil(lost / 2));
    for (let i = 0; i < small + fires * 2; i++) {
      const big = i >= small, sp = sprite({ color: big ? 0xff6a1a : 0xffa040, blending: T.AdditiveBlending }, pt(i), big ? 1.7 : 0.8);
      sp.userData.flame = { base: big ? 1.7 : 0.8, ph: Math.random() * 10, big: big };
    }
    if (crip) [1, -1].forEach((side, k) => { const p = pt(20 + k); const v = new T.Object3D(); v.position.set(side * hb * 1.3, p[1], p[2]); v.userData.vent = { side: side, t: 0 }; o.dmg.add(v); });
  }

  damageFx(dt, now) {
    const T = this.three.T;
    this.dmgTick = (this.dmgTick || 0) - dt;
    if (this.dmgTick <= 0) { this.dmgTick = 0.2; this.ids().forEach((id) => this.syncDamage(id)); }
    this.ids().forEach((id) => {
      const o = this.three.objs[id];
      if (!o.dmg) return;
      o.dmg.children.slice().forEach((c) => {
        const u = c.userData;
        if (u.flame) {
          const f = 0.75 + 0.25 * Math.sin(now / 70 + u.ph) + 0.15 * Math.sin(now / 23 + u.ph * 3);
          c.scale.setScalar(u.base * f); c.material.opacity = 0.7 + 0.3 * f;
          if (u.big && Math.random() < dt * 6) {
            const e = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: this.three.glowTex, color: 0xffc94d, transparent: true, blending: T.AdditiveBlending, depthTest: false, depthWrite: false }));
            e.position.copy(c.position); e.scale.setScalar(0.45); e.renderOrder = 6; e.userData.ember = { t: 0, vx: (Math.random() - 0.5) * 0.8, vz: (Math.random() - 0.5) * 0.8 };
            o.dmg.add(e);
          }
        } else if (u.ember) {
          u.ember.t += dt; c.position.y += dt * 2.4; c.position.x += u.ember.vx * dt; c.position.z += u.ember.vz * dt;
          c.material.opacity = Math.max(0, 1 - u.ember.t / 0.6);
          if (u.ember.t > 0.6) { o.dmg.remove(c); c.material.dispose(); }
        } else if (u.vent) {
          u.vent.t -= dt;
          if (u.vent.t <= 0) {
            u.vent.t = 0.07;
            const pf = new T.Sprite(new T.SpriteMaterial({ toneMapped: false, map: this.three.glowTex, color: 0xcfd8e6, transparent: true, opacity: 0.45, depthWrite: false }));
            pf.position.copy(c.position); pf.scale.setScalar(0.5); pf.userData.puff = { t: 0, side: u.vent.side };
            o.dmg.add(pf);
          }
        } else if (u.puff) {
          u.puff.t += dt; c.position.x += u.puff.side * dt * 3.2; c.position.y += dt * 0.6;
          c.scale.setScalar(0.5 + u.puff.t * 3); c.material.opacity = Math.max(0, 0.45 * (1 - u.puff.t / 0.8));
          if (u.puff.t > 0.8) { o.dmg.remove(c); c.material.dispose(); }
        }
      });
    });
  }

  /* ───────────── LOOP & INPUT ───────────── */
  frame(now) {
    const t3 = this.three, dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const g = this.g;
    if (this.killCam) this.runKillCam(now);
    else if (!this.userCam && (g.phase === 'moving' || g.phase === 'firing')) this.followShips(dt);
    this.applyCam();
    const cam = t3.camera;
    if (this.anim && this.anim.kind === 'move') {
      const k = Math.min(1, (now - this.anim.t0) / this.anim.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.ids().forEach((id) => { if (!g.orders[id] || !g.orders[id].path) return; const p = g.orders[id].path.at(e), o = t3.objs[id]; o.root.position.set(p.x, 0, -p.y); o.root.rotation.y = p.h + Math.PI / 2; o.glow.scale.setScalar(2.6 + 2.2 * Math.sin(Math.PI * k)); });
      this.placeTorps(e, false);
      if (k >= 1) { this.anim = null; this.afterMove(); }
    }
    const fxDt = now < this.slowUntil ? dt * 0.3 : dt;
    this.shake *= Math.pow(0.03, dt);
    this.ids().forEach((id, i) => {
      const o = t3.objs[id], s = g.ships[id], crip = this.crippled(s) && !s.dead;
      let roll = 0;
      if (o.rollAmp) { o.rollT += fxDt; roll = o.rollAmp * Math.exp(-o.rollT * 2.6) * Math.cos(o.rollT * 8); if (o.rollT > 2.5) o.rollAmp = 0; }
      o.list = (o.list || 0) + ((crip ? (i % 2 ? 0.16 : -0.16) : 0) - (o.list || 0)) * Math.min(1, fxDt * 1.5);
      o.model.rotation.z = o.list + roll;
      o.model.rotation.y = crip ? Math.sin(now / 1700 + i * 1.3) * 0.07 : 0;
    });
    this.damageFx(fxDt, now);
    if (t3.featG) t3.featG.children.forEach((c) => { if (c.userData.well) c.rotation.y += fxDt * 0.25; });
    this.ids().forEach((id, i) => { const o = t3.objs[id]; o.model.position.y = Math.sin(now / 900 + i * 2) * 0.12; o.ring.material.opacity = id === this.ui.sel ? 0.95 : (g.phase === 'orders' && id === g.plotting ? 0.8 : 0.4); });
    // Effects may spawn new effects while updating; collect those separately so none are dropped.
    const cur = this.fx; this.fx = [];
    const kept = cur.filter((f) => f.update(fxDt));
    this.fx = kept.concat(this.fx);
    t3.renderer.render(t3.scene, cam);
    this.placeLabels();
    this.placeBadges();
    if (this.inspDirty) this.renderInspector();
  }

  // Orbit camera: target on the plane, distance, tilt from vertical, yaw around the vertical axis.
  applyCam() {
    const c = this.cam, cam = this.three.camera, st = Math.sin(c.tilt);
    cam.position.set(c.tx + c.dist * st * Math.sin(c.yaw), c.dist * Math.cos(c.tilt), c.tz + c.dist * st * Math.cos(c.yaw));
    cam.lookAt(c.tx, 0, c.tz);
    if (this.shake > 0.01) { const k = this.shake * c.dist * 0.006; cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k; }
    cam.updateMatrixWorld();
  }

  // During movement/gunnery, glide the camera to the ships' midpoint and pull back if they would leave the view.
  followShips(dt) {
    const o = this.three.objs, pts = this.ids().filter((id) => !this.g.ships[id].dead).map((id) => o[id].root.position);
    if (!pts.length) return;
    let mx = 0, mz = 0, sep = 0;
    pts.forEach((p) => { mx += p.x; mz += p.z; });
    mx /= pts.length; mz /= pts.length;
    pts.forEach((a) => pts.forEach((b) => { sep = Math.max(sep, Math.hypot(a.x - b.x, a.z - b.z)); }));
    const k = Math.min(1, dt * 2.5);
    this.cam.tx += (mx - this.cam.tx) * k;
    this.cam.tz += (mz - this.cam.tz) * k;
    const need = Math.min(230, sep * 1.25 + 30);
    if (this.cam.dist < need) this.cam.dist += (need - this.cam.dist) * k;
  }

  wheelZoom(e) {
    if (!this.three) return;
    if (this.anim || this.g.phase === 'firing') this.userCam = true;
    const before = this.pickMap(e);
    this.cam.dist = Math.min(230, Math.max(18, this.cam.dist * Math.exp(e.deltaY * 0.0012)));
    this.applyCam();
    const after = this.pickMap(e);
    if (before && after) { this.cam.tx += before.x - after.x; this.cam.tz += after.y - before.y; }
  }

  pickMap(e) {
    const t3 = this.three; if (!t3) return null;
    const r = this.canvas.getBoundingClientRect();
    const v = new t3.T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    t3.ray.setFromCamera(v, t3.camera);
    const p = new t3.T.Vector3();
    if (!t3.ray.ray.intersectPlane(t3.plane, p)) return null;
    return { x: p.x, y: -p.z };
  }

  pointerDown(e) {
    this.unlockAudio();
    this.drag = { x: e.clientX, y: e.clientY, moved: false, button: e.button, pan: e.button !== 0 || e.shiftKey, tx: this.cam.tx, tz: this.cam.tz, yaw: this.cam.yaw, tilt: this.cam.tilt };
    if (e.currentTarget && e.currentTarget.setPointerCapture) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} }
  }

  pointerMove(e) {
    if (this.drag) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) this.drag.moved = true;
      if (this.drag.moved) {
        if (this.anim || this.g.phase === 'firing') this.userCam = true;
        const c = this.cam;
        if (this.drag.pan) {
          const h = this.canvas.clientHeight || 600, wpp = 2 * c.dist * Math.tan(20 * Math.PI / 180) / h;
          const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw), fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
          c.tx = this.drag.tx - rx * dx * wpp + fx * dy * wpp * 1.25;
          c.tz = this.drag.tz - rz * dx * wpp + fz * dy * wpp * 1.25;
        } else {
          c.yaw = this.drag.yaw - dx * 0.006;
          c.tilt = Math.max(0.12, Math.min(1.15, this.drag.tilt - dy * 0.004));
        }
      }
      return;
    }
    if (this.g.phase !== 'orders' || !this.three) return;
    const p = this.pickMap(e); if (!p) return;
    this.ui.hover = p;
    this.refreshHover();
  }

  pointerUp(e) {
    const d = this.drag; this.drag = null;
    if (!d || d.moved || d.button !== 0) return;
    const p = this.pickMap(e); if (!p) return;
    const hit = this.shipAt(p);
    if (hit) {
      // In the orders phase, clicking an enemy ship makes it the plotting ship's priority target.
      if (this.g.phase === 'orders' && this.sideOf(hit) !== this.g.side) { this.ui.sel = hit; this.inspDirty = true; this.setTarget(hit); return; }
      this.selectShip(hit); return;
    }
    this.setDest(p.x, p.y);
  }

  /* ───────────── VIEW MODEL ───────────── */
  // Top-down inspector overlay. SVG space: 300×300 = 15u, ship centred at (150,150), bow up, 20 px per u.
  inspectVals(s) {
    const def = s.def, hw = Math.min(110, Math.max(14, (def.halfBeamU || 1.25) * 20)), bow = 150 - def.len * 10;
    const e = this.env(s, 'steady');
    const pt = (cx, cy, r, deg) => (cx + r * Math.cos(deg * Math.PI / 180)).toFixed(1) + ',' + (cy - r * Math.sin(deg * Math.PI / 180)).toFixed(1);
    const wedge = (cx, cy, r, a0, a1) => 'M' + cx + ',' + cy + ' L' + pt(cx, cy, r, a1) + ' A' + r + ',' + r + ' 0 0 1 ' + pt(cx, cy, r, a0) + ' Z';
    const layout = {
      port: { hx: 150 - hw, hy: 150, wedge: wedge(150 - hw, 150, 58, 135, 225), lx: 6, ly: 226, anchor: 'start' },
      stbd: { hx: 150 + hw, hy: 150, wedge: wedge(150 + hw, 150, 58, -45, 45), lx: 294, ly: 226, anchor: 'end' },
      fore: { hx: 150, hy: bow, wedge: wedge(150, bow, 42, 45, 135), lx: 150, ly: 4, anchor: 'middle' },
      all: { hx: 150, hy: 165, wedge: 'M150,165 m-34,0 a34,34 0 1,0 68,0 a34,34 0 1,0 -68,0', lx: 150, ly: 266, anchor: 'middle' }
    };
    const weapons = def.weapons.map((w) => {
      const L = layout[w.arcs.length > 1 ? 'all' : w.arcs[0]];
      const dice = this.weaponDice(s, w, 'steady'), reduced = dice < w.dice;
      const deck = w.broadside && s.crits.some((c) => c.k === 'gundeck' && c.side === w.side);
      const col = w.lance ? '#ffc94d' : def.color;
      return {
        wedge: L.wedge, hx: L.hx, hy: L.hy,
        labelStyle: 'position: absolute; top: ' + (L.ly / 3).toFixed(2) + '%; ' + (L.anchor === 'start' ? 'left: ' + (L.lx / 3).toFixed(2) + '%; text-align: left;' : L.anchor === 'end' ? 'right: ' + ((300 - L.lx) / 3).toFixed(2) + '%; text-align: right;' : 'left: 50%; transform: translateX(-50%); text-align: center; white-space: nowrap;') + ' max-width: ' + (L.anchor === 'middle' ? '96%' : '46%') + '; line-height: 1.3; pointer-events: none; text-shadow: 0 0 3px #000, 0 0 6px #000;',
        fill: w.arcs.length > 1 ? 'none' : (w.lance ? 'rgba(255,201,77,0.18)' : this.D.SIDES[def.side].fill),
        stroke: deck ? '#ff4d4d' : col, dash: deck || w.arcs.length > 1 ? '4 3' : 'none',
        name: (w.broadside ? (w.side === 'port' ? 'PORT' : 'STARBOARD') : w.name.toUpperCase()) + (w.lance ? ' · LANCE' : ''),
        stats: dice + 'd6 · ' + w.range + 'u' + (w.arcs.length > 1 ? ' · all arcs' : '') + (reduced ? ' (was ' + w.dice + ')' : '') + (w.id === 'maw' && def.ram ? ' · ram prow' : ''),
        statColor: reduced ? '#ffc94d' : '#b9c6dc'
      };
    });
    // One arc segment per shield point on each facing (fore = top, port = left, stbd = right, aft = bottom).
    const span = { fore: [45, 135], port: [135, 225], aft: [225, 315], stbd: [-45, 45] };
    const ep = (rx, ry, deg) => (150 + rx * Math.cos(deg * Math.PI / 180)).toFixed(1) + ',' + (150 - ry * Math.sin(deg * Math.PI / 180)).toFixed(1);
    const rings = [];
    Object.keys(span).forEach((f) => {
      for (let i = 0; i < (def.shields[f] || 0); i++) {
        const rx = hw + 30 + i * 8, ry = 96 + i * 8, a0 = span[f][0] + 6, a1 = span[f][1] - 6;
        rings.push({ d: 'M' + ep(rx, ry, a0) + ' A' + rx + ',' + ry + ' 0 0 0 ' + ep(rx, ry, a1), op: (0.95 - i * 0.22).toFixed(2) });
      }
    });
    const lost = def.hull - s.hull, dmg = [];
    for (let i = 0; i < lost; i++) dmg.push({ x: (150 + (((i * 5) % 7) - 3) / 3 * (hw - 7)).toFixed(1), y: (bow + 14 + ((i * 7) % 13) / 12 * 132).toFixed(1) });
    const pips = [];
    for (let i = 0; i < def.hull; i++) pips.push('width: 10px; height: 14px; border-radius: 2px; ' + (i < s.hull ? 'background: ' + def.color : 'background: #1a2335; box-shadow: inset 0 0 0 1px #2a3650'));
    const rx0 = hw + 30, bpos = { fore: [150, 150 - 96], port: [150 - rx0, 150], stbd: [150 + rx0, 150], aft: [150, 150 + 96] };
    const arcBadges = this.D.FACINGS.map((f) => {
      const base = def.shields[f] || 0, left = this.shieldLeft(s, f);
      return {
        sh: left < base ? left + '/' + base : String(base), dice: String(this.arcDice(s, f)),
        style: 'position: absolute; left: ' + (bpos[f][0] / 3).toFixed(2) + '%; top: ' + (bpos[f][1] / 3).toFixed(2) + '%; transform: translate(-50%, -50%); display: flex; gap: 5px; padding: 2px 6px; border-radius: 5px; background: rgba(0,0,0,0.82); box-shadow: inset 0 0 0 1px #33425f; font-family: JetBrains Mono, monospace; font-size: 12px; font-weight: 700; line-height: 1.25; pointer-events: none;'
      };
    });
    const shieldFacings = [['fore', 'Fore'], ['port', 'Port'], ['stbd', 'Stbd'], ['aft', 'Aft']].map((f) => {
      const v = def.shields[f[0]] || 0;
      return { lab: f[1], v: v, style: 'display: flex; align-items: baseline; gap: 4px; padding: 3px 7px; border-radius: 4px; font-size: 11px; ' + (v ? 'color: #e6edf8; box-shadow: inset 0 0 0 1px ' + def.color + ';' : 'color: #6f7f9c; box-shadow: inset 0 0 0 1px #26324a;') };
    });
    const gold = 'background: #3a2208; color: #ffc94d; border: 1px solid #6b4310;', violet = 'background: #221a3a; color: #d7c8ff; border: 1px solid #4a3a7a;';
    const chips = s.crits.map((c) => ({ text: this.critName(c), title: '', style: gold }));
    if (def.tractor) chips.unshift({ text: 'Tractor beam · ' + def.tractor + 'u', title: 'Locks an enemy within 8u after movement; roll-off to pull it 4u closer and hold it', style: violet });
    if (def.vet) chips.push({ text: ['', 'Trained crew', 'Veteran crew · re-roll one 1 per volley', 'Elite crew · re-roll one 1 per volley, boarders win ties'][def.vet], title: 'Veterancy from battles fought: Veteran at 3, Elite at 6', style: 'background: #11301f; color: #b8f0cc; border: 1px solid #1f5a39;' });
    if (def.cap) { const tr = this.D.TRAITS[def.capTrait]; chips.unshift({ text: def.captain + ' · ' + tr.name, title: tr.text, style: 'background: #10223a; color: #cfe4ff; border: 1px solid #2f5a8a;' }); }
    const g0 = this.g, heldNext = s.heldTurn && (s.heldTurn === g0.turn + 1 || (s.heldTurn === g0.turn && (g0.phase === 'orders' || g0.phase === 'handoff')));
    if (heldNext && !s.dead) chips.push({ text: 'Held: −4u next move', title: 'Caught by a tractor beam', style: violet });
    let status = 'OPERATIONAL', bg = '#11301f', fg = '#7be3a4';
    if (s.dead) { status = 'DESTROYED'; bg = '#3a0f12'; fg = '#ff8a8a'; }
    else if (s.captured) { status = 'CAPTURED'; bg = '#2a1a3a'; fg = '#d7b8ff'; }
    else if (s.fled) { status = 'DISENGAGED'; bg = '#2a2a2a'; fg = '#cfcfcf'; }
    else if (this.crippled(s)) { status = 'CRIPPLED'; bg = '#3a2208'; fg = '#ffc94d'; }
    return {
      name: def.name, color: def.color, cls: def.cls, status: status, statusBg: bg, statusFg: fg,
      weapons: weapons, rings: rings, dmg: dmg, pips: pips, shieldFacings: shieldFacings, arcBadges: arcBadges,
      hullText: s.hull + '/' + def.hull,
      speed: e.speed + 'u', turnTxt: e.turn + '°', armour: def.armour + '+', crew: s.crew + '/' + def.crew, torps: def.torps ? (s.torps || 0) + '/' + def.torps : '—',
      crits: chips, hasCrits: chips.length > 0,
      aria: 'Top-down view of ' + def.name + ': hull ' + s.hull + ' of ' + def.hull + ', shields fore ' + def.shields.fore + ' port ' + def.shields.port + ' starboard ' + def.shields.stbd + ' aft ' + def.shields.aft + ', weapons: ' + weapons.map((w) => w.name + ' ' + w.stats).join('; ')
    };
  }

  renderVals() {
    const g = this.g, D = this.D;
    const phaseLabel = { orders: 'ORDERS', handoff: 'ORDERS', moving: 'MOVEMENT', firing: 'GUNNERY', over: 'BATTLE OVER' }[g.phase];
    const plot = g.ships[g.plotting];
    const insp = this.inspectVals(g.ships[this.ui.sel]);
    const canOrder = g.phase === 'orders';
    const bridge = this.count(plot, 'bridge') > 0;
    const capT = plot && plot.def.capTrait, capShort = { gunnery: { lock: '+1 to hit · Turn ½ · re-roll misses' }, daredevil: { aaf: 'Speed ×1.5 · full Turn · −1 to hit' }, steady: { brace: '+1 save · full dice' } }[capT] || {};
    const orderOpts = D.ORDERS.map((o) => {
      const sel = this.ui.order === o.id, dis = !canOrder || (bridge && o.id !== 'steady');
      const boost = capShort[o.id];
      return {
        label: o.label + (boost ? ' ★' : ''), short: boost || o.short, desc: o.desc + (boost ? ' ' + plot.def.captain + ' (' + D.TRAITS[capT].name + '): ' + D.TRAITS[capT].text : ''), pressed: sel ? 'true' : 'false', disabled: dis,
        pick: () => this.pickOrder(o.id),
        style: 'min-height: 44px; text-align: left; padding: 5px 10px; border-radius: 6px; cursor: ' + (dis ? 'not-allowed' : 'pointer') + '; ' +
          (sel ? 'background: ' + plot.def.color + '; color: #070a12; border: 1px solid ' + plot.def.color + ';' : 'background: #111a2c; color: #d8e1f0; border: 1px solid #26324a;') + (dis && !sel ? ' opacity: 0.45;' : '') + ' flex: 1 1 130px;'
      };
    });
    let destDist = '—', destBearing = '—', destTurn = '—';
    if (g.dest && canOrder) {
      const p = this.path(plot, g.dest);
      destDist = p.d.toFixed(1) + 'u';
      const bd = this.deg(p.b);
      destBearing = bd === 0 ? 'dead ahead' : Math.abs(bd) + '° ' + (bd > 0 ? 'port' : 'stbd');
      const td = this.deg(2 * p.b);
      destTurn = td === 0 ? 'unchanged' : Math.abs(td) + '° ' + (td > 0 ? 'to port' : 'to stbd');
    }
    const tLeft = plot ? plot.torps || 0 : 0, tOk = canOrder && this.canTorp(plot), tOn = canOrder && !!this.ui.torp;
    const torpTg = tOk ? this.torpTarget(plot, this.ui.target) : null;
    const torp = { show: canOrder && (plot.def.torps || 0) > 0, pressed: tOn ? 'true' : 'false', disabled: !tOk && !tOn,
      label: tOn ? 'Torpedo away at ' + (torpTg ? torpTg.def.name.replace('CNS ', '') : 'target') : 'Launch torpedo',
      sub: tLeft + ' of ' + (plot.def.torps || 0) + ' left · ' + (tLeft === 0 ? 'magazine empty' : !torpTg ? 'no enemy within 40u' : this.count(plot, 'bridge') ? 'bridge hit: cannot launch' : '2d6, ignores shields and armour'),
      style: 'min-height: 44px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 4px 10px; border-radius: 6px; text-align: left; cursor: ' + (!tOk && !tOn ? 'not-allowed' : 'pointer') + '; ' + (tOn ? 'background: #ffa040; color: #1a0e02; border: 1px solid #ffa040;' : 'background: #111a2c; color: #ffcf9a; border: 1px solid #5a3a14;') + (!tOk && !tOn ? ' opacity: 0.5;' : '') };
    const own = canOrder ? this.ctrl(g.side) : [];
    const drafted = own.filter((id) => g.drafts[id]).length;
    const fleet = own.map((id) => {
      const s = g.ships[id], on = id === g.plotting, done = !!g.drafts[id];
      return {
        name: s.def.name.replace('CNS ', ''), mark: done ? 'plotted' : 'to plot', pick: this.pickFn(id), pressed: on ? 'true' : 'false',
        style: 'min-height: 44px; flex: 1 1 120px; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 0 10px; border-radius: 6px; cursor: pointer; text-align: left; ' +
          (on ? 'background: #16243d; color: #eef3fb; border: 1px solid ' + s.def.color + ';' : 'background: #0a1222; color: #c5d1e6; border: 1px solid #26324a;'),
        markStyle: 'font-size: 11px; font-weight: 600; color: ' + (done ? '#7be3a4' : '#93a3bf') + ';'
      };
    });
    const commitDisabled = !(canOrder && own.length && drafted === own.length);
    const tchip = (on) => 'min-height: 44px; flex: 1 1 0; min-width: 0; padding: 0 6px; border-radius: 6px; line-height: 1.15; cursor: pointer; font-size: 12px; font-weight: 700; ' + (on ? 'background: #3a0f12; color: #ffb3b3; border: 1px solid #ff4d4d;' : 'background: #0a1222; color: #c5d1e6; border: 1px solid #26324a;');
    const targets = canOrder ? [{ name: 'Closest', pick: this.targetAuto, pressed: this.ui.target === 'auto' ? 'true' : 'false', style: tchip(this.ui.target === 'auto') }].concat(
      this.sideShips(this.enemySide(g.side)).map((id) => ({ name: g.ships[id].def.name.replace('CNS ', ''), pick: this.targetFn(id), pressed: this.ui.target === id ? 'true' : 'false', style: tchip(this.ui.target === id) }))) : [];
    const pv = this.pv, f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
    const pvm = { show: !!pv && g.phase === 'orders', ship: pv ? pv.ship : '', empty: !pv || !!pv.empty, full: !!pv && !pv.empty, where: '', dealTotal: '0.0', takeTotal: '0.0', deal: [], take: [], noDeal: true, noTake: true, threats: [], hasThreats: false };
    if (pv && !pv.empty) {
      const r = pv.r, nm = (id) => g.ships[id].def.name;
      pvm.where = (pv.src === 'hover' ? 'From the hovered position' : 'From the plotted position') + ' · enemies assumed to hold course';
      pvm.deal = Object.keys(r.deal).map((id) => ({ name: nm(id), dmg: f1(r.deal[id].dmg), detail: r.deal[id].detail })).sort((a, b) => b.dmg - a.dmg);
      pvm.take = Object.keys(r.take).map((id) => ({ name: nm(id), dmg: f1(r.take[id].dmg), detail: r.take[id].detail })).sort((a, b) => b.dmg - a.dmg);
      pvm.dealTotal = f1(Object.keys(r.deal).reduce((a, id) => a + r.deal[id].dmg, 0));
      pvm.takeTotal = f1(Object.keys(r.take).reduce((a, id) => a + r.take[id].dmg, 0));
      pvm.noDeal = !pvm.deal.length; pvm.noTake = !pvm.take.length;
      const tcol = { 3: '#ff4d4d', 2: '#ff8a5c', 1: '#d7c8ff', 0: '#93a3bf' };
      pvm.threats = (r.threats || []).map((t) => ({ text: t.text, col: tcol[t.sev] || '#93a3bf', mark: t.sev >= 2 ? '!' : '·' }));
      pvm.hasThreats = pvm.threats.length > 0;
    }
    // Campaign: mission tracker, ready-to-start prompt, and the debrief.
    const misView = { show: false, ready: false };
    if (this.mission) {
      const r = this.missionCheck(), m = this.mission;
      misView.show = true; misView.title = m.code + ' · ' + m.name; misView.type = m.type.toUpperCase();
      misView.turnTxt = 'Turn ' + g.turn + (m.turns ? ' of ' + m.turns : '');
      misView.lines = r.lines.map((l) => ({ text: l.text, mark: l.ok ? '✓' : '○', col: l.ok ? '#7be3a4' : '#c5d1e6' }));
      const notes = [];
      if (m.exit) notes.push('Green band: the ' + m.exit.edge + ' exit edge');
      if (g.feat.well) notes.push('Gravity well bends every course toward the purple swirl');
      if ((g.feat.rocks || []).length) notes.push('Asteroids block fire; ending a move inside one costs D3 hull');
      if ((g.feat.nebula || []).length) notes.push('Purple clouds are nebulae: no fire into or out of one beyond 12u');
      if ((g.feat.mines || []).length) notes.push('Red lights are mines: 2d6 to any ship ending within 3u · gold rings are beacons (end within 5u)');
      const away = this.ids().filter((id) => g.ships[id].away).map((id) => g.ships[id].def.name + ' (turn ' + g.ships[id].def.spawn + ')');
      if (away.length) notes.push('Expected: ' + away.join(', '));
      misView.notes = notes; misView.hasNotes = notes.length > 0;
    } else if (this.save && this.save.current) {
      misView.ready = true; misView.readyText = 'Operation Iron Tide: ' + this.save.current.toUpperCase() + ' is ready to launch with your saved fleet.';
    }
    const dbr = g.debrief || {}, dbView = {
      title: dbr.won ? 'Mission accomplished' : 'Mission failed', col: dbr.won ? '#7be3a4' : '#ff8a8a', name: this.mission ? this.mission.code + ' · ' + this.mission.name : '',
      lines: (dbr.lines || []).map((l) => ({ text: l.text, mark: l.ok ? '✓' : '✗', col: l.ok ? '#7be3a4' : '#ff8a8a' })),
      rewards: '+' + (dbr.credits || 0) + ' credits · +' + (dbr.renown || 0) + ' renown',
      lost: (dbr.lost || []).length ? 'Lost: ' + dbr.lost.join(', ') : 'No ships lost', prizes: (dbr.prizes || []).length ? 'Prizes taken: ' + dbr.prizes.join(', ') : '',
      hasPrizes: (dbr.prizes || []).length > 0,
      saved: dbr.saved === 'db' ? 'Saved to the campaign record in this canvas.' : dbr.saved === 'local' ? 'Saved in this browser.' : 'This view could not save the campaign; the result is shown here only.'
    };
    const badges = [];
    this.ids().forEach((id) => { const s = g.ships[id]; this.D.FACINGS.forEach((f) => { badges.push({ ref: this.badgeRef(id + ':' + f), sh: String(this.shieldLeft(s, f)), dice: String(this.arcDice(s, f)) }); }); });
    const commitLabel = !canOrder ? (g.phase === 'over' ? 'Battle over' : 'Resolving…') : (drafted === own.length ? 'Commit fleet orders' : 'Plot ' + (own.length - drafted) + ' more ship' + (own.length - drafted === 1 ? '' : 's') + ' · double-click plots and moves on');
    const commitStyle = 'min-height: 44px; padding: 0 16px; border-radius: 6px; font-weight: 700; font-size: 14px; border: 0; cursor: ' + (commitDisabled ? 'not-allowed' : 'pointer') + '; ' +
      (commitDisabled ? 'background: #1a2335; color: #93a3bf;' : 'background: ' + plot.def.color + '; color: #070a12;');
    let banner = '', bannerBorder = '#26324a';
    if (g.phase === 'orders') {
      const e = this.env(plot, this.ui.order);
      banner = plot.def.name + ' — plot a course: ' + e.minMove.toFixed(0) + '–' + e.maxMove.toFixed(0) + 'u, up to ' + Math.round(e.turn) + '° off the bow. Double-click to plot and commit.';
      bannerBorder = plot.def.color;
    } else if (g.phase === 'handoff') banner = 'Orders sealed — waiting for the Reaver commander';
    else if (g.phase === 'moving') banner = 'Movement — both ships execute their orders simultaneously';
    else if (g.phase === 'firing') { banner = g.pending ? 'Gunnery — your roll: use the dice tray' : 'Gunnery — both ships fire; damage lands after both have rolled'; bannerBorder = '#ffc94d'; }
    else if (g.phase === 'over') banner = 'Battle over';
    const dieStyle = (kind, owner, size) => {
      const px = size || 22;
      const base = 'display: inline-flex; align-items: center; justify-content: center; width: ' + px + 'px; height: ' + px + 'px; border-radius: 4px; font-family: JetBrains Mono, monospace; font-size: ' + (px > 22 ? 14 : 12) + 'px; font-weight: 700;';
      const col = (this.D.SHIPS[owner] || {}).color || '#93a3bf';
      if (kind === 'crit') return base + ' background: #ffc94d; color: #1a1204;';
      if (kind === 'hit') return base + ' background: ' + col + '; color: #070a12;';
      if (kind === 'save') return base + ' background: #e6edf8; color: #070a12;';
      if (kind === 'fail') return base + ' background: transparent; color: #ff8a8a; box-shadow: inset 0 0 0 1px #ff8a8a;';
      if (kind === 'roll') return base + ' background: #1a2335; color: #e6edf8; box-shadow: inset 0 0 0 1px #4a5a7a;';
      return base + ' background: transparent; color: #6f7f9c; box-shadow: inset 0 0 0 1px #33425f;';
    };
    const recRow = (rec, op) => ({
      label: rec.label, result: rec.result || '', color: (this.D.SHIPS[rec.owner] || {}).color || '#93a3bf', op: op,
      hasDice: !!(rec.dice && rec.dice.length), dice: (rec.dice || []).map((d) => ({ v: d.v, style: dieStyle(d.kind, rec.owner) }))
    });
    const tag = (id) => {
      const n = g.taken[id], rolls = g.turnRolls[id].length;
      const show = (g.phase === 'orders' || g.phase === 'over' || g.phase === 'handoff') && (n > 0 || rolls > 0) && !g.ships[id].dead;
      return { show: show, text: n > 0 ? '−' + n : '0', bg: n > 0 ? 'rgba(255,77,77,0.18)' : 'rgba(147,163,191,0.15)', fg: n > 0 ? '#ff8a8a' : '#b9c6dc' };
    };
    const floats = (id) => ((g.floaters || {})[id] || []).map((f) => {
      const base = 'display: flex; align-items: center; gap: 4px; white-space: nowrap; text-shadow: 0 0 4px #000, 0 0 8px #000, 0 0 2px #000; animation: so-float 2.8s ease-out ' + f.delay + 's both;';
      const num = ' font-family: JetBrains Mono, monospace; font-weight: 700; font-size: 23px;';
      if (f.kind === 'shield') return { fire: false, text: f.text, style: base + num + ' color: #5aa9ff;' };
      if (f.kind === 'hull') return { fire: false, text: f.text, style: base + num + ' color: #ffc94d;' };
      if (f.kind === 'fire') return { fire: true, text: f.text, style: base + num + ' color: #ffc94d;' };
      return { fire: false, text: f.text, style: base + ' font-family: Inter, sans-serif; font-weight: 700; font-size: 15px; letter-spacing: 0.04em; color: #ffa478;' };
    });
    const tipTurn = g.phase === 'orders' ? g.turn - 1 : g.turn;
    const tipRows = this.ui.tip ? g.turnRolls[this.ui.tip].slice(-8).map((r) => recRow(r, 1)) : [];
    const labels = this.ids().map((id) => {
      const s = g.ships[id], t = tag(id), SD = this.D.SIDES[s.def.side], on = this.ui.tip === id && t.show;
      return {
        name: s.def.name + (s.captured ? ' · captured' : ''), ref: this.lref(id), border: s.captured ? this.D.SIDES[s.capturedBy].color : s.def.color, fg: SD.tagFg,
        floats: floats(id), tagShow: t.show, dmg: t.text, tagBg: t.bg, tagFg: t.fg, tipOn: this.tipFn(id),
        tipShow: on, tipPos: (this.labelY[id] || 0.5) > 0.45 ? 'bottom: calc(100% + 6px);' : 'top: calc(100% + 6px);',
        tipHead: 'TURN ' + tipTurn + ' · ROLLS AGAINST ' + s.def.name.toUpperCase(), tipRows: on ? tipRows : []
      };
    });
    const BD = g.boarding;
    const pips = (n, col) => { const a = []; for (let i = 0; i < n; i++) a.push('width: 12px; height: 12px; border-radius: 50%; background: ' + col + ';'); return a; };
    const bview = { show: !!BD };
    if (BD) {
      const A = g.ships[BD.a], B = g.ships[BD.b];
      bview.title = A.def.name + ' boarding ' + B.def.name;
      bview.atkName = 'Boarders (' + BD.party + ')'; bview.defName = 'Defenders (' + BD.def + ')';
      bview.atk = pips(BD.party, A.def.color); bview.def = pips(BD.def, B.def.color);
      bview.odds = 'Capture chance if you press on: ' + Math.round(this.boardOdds(BD.party, BD.def) * 100) + '%';
      bview.hasLast = !!BD.last;
      bview.pairs = BD.last ? BD.last.a.map((v, k) => ({ a: v, d: k < BD.last.d.length ? BD.last.d[k] : '–', res: k < BD.last.d.length ? (v > BD.last.d[k] ? 'defender falls' : 'boarder falls') : 'unopposed die', col: k < BD.last.d.length ? (v > BD.last.d[k] ? '#7be3a4' : '#ff8a8a') : '#93a3bf' })) : [];
    }
    const hist = (g.tray || []).slice(-3);
    const q = g.pending, rl = this.rolling, cur = rl ? rl.q : q;
    const tray = {
      show: g.phase === 'firing',
      history: hist.map((r, i) => recRow(r, [0.55, 0.75, 1][i + 3 - hist.length])),
      active: !!cur,
      color: cur ? this.D.SHIPS[cur.owner].color : '#93a3bf',
      label: cur ? cur.label : '', sub: cur ? cur.sub : '',
      hasFaces: !!rl, faces: rl ? rl.faces.map((v) => ({ v: v, style: dieStyle('roll', rl.q.owner, 28) })) : [],
      canRoll: !!q && q.type === 'roll' && !rl,
      btn: q && q.type === 'roll' ? 'Roll ' + q.n + (q.n === 1 ? ' die' : ' dice') : '',
      isChoice: !!q && q.type === 'choice',
      choices: q && q.type === 'choice' ? q.options.map((o) => ({ label: o.label, pick: () => this.choose(o.value), style: 'min-height: 44px; padding: 0 14px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 13px; ' + (o.primary ? 'border: 0; background: ' + this.D.SHIPS[q.owner].color + '; color: #070a12;' : 'background: transparent; color: #e6edf8; border: 1px solid #33425f;') })) : [],
      boarding: bview,
      btnStyle: 'min-height: 44px; border: 0; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 14px; background: ' + (q ? this.D.SHIPS[q.owner].color : '#5aa9ff') + '; color: #070a12;',
      waiting: !!rl && !q, waitText: rl && !this.isHuman(rl.q.owner) ? this.D.SIDES[this.sideOf(rl.q.owner)].short + ' gunners rolling…' : ''
    };
    const win = g.winner;
    return {
      turn: g.turn, phaseLabel: phaseLabel,
      modeLabel: this.mission ? 'Operation Iron Tide · ' + this.mission.code + ' ' + this.mission.name : this.modeHot() ? 'Hot-seat · 2 players' : 'Skirmish · versus AI',
      turnMax: this.mission && this.mission.turns ? ' / ' + this.mission.turns : '',
      restartLabel: this.mission && g.phase !== 'over' ? 'Restart mission' : 'New battle',
      mis: misView, startMissionClick: this.startMissionClick, skirmish: this.skirmish,
      insp: insp, nextShip: this.nextShip, orderOpts: orderOpts, torp: torp, torpClick: this.torpClick, fleet: fleet, targets: targets, pv: pvm,
      badges: badges, toggleBadges: this.toggleBadges, badgesPressed: this.ui.arcBadges ? 'true' : 'false', badgesBg: this.ui.arcBadges ? '#26324a' : 'rgba(8,12,22,0.86)',
      toggleSound: this.toggleSound, soundPressed: this.ui.muted ? 'false' : 'true', soundOn: !this.ui.muted, soundOff: this.ui.muted, soundLabel: this.ui.muted ? 'Sound off — click to unmute' : 'Sound on — click to mute', canOrder: canOrder,
      plotName: canOrder ? plot.def.name : '—', plotColor: canOrder ? plot.def.color : '#93a3bf',
      destDist: destDist, destBearing: destBearing, destTurn: destTurn,
      commit: this.commit, commitDisabled: commitDisabled, commitLabel: commitLabel, commitStyle: commitStyle,
      banner: banner, bannerBorder: bannerBorder,
      hasSummary: g.phase === 'orders' && !!g.summary, summary: g.summary,
      labels: labels,
      tray: tray, rollClick: this.rollClick,
      setInspect: this.setInspect, onDbl: this.onDbl,
      loading: this.ui.loading, loadNote: this.ui.loadNote,
      showHandoff: g.phase === 'handoff', takeOver: this.takeOver,
      showOver: g.phase === 'over' && !this.mission,
      showDebrief: g.phase === 'over' && !!this.mission && !!g.debrief, db: dbView,
      overTitle: win === 'draw' ? 'Mutual destruction' : win === 'concord' ? 'Concord victory' : 'Reaver victory',
      overColor: win === 'draw' ? '#ffc94d' : win === 'concord' ? '#5aa9ff' : '#ff6a3d',
      overBorder: win === 'draw' ? '#6b4310' : win === 'concord' ? '#2a5a8f' : '#8f3a22',
      overText: g.overText,
      restart: this.restart, toggleEnemyArcs: this.toggleEnemyArcs,
      enemyArcsPressed: this.ui.enemyArcs ? 'true' : 'false', enemyArcsBg: this.ui.enemyArcs ? '#26324a' : 'rgba(8,12,22,0.86)',
      zoomIn: this.zoomIn, zoomOut: this.zoomOut, recenter: this.recenter,
      setCanvas: this.setCanvas, onDown: this.onDown, onMove: this.onMove, onUp: this.onUp, onLeave: this.onLeave, onWheel: this.onWheel, noMenu: this.noMenu,
      cursor: g.phase === 'orders' ? 'crosshair' : 'default'
    };
  }
}
