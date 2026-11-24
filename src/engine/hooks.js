// Gunline · engine set-up and headless defaults. The battle board overrides every presentation hook here with
// its 3D/audio versions; simulations and tests run the engine with these no-ops.
class GLHooks {
  initEngine() {
    this.D = this.defs();
    this.ui = Object.assign({ order: 'steady', hover: null, target: 'auto', torp: false }, this.ui || {});
    this.fx = this.fx || []; this.anim = null; this.save = null; this.mission = null;
    this.buildRoster(this.skirmishRoster());
    this.ui.sel = this.ui.sel || this.ids()[0];
  }

  bump() {}
  refreshOverlays() {}
  placeShips() {}
  frameShips() {}
  syncShipObjs() {}
  loadNeededModels() { return []; }
  buildFeatures() {}
  updateFeatures() {}
  syncTorps() {}
  placeTorps() {}
  impact() {}
  sfx() {}
  engineHum() {}
  unlockAudio() {}
  boom() {}
  flash() {}
  explode() {}
  kick() {}
  addShake() {}
  tumble(q, dice, done) { done(); }
  playFx() { return 0; }
}
