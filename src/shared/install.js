// Gunline · copies module methods onto a board class. A board's own methods always win, so a module only
// fills in what the board does not define (that is how src/engine/hooks.js supplies headless defaults).
function glInstall(proto, modules) {
  modules.forEach((M) => {
    Object.getOwnPropertyNames(M.prototype).forEach((k) => {
      if (k === 'constructor' || Object.prototype.hasOwnProperty.call(proto, k)) return;
      Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(M.prototype, k));
    });
  });
  return proto;
}
