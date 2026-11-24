import test from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './helpers.mjs';

// The firing preview is exact expected damage (criticals aside). Compare it with simulated volleys,
// breach criticals turned off so both measure the same thing.
function check(setup, order, N) {
  const c = engine();
  c.D.CRITKEY = ['', 'fire', 'fire', 'fire', 'fire', 'fire', 'fire'];
  c.newGame(true); setup(c);
  const A = c.g.ships.resolute, pv = (c.expectedVolley(A, [c.g.ships.maw], order, 'maw').maw || { dmg: 0 }).dmg;
  let tot = 0;
  for (let i = 0; i < N; i++) {
    c.newGame(true); setup(c);
    c.g.orders = { resolute: { order, target: 'maw' } };
    const pend = c.perShip(() => ({ dmg: 0, crits: [], shield: { fore: 0, port: 0, stbd: 0, aft: 0 } }));
    const it = c.attackSeq(c.g.ships.resolute, order, pend);
    let r = it.next(); while (!r.done) { const q = r.value; r = it.next(q.type === 'roll' ? c.rollN(q.n) : q.auto); }
    tot += pend.maw.dmg;
  }
  return { pv, sim: tot / N };
}
const place = (extra) => (c) => {
  const g = c.g; Object.assign(g.ships.resolute, { x: 0, y: 0, h: 0 }); Object.assign(g.ships.maw, { x: 0, y: -16, h: 0 });
  Object.assign(g.ships.resolute.def, extra || {});
};

for (const [name, setup, order] of [
  ['steady broadside at 16u', place(), 'steady'],
  ['Gunnery Master with Lock On', place(), 'lock'],
  ['Gunnery Master + veteran gun crews', place({ gunners: true }), 'lock'],
  ['braced (half dice)', place(), 'brace']
]) {
  test('preview matches simulation: ' + name, () => {
    const { pv, sim } = check(setup, order, 12000);
    assert.ok(Math.abs(pv - sim) < 0.06 + pv * 0.03, `preview ${pv.toFixed(3)} vs simulated ${sim.toFixed(3)}`);
  });
}
