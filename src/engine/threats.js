// Gunline · what could hurt a ship at a given end position this turn: torpedo runs (exact: a torpedo steers for
// where its target is now), enemy tractor beams and rams (reach), and boarding exposure. Used while plotting.
class GLThreats {
  threatsAt(me, pose) {
    const g = this.g, out = [], foes = this.sideShips(this.enemySide(me.def.side)).map((id) => g.ships[id]);
    const name = (s) => s.def.name.replace('CNS ', '');
    // Torpedoes already running at this ship.
    (g.torps || []).forEach((t) => {
      if (t.gone || t.target !== me.id) return;
      const run = this.torpRun(t, me, pose, me.def), src = g.ships[t.owner];
      out.push({ kind: 'torp', live: true, hit: run.hit, from: { x: t.x, y: t.y }, to: run.full, reach: run.reach,
        text: 'Torpedo from ' + (src ? name(src) : 'the enemy') + (run.hit ? ' strikes you here (2d6, ignores shields)' : ' misses you here'), sev: run.hit ? 3 : 0 });
    });
    // Torpedoes an enemy could launch at this ship this turn: they leave the bow and steer for where you are now.
    foes.forEach((e) => {
      if (!(e.torps > 0) || this.count(e, 'bridge') || Math.hypot(e.x - me.x, e.y - me.y) > this.D.TORP.range) return;
      const bow = e.def.len * 0.55, t = { x: e.x + Math.cos(e.h) * bow, y: e.y + Math.sin(e.h) * bow, h: e.h };
      const run = this.torpRun(t, me, pose, me.def);
      out.push({ kind: 'torp', live: false, hit: run.hit, from: { x: t.x, y: t.y }, to: run.full, reach: run.reach,
        text: name(e) + ' could launch a torpedo (' + e.torps + ' left): it would ' + (run.hit ? 'strike you here' : 'miss you here'), sev: run.hit ? 2 : 0 });
    });
    // Tractor beams: an enemy that can end within its beam range of this position may lock on.
    foes.forEach((e) => {
      if (!e.def.tractor) return;
      const reach = this.env(e, 'aaf').maxMove + e.def.tractor, d = Math.hypot(e.x - pose.x, e.y - pose.y);
      if (d > reach) return;
      const p = this.tractorOdds(e, me);
      out.push({ kind: 'tractor', at: { x: e.x, y: e.y }, r: reach, text: name(e) + '’s tractor beam can reach you here (' + Math.round(p * 100) + '% to pull you 4u and hold you)', sev: 1 });
    });
    // Rams: any enemy that can get its prow onto this position.
    foes.forEach((e) => {
      const reach = this.env(e, 'ram').maxMove + 4 + e.def.len * 0.5;
      if (Math.hypot(e.x - pose.x, e.y - pose.y) > reach) return;
      const mass = e.def.len >= 8 ? 2 : 1, prow = e.def.ram ? 2 : 0;
      out.push({ kind: 'ram', text: name(e) + ' could ram you here (1d6+' + (mass + prow) + ', no shields or saves)', sev: 1 });
    });
    // Boarding: below half hull, any facing whose shield is knocked down lets a ship within 6u board.
    if (me.hull < me.def.hull / 2) {
      const near = foes.filter((e) => e.crew >= 2 && Math.hypot(e.x - pose.x, e.y - pose.y) <= this.env(e, 'aaf').maxMove + 6);
      if (near.length) out.push({ kind: 'board', text: 'Boarding risk: below half hull, ' + near.map(name).join(' and ') + ' can board you through any facing whose shields go down', sev: 2 });
    }
    return out.sort((a, b) => b.sev - a.sev);
  }

  // Chance a beam ship wins the roll-off against this target: d6 + mass each, ties to the beam.
  tractorOdds(A, B) {
    const mA = A.def.len >= 8 ? 2 : 1, mB = B.def.len >= 8 ? 2 : 1;
    let w = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + mA >= b + mB) w++;
    return w / 36;
  }
}
