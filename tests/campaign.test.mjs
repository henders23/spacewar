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
