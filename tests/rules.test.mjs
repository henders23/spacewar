import test from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './helpers.mjs';

test('movement: the arc ends on the marker, heading turns by twice the bearing', () => {
  const c = engine();
  for (const [h, dx, dy] of [[0.3, 8, 9], [-1, 10, -2], [2, -5, 6]]) {
    const p = c.path({ x: 0, y: 0, h }, { x: dx, y: dy }), e = p.at(1);
    assert.ok(Math.hypot(e.x - dx, e.y - dy) < 1e-9);
    assert.ok(Math.abs(c.norm(e.h - h - 2 * p.b)) < 1e-9);
  }
});

test('arcs are four 90° quadrants', () => {
  const c = engine(), s = { x: 0, y: 0, h: 0 };
  assert.equal(c.arcOf(s, 10, 0), 'fore');
  assert.equal(c.arcOf(s, 0, 10), 'port');
  assert.equal(c.arcOf(s, 0, -10), 'stbd');
  assert.equal(c.arcOf(s, -10, 1), 'aft');
});

test('to-hit by range band, clamped 2+…6+', () => {
  const c = engine(), s = c.g.ships.resolute;
  assert.equal(c.toHitTN(10, false, 'steady', s), 3);
  assert.equal(c.toHitTN(20, false, 'steady', s), 4);
  assert.equal(c.toHitTN(28, false, 'steady', s), 5);
  assert.equal(c.toHitTN(10, false, 'lock', s), 2);
  assert.equal(c.toHitTN(28, true, 'aaf', s), 6);
});

test('captain traits: Daredevil keeps full turn on All Ahead Full, Steady Hand keeps full dice when braced', () => {
  const c = engine(), g = c.g;
  assert.equal(c.env(g.ships.vigilant, 'aaf').turn, 50);      // Rheel, Daredevil
  assert.equal(c.env(g.ships.resolute, 'aaf').turn, 22.5);    // Varga is not
  assert.equal(c.env(g.ships.vigilant, 'ram').turn, 25);      // Ram still halves
  const R = g.ships.resolute, w = R.def.weapons[0];
  assert.equal(c.weaponDice(R, w, 'brace'), 4);
  R.def.capTrait = 'steady';
  assert.equal(c.weaponDice(R, w, 'brace'), 7);
});

test('refits change the ship profile', () => {
  const c = engine();
  c.buildRoster([{ id: 'r', cls: 'resolute', fit: { a: 'heavy_bs', b: 'drives', c: 'torpedoes', d: 'tractor', e: 'marines' } }]);
  const d = c.D.SHIPS.r;
  assert.equal(d.weapons.find((w) => w.id === 'port').dice, 8);
  assert.equal(d.turn, 40); assert.equal(d.speed, 14); assert.equal(d.torps, 2); assert.equal(d.tractor, 8); assert.equal(d.crew, 10);
  assert.equal(c.D.CLASSES.resolute.weapons.find((w) => w.id === 'port').dice, 7, 'class template untouched');
});
