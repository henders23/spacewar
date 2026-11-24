import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, playOut } from './helpers.mjs';

test('AI-vs-AI skirmishes all finish, and neither side dominates', () => {
  const c = engine(), w = { concord: 0, reaver: 0, draw: 0 };
  const N = 300;
  for (let i = 0; i < N; i++) { c.newGame(true); const g = playOut(c); assert.equal(g.phase, 'over', 'battle ended'); w[g.winner]++; }
  assert.ok(w.concord > N * 0.3 && w.reaver > N * 0.3, JSON.stringify(w));
});
