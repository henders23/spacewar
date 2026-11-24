// Test helpers: load the rules engine headless (src/engine + src/shared, no board), or a whole built board.
import fs from 'node:fs';
import path from 'node:path';
import { BOARDS, boardScript } from '../tools/build.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
globalThis.performance = globalThis.performance || { now: () => Date.now() };

class DCLogic { constructor(p) { this.props = p || {}; this.state = {}; } setState(s) { this.state = Object.assign({}, this.state, s); } }

// A game with every rule but no rendering: dice roll automatically, presentation hooks are no-ops.
export function engine(props) {
  const mods = BOARDS['Main.dc.html'].modules.filter(([f]) => fs.existsSync(path.join(root, f)));
  const code = [fs.readFileSync(path.join(root, 'src/shared/install.js'), 'utf8')].concat(mods.map(([f]) => fs.readFileSync(path.join(root, f), 'utf8')))
    .concat(['class Headless extends DCLogic { constructor(p) { super(p); this.initEngine(); this.autoAll = true; this.newGame(true); } }',
      'glInstall(Headless.prototype, [' + mods.map(([, c]) => c).join(', ') + ']);', 'return Headless;']).join('\n');
  const Headless = new Function('DCLogic', code)(DCLogic);
  return new Headless(props || {});
}

// A built board's Component, constructed headless (no window: its 3D and storage stay idle).
export function board(name, props) {
  const C = new Function('DCLogic', boardScript(name) + '\nreturn Component;')(DCLogic);
  return new C(props || {});
}

// Drive a generator sequence to the end, rolling every die and taking every choice's default.
export function drain(c, it) { let r = it.next(); while (!r.done) { const q = r.value; r = it.next(q.type === 'roll' ? c.rollN(q.n) : q.auto); } }

// Play an AI-vs-AI battle to the end; returns the game.
export function playOut(c, maxTurns) {
  let n = 0;
  while (c.g.phase !== 'over' && n++ < (maxTurns || 60)) { c.aiOrders('concord'); c.aiOrders('reaver'); c.beginMovement(); c.afterMove(); }
  return c.g;
}

export function freshSave() {
  return { v: 1, credits: 600, renown: 0, done: {}, dockLeft: {}, mods: {}, results: {}, current: null,
    fleet: [{ id: 'resolute', cls: 'resolute', name: 'CNS Resolute', hull: 14, crew: 8, crits: [], fit: {}, battles: 0, cap: 'varga' },
      { id: 'vigilant', cls: 'vigilant', name: 'CNS Vigilant', hull: 8, crew: 6, crits: [], fit: {}, battles: 0, cap: 'rheel' }] };
}
