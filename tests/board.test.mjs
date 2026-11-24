import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, board } from './helpers.mjs';

test('clear course undoes a plot; the turn is logged for replay', () => {
  const c = engine(), g = c.g, s = g.ships[g.plotting];
  c.setDest(s.x + 10, s.y);
  assert.ok(g.drafts[g.plotting]);
  c.clearPlot();
  assert.equal(g.drafts[g.plotting], undefined); assert.equal(g.dest, null);
  c.aiOrders('concord'); c.aiOrders('reaver'); c.beginMovement();
  assert.equal(g.replay.turn, 1);
  assert.deepEqual(Object.keys(g.replay.start).sort(), c.ids().slice().sort());
  assert.ok(Object.keys(g.replay.paths).length >= 4);
});

test('battle board: the How to play steps advance when the player does each thing', () => {
  const b = board('Main.dc.html');
  b.tutStart();
  let v = b.renderVals();
  assert.equal(v.tut.show, true); assert.equal(v.tut.title, 'Welcome to Gunline'); assert.equal(v.tut.manual, true);
  b.tutNext(); v = b.renderVals();
  assert.equal(v.tut.title, 'Plot a course'); assert.equal(v.tut.waiting, true);
  const g = b.g, s = g.ships[g.plotting]; b.setDest(s.x + 10, s.y);
  v = b.renderVals(); assert.equal(v.tut.title, 'Orders and targets');
  b.tutNext(); b.switchPlot('vigilant'); b.setDest(g.ships.vigilant.x + 10, g.ships.vigilant.y);
  v = b.renderVals(); assert.equal(v.tut.title, 'Commit');
  assert.equal(v.canClear, true);
  b.tutEnd(); v = b.renderVals(); assert.equal(v.tut.show, false);
});
