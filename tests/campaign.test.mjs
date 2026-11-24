import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, board, playOut, freshSave } from './helpers.mjs';

test('every Iron Tide mission starts, ends and writes its result back to the save', () => {
  const c = engine();
  for (const code of ['m1', 'm2a', 'm2b', 'm3', 'm4', 'm5']) {
    for (let k = 0; k < 6; k++) {
      c.save = freshSave(); c.startMission(code);
      assert.equal(c.mission.code, code.toUpperCase());
      playOut(c, 40);
      assert.equal(c.g.phase, 'over', code + ' ended');
      const sv = c.save, d = sv.debrief;
      assert.ok(d && d.code === code.toUpperCase());
      assert.ok(sv.done[code] === 'won' || sv.done[code] === 'failed');
      assert.equal(sv.current, null);
      sv.fleet.forEach((f) => { assert.ok(f.hull >= 1 && f.crew >= 1); });
    }
  }
});

test('the M2 fork: flying one branch skips the other', () => {
  const c = engine(); c.save = freshSave(); c.startMission('m2b'); playOut(c, 40);
  assert.equal(c.save.done.m2a, 'skipped');
});

test('Operation board: drydock work orders, captains and hiring', () => {
  const o = board('Operation.dc.html');
  o.onSave(null);
  let sv = o.copy(); sv.done = { m1: 'won', m2a: 'won', m2b: 'skipped' }; sv.fleet[0].hull = 6; o.write(sv);
  o.setState({ ship: 'resolute' });
  for (let i = 0; i < 6; i++) o.setRep('resolute', 'hull', 1);
  o.setFit('resolute', 'engines', 'drives');
  assert.equal(o.spentOf(o.state), 6 * 40 + 200);
  o.confirmWork();
  assert.equal(o.state.sv.fleet[0].hull, 12); assert.equal(o.state.sv.fleet[0].sitsOut, true);
  o.assignCap('vigilant', 'varga');
  assert.equal(o.state.sv.fleet[0].cap, null); assert.equal(o.state.sv.fleet[1].cap, 'varga');
  o.leaveDock();
  assert.equal(o.progress(o.state.sv).st.m3, 'open');
});

test('every Black Meridian mission starts, ends and writes back; the B2 fork skips the other branch', () => {
  const c = engine();
  for (const code of ['b1', 'b2a', 'b2b', 'b3']) {
    for (let k = 0; k < 6; k++) {
      c.save = Object.assign(freshSave(), { op: 'black_meridian' }); c.startMission(code);
      assert.equal(c.mission.code, code.toUpperCase());
      playOut(c, 40);
      assert.equal(c.g.phase, 'over', code + ' ended');
      assert.ok(['won', 'failed'].includes(c.save.done[code]));
      if (code === 'b2a') assert.equal(c.save.done.b2b, 'skipped');
      if (code === 'b2a' && c.save.done.b2a === 'won') assert.ok(c.save.fleet.some((f) => f.id === 'halcyon'), 'Halcyon joins');
      if (code === 'b2b' && c.save.done.b2b === 'failed') assert.equal(c.save.mods.gravemindFuel, true);
    }
  }
  c.save = Object.assign(freshSave(), { op: 'black_meridian', mods: { gravemindFuel: true } }); c.startMission('b3');
  assert.equal(c.g.ships.e_grave.hull, 26); assert.equal(c.D.SHIPS.e_grave.shields.fore, 4);
});

test('veterancy: levels from battles, carried into battle, lost with half the crew', () => {
  const c = engine();
  assert.deepEqual([0, 1, 2, 3, 5, 6, 9].map((n) => c.vetLevel(n)), [0, 1, 1, 2, 2, 3, 3]);
  const sv = freshSave(); sv.fleet[0].battles = 6; c.save = sv; c.startMission('m1');
  assert.equal(c.D.SHIPS.resolute.vet, 3);
  c.g.ships.resolute.crew = 3; c.g.ships.e_maw.dead = true; c.g.ships.e_carrion.dead = true; c.finishTurn();
  assert.equal(c.save.fleet[0].battles, 3, 'elite drops to veteran');
  assert.ok(c.boardOdds(3, 2, false, true) > c.boardOdds(3, 2, true));
});

test('nebulae block fire beyond 12u into or out of a cloud', () => {
  const c = engine(); c.g.feat = { nebula: [{ x: 0, y: 0, r: 10 }] };
  assert.equal(c.blocked({ x: 0, y: 0 }, { x: 20, y: 0 }), true);
  assert.equal(c.blocked({ x: 0, y: 0 }, { x: 11, y: 0 }), false);
  assert.equal(c.blocked({ x: 30, y: 0 }, { x: 50, y: 0 }), false);
});

test('Operation board: shipyard, the next operation, hiring at Meridian Anchorage', () => {
  const o = board('Operation.dc.html');
  o.onSave(null);
  let sv = o.copy(); sv.credits = 2000; o.write(sv);
  o.buyHull('vigilant');
  assert.equal(o.state.sv.fleet.length, 3); assert.equal(o.state.sv.credits, 1350); assert.equal(o.state.sv.fleet[2].name, 'CNS Valour');
  sv = o.copy(); sv.done = { m1: 'won', m2a: 'won', m2b: 'skipped', m3: 'won', m4: 'won', m5: 'won' }; sv.dockLeft = { d1: true, d2: true }; o.write(sv);
  assert.equal(o.renderVals().canNextOp, true);
  o.nextOp();
  assert.equal(o.state.sv.op, 'black_meridian');
  let P = o.progress(o.state.sv); assert.equal(P.st.b1, 'open'); assert.equal(P.dock, 'start');
  assert.equal(o.renderVals().opTitle, 'OPERATION BLACK MERIDIAN');
  sv = o.copy(); sv.done.b1 = 'won'; sv.done.b2b = 'won'; sv.done.b2a = 'skipped'; o.write(sv);
  P = o.progress(o.state.sv); assert.equal(P.dock, 'd3');
  const holt = o.renderVals().captains.find((c) => c.name.includes('Holt'));
  assert.equal(holt.canHire, true);
  o.leaveDock(); assert.equal(o.progress(o.state.sv).st.b3, 'open'); assert.equal(o.state.mission, 'b3');
});
