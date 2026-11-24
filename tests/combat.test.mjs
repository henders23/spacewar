import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, drain } from './helpers.mjs';

test('boarding odds: classic Risk exchanges and the Boarding Master edge', () => {
  const c = engine(), t = c.riskTable(3, 2);
  assert.ok(Math.abs(t['0,2'] - 0.3717) < 1e-3 && Math.abs(t['1,1'] - 0.3357) < 1e-3 && Math.abs(t['2,0'] - 0.2926) < 1e-3);
  assert.ok(Math.abs(c.boardOdds(3, 2) - 0.656) < 2e-3);
  assert.ok(Math.abs(c.boardOdds(3, 2, true) - 0.825) < 3e-3);
  for (const [a, d] of [[2, 2], [5, 4], [7, 8]]) assert.ok(c.boardOdds(a, d, true) > c.boardOdds(a, d));
});

test('torpedo: a run through the target\'s end position strikes; a ship that moves off the line is missed', () => {
  const c = engine(), g = c.g;
  Object.assign(g.ships.vigilant, { x: -40, y: 0, h: 0 }); Object.assign(g.ships.maw, { x: -22, y: 0, h: Math.PI });
  Object.assign(g.ships.resolute, { x: -40, y: -40 }); Object.assign(g.ships.carrion, { x: 60, y: 40 });
  const base = (mawDest) => {
    g.orders = { vigilant: { order: 'steady', dest: { x: -32, y: 0 }, target: 'maw', torp: true }, maw: { order: 'steady', dest: mawDest, target: 'auto' },
      resolute: { order: 'steady', dest: { x: -32, y: -40 } }, carrion: { order: 'steady', dest: { x: 50, y: 40 } } };
  };
  base({ x: -28, y: 0 });
  c.beginMovement();
  assert.equal(g.torps.length, 1); assert.equal(g.ships.vigilant.torps, 0);
  assert.equal(g.torps[0].hit, true);
  const c2 = engine(), g2 = c2.g;
  Object.assign(g2.ships.vigilant, { x: -40, y: 0, h: 0 }); Object.assign(g2.ships.maw, { x: -22, y: 0, h: Math.PI / 2 });
  Object.assign(g2.ships.resolute, { x: -40, y: -40 }); Object.assign(g2.ships.carrion, { x: 60, y: 40 });
  g2.orders = { vigilant: { order: 'steady', dest: { x: -32, y: 0 }, target: 'maw', torp: true }, maw: { order: 'aaf', dest: { x: -22, y: 18 }, target: 'auto' },
    resolute: { order: 'steady', dest: { x: -32, y: -40 } }, carrion: { order: 'steady', dest: { x: 50, y: 40 } } };
  c2.beginMovement();
  assert.equal(g2.torps[0].hit, false, 'turning off the line dodges it');
});

test('torpedo strike: 2d6 ignoring shields and armour, halved when braced', () => {
  const c = engine(), g = c.g, B = g.ships.maw;
  c.rollN = (n) => new Array(n).fill(4);
  c.D.CRITKEY = ['', 'fire', 'fire', 'fire', 'fire', 'fire', 'fire'];
  g.orders = {};
  drain(c, c.torpSeq({ owner: 'vigilant', target: 'maw', x: B.x, y: B.y }));
  assert.equal(B.hull, 13 - 8);
  const c2 = engine(), B2 = c2.g.ships.maw; c2.rollN = (n) => new Array(n).fill(3); c2.g.orders = { maw: { order: 'brace' } };
  drain(c2, c2.torpSeq({ owner: 'vigilant', target: 'maw', x: B2.x, y: B2.y }));
  assert.equal(B2.hull, 13 - 3);
});

test('tractor beam: winning the roll-off drags the target 4u (never inside 4.2u) and holds it', () => {
  const c = engine(), g = c.g, A = g.ships.maw, B = g.ships.vigilant;
  Object.assign(A, { x: 0, y: 0 }); Object.assign(B, { x: -10, y: 0 });
  c.rollN = (n) => new Array(n).fill(3);       // 3+2 vs 3+1: the beam wins
  drain(c, c.tractorSeq(A, B));
  assert.ok(Math.abs(B.x - -6) < 1e-9);
  assert.equal(B.heldTurn, g.turn + 1);
  g.turn += 1;
  assert.equal(c.env(B, 'steady').speed, 10);
  Object.assign(B, { x: -5, y: 0 }); drain(c, c.tractorSeq(A, B));
  assert.ok(Math.abs(Math.hypot(B.x - A.x, B.y - A.y) - 4.2) < 1e-9);
});
