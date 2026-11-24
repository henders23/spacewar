// Builds the canvas boards (design/*.dc.html) from src/: each board's markup gets one inline script holding the
// engine modules it needs, the board's Component class, and the install call that merges them.
// Usage: node tools/build.mjs [extra output dir ...]   (design/ is always written)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
export const BOARDS = {
  'Main.dc.html': { html: 'src/board/battle.html', board: 'src/board/battle.js',
    modules: [['src/engine/core.js', 'GLCore'], ['src/engine/preview.js', 'GLPreview'], ['src/engine/threats.js', 'GLThreats'], ['src/engine/ai.js', 'GLAI'], ['src/engine/turn.js', 'GLTurn'],
      ['src/engine/combat.js', 'GLCombat'], ['src/shared/operations.js', 'GLOps'], ['src/engine/missions.js', 'GLMissions'], ['src/shared/store.js', 'GLStore'], ['src/engine/hooks.js', 'GLHooks']] },
  'Operation.dc.html': { html: 'src/board/operation.html', board: 'src/board/operation.js',
    modules: [['src/shared/operations.js', 'GLOps'], ['src/shared/store.js', 'GLStore']] }
};

export function boardScript(name) {
  const b = BOARDS[name], mods = b.modules.filter(([f]) => fs.existsSync(path.join(root, f)));
  return ['// Built from src/ by tools/build.mjs — edit the sources, not this file.', read('src/shared/install.js')]
    .concat(mods.map(([f]) => read(f)), [read(b.board), 'glInstall(Component.prototype, [' + mods.map(([, c]) => c).join(', ') + ']);'])
    .join('\n');
}

export function build(outDirs) {
  Object.keys(BOARDS).forEach((name) => {
    const tpl = read(BOARDS[name].html);
    if (!tpl.includes('@@SCRIPT@@')) throw new Error(name + ': template has no @@SCRIPT@@');
    const html = tpl.replace('@@SCRIPT@@', () => boardScript(name));
    outDirs.forEach((d) => fs.writeFileSync(path.join(d, name), html));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const outs = [path.join(root, 'design')].concat(process.argv.slice(2).map((d) => path.resolve(d)));
  build(outs);
  console.log('built ' + Object.keys(BOARDS).join(', ') + ' → ' + outs.join(', '));
}
