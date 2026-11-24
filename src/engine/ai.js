// Gunline · The one-turn look-ahead AI used for the Reaver side (and both sides in simulations).
// Methods are copied onto each board's Component (see src/shared/install.js); `this` is the game.
class GLAI {
  aiPlan(me, foe) {
    const fe = this.env(foe, 'steady');
    const pf = { x: foe.x + Math.cos(foe.h) * fe.speed * 0.75, y: foe.y + Math.sin(foe.h) * fe.speed * 0.75, h: foe.h };
    const opts = this.count(me, 'bridge') > 0 ? ['steady'] : ['steady', 'aaf', 'about', 'lock', 'brace', 'ram'];
    let best = null;
    opts.forEach((o) => {
      const e = this.env(me, o);
      for (let i = 0; i <= 10; i++) {
        const b = (-e.turn + 2 * e.turn * i / 10) * Math.PI / 180;
        for (let j = 0; j <= 3; j++) {
          const d = e.minMove + (e.maxMove - e.minMove) * j / 3;
          const dest = { x: me.x + d * Math.cos(me.h + b), y: me.y + d * Math.sin(me.h + b) };
          const end = this.path(me, dest).at(1);
          const r = Math.hypot(end.x - pf.x, end.y - pf.y);
          let fp = this.firepower(me, end.x, end.y, end.h, foe, pf.x, pf.y, pf.h, o);
          let efp = this.firepower(foe, pf.x, pf.y, pf.h, me, end.x, end.y, end.h, 'steady');
          if (o === 'brace') efp *= 0.65;
          if (o === 'ram') {
            const reach = 4 + me.def.len * 0.5, ok = r <= reach && this.arcOf({ x: end.x, y: end.y, h: end.h }, pf.x, pf.y) === 'fore';
            fp += ok ? (3.5 + (me.def.len >= 8 ? 2 : 1) + (me.def.ram ? 2 : 0)) * 1.2 - 1.5 : -4;
          }
          let score = fp * 1.25 - efp;
          if (fp === 0) score -= r * 0.09;
          if (me.def.ram && r < 4 && this.arcOf({ x: end.x, y: end.y, h: end.h }, pf.x, pf.y) === 'fore') score += 2.5;
          this.ids().forEach((fid) => { const f = this.g.ships[fid]; if (fid !== me.id && f.def.side === me.def.side && this.active(f) && Math.hypot(f.x - end.x, f.y - end.y) < 7) score -= 3; });
          if (Math.abs(end.x) > this.D.W / 2 - 6 || Math.abs(end.y) > this.D.H / 2 - 6) score -= 6;
          if (Math.abs(end.x) > this.D.W / 2 || Math.abs(end.y) > this.D.H / 2) score -= 100;
          score += Math.random() * 0.8;
          if (!best || score > best.score) best = { score: score, order: o, dest: dest };
        }
      }
    });
    return best;
  }

  aiOrders(side) {
    const g = this.g;
    this.ctrl(side).forEach((id) => {
      const me = g.ships[id], foe = this.nearestEnemy(me);
      if (!foe) { const e = this.env(me, 'steady'); g.orders[id] = { order: 'steady', dest: { x: me.x + Math.cos(me.h) * e.speed, y: me.y + Math.sin(me.h) * e.speed } }; return; }
      const plan = this.aiPlan(me, foe);
      // AI focus fire: the most damaged enemy within reach, otherwise closest-target.
      const near = this.sideShips(this.enemySide(me.def.side)).map((k) => g.ships[k]).filter((t) => Math.hypot(t.x - me.x, t.y - me.y) < 38).sort((a, b) => a.hull / a.def.hull - b.hull / b.def.hull);
      const tgt = near.length ? near[0].id : 'auto', tt = me.torps > 0 ? this.torpTarget(me, tgt) : null;
      const torp = !!tt && Math.hypot(tt.x - me.x, tt.y - me.y) <= (tt.def.speed < this.D.TORP.speed ? 40 : 30);
      g.orders[id] = { order: plan.order, dest: plan.dest, target: tgt, torp: torp };
    });
  }
}
