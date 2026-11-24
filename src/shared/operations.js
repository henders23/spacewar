// Gunline · the campaign's operations: map nodes, briefings, the order they unlock in, forks and drydocks.
// Shared by the Operation board (map, briefings, progress) and the battle board (forks, next operation).
class GLOps {
  opsData() {
    if (this._ops) return this._ops;
    const ironTide = {
      m1: { code: 'M1', name: 'Picket Line', type: 'FLEET ENGAGEMENT', x: 14, y: 45, brief: 'The Reaver vanguard is probing the Varn picket: the Maw of Ruin and its raider escort. Break them before the rest of the clan follows.', terrain: 'Open space, 160 × 110u',
        blocks: [['ENEMY', '#ff8a8a', ['Maw of Ruin (Ravager-class battleship)', 'Carrion Wing (Harrow-class raider)']],
                 ['OBJECTIVES', '#ffc94d', ['Destroy, capture or drive off both Reaver ships']],
                 ['REWARDS', '#7be3a4', ['+400 credits, +1 renown', 'Any ship you board and capture joins your fleet as a prize']]] },
      m2a: { code: 'M2A', name: 'Convoy Run', type: 'ESCORT', x: 43, y: 23, req: ['m1'], fork: 'm2', brief: 'Three ore freighters must cross the Varn shallows to the yards. Reaver raiders will come in from the north edge from turn 3.', terrain: 'Open space; freighters steam west at 12u a turn',
        blocks: [['ENEMY', '#ff8a8a', ['Two Harrow-class raiders arrive on turn 3', 'Maw of Ruin arrives on turn 5 if any freighter is still on the map']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: at least 2 freighters exit the west edge by turn 9', 'Secondary: all 3 get through']],
                 ['SPECIAL RULES', '#8cc4ff', ['Freighters have Hull 4, Shields 1 all round, no weapons, and hold their course']],
                 ['REWARDS', '#7be3a4', ['+250 credits per freighter saved', 'Secondary: +1 renown and Cmdr. Ama Okafor joins as a captain']],
                 ['IF YOU FAIL', '#ff8a8a', ['The yards cannot supply you: drydock prices +25% for the rest of the operation']]] },
      m2b: { code: 'M2B', name: 'Salvage Field', type: 'RAID', x: 43, y: 67, req: ['m1'], fork: 'm2', brief: 'A wrecked Concord cruiser lies in the Tessaly asteroid belt with its lance foci intact. Recover the salvage before the Reavers strip it.', terrain: 'Asteroid field: rocks block fire and hole hulls',
        blocks: [['ENEMY', '#ff8a8a', ['Two Harrow-class raiders', 'Proximity mines around the wreck (2d6 to any ship ending within 3u)']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: recover 2 of 3 salvage beacons (end a move within 5u), then exit the east edge by turn 12', 'Secondary: recover all 3']],
                 ['SPECIAL RULES', '#8cc4ff', ['A ship that ends its move inside an asteroid takes D3 (no saves)', 'Asteroids block line of fire between ships']],
                 ['REWARDS', '#7be3a4', ['+200 credits per beacon and +1 renown', 'Secondary: +150 credits']],
                 ['IF YOU FAIL', '#ff8a8a', ['The Reavers refit with the salvage: their lances get +6u range for the rest of the operation']]] },
      d1: { code: 'D1', name: 'Drydock Varn', type: 'DRYDOCK', x: 70, y: 45, dock: true, shipyard: true, req: ['m2a', 'm2b'], brief: 'Repair, recruit and refit before pushing into Reaver space. Use the drydock section below, then leave dock to unlock M3.', terrain: 'Safe harbour',
        blocks: [['SERVICES', '#8cc4ff', ['Hull 40 credits per point · criticals 60 each · crew 30 each', 'Upgrades from the catalogue']]] },
      m3: { code: 'M3', name: 'The Reaver Lair', type: 'PRIZE HUNT', x: 95, y: 45, req: ['d1'], brief: 'Prisoners point to the tender Mother Hydra, which refuels every Reaver raid. Take her intact.', terrain: 'Reaver station in a debris ring; the station guns fire at anything within 20u',
        blocks: [['ENEMY', '#ff8a8a', ['Mother Hydra (Hull 14, Crew 5, no guns, cannot move)', 'Lair Station: 4d6 turrets at 20u, all arcs', 'Maw of Ruin on guard']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: capture Mother Hydra by boarding by turn 10. Destroying her fails the mission', 'Secondary: cripple the Maw of Ruin']],
                 ['REWARDS', '#7be3a4', ['Mother Hydra joins your fleet', '+500 credits, +2 renown (+1 for the secondary)']],
                 ['IF YOU FAIL', '#ff8a8a', ['The Reavers keep their supply line: +1 Reaver raider in M4 and M5']]] },
      m4: { code: 'M4', name: 'Kessel Gate', type: 'BREAKTHROUGH', x: 120, y: 64, req: ['m3'], brief: 'The Reaver blockade line holds the only jump route to Station Aurel. Punch through it.', terrain: 'A gravity well in the centre drags every course toward it',
        blocks: [['ENEMY', '#ff8a8a', ['Maw of Ruin and two raiders across the middle of the map']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: get 2 ships off the east edge by turn 10', 'Secondary: lose no ships']],
                 ['REWARDS', '#7be3a4', ['+600 credits, +1 renown (+1 for the secondary)']],
                 ['IF YOU FAIL', '#ff8a8a', ['Ships still in the zone after turn 10 are captured']]] },
      d2: { code: 'D2', name: 'Forward Base Sela', type: 'DRYDOCK', x: 136, y: 24, dock: true, repairsOnly: true, tavern: true, req: ['m4'], brief: 'Last chance to repair before the final battle. Leave dock to unlock M5.', terrain: 'Safe harbour',
        blocks: [['SERVICES', '#8cc4ff', ['Repairs only; no new upgrades (no shipyard)']]] },
      m5: { code: 'M5', name: 'Iron Tide', type: 'HOLD THE STATION', x: 150, y: 49, req: ['d2'], brief: 'The Maw of Ruin leads the Reaver tide against Station Aurel. Hold the station until the home fleet arrives.', terrain: 'Station Aurel in the centre (Hull 20, shields 3, 6d6 at 24u)',
        blocks: [['ENEMY', '#ff8a8a', ['Maw of Ruin as flagship (refitted, Hull 16) with a raider', 'Reinforcements on turns 4 and 7']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: Station Aurel survives 8 turns', 'Secondary: destroy or capture the Maw of Ruin']],
                 ['REWARDS', '#7be3a4', ['+800 credits, +3 renown (+1 for the secondary). Operation complete']]] }
    };
    const blackMeridian = {
      b1: { code: 'B1', name: 'Into the Rift', type: 'FLEET ENGAGEMENT', x: 16, y: 48, brief: 'What is left of the Reaver clans has fled into the Meridian Rift, a nebula that swallows sensor returns. Their Lancer packs hunt in the murk.', terrain: 'Nebula clouds: no fire into or out of a cloud beyond 12u',
        blocks: [['ENEMY', '#ff8a8a', ['Three Lancer-class strike craft (fast, one torpedo each); a fourth arrives on turn 3']],
                 ['OBJECTIVES', '#ffc94d', ['Destroy, capture or drive off the Lancer pack']],
                 ['REWARDS', '#7be3a4', ['+500 credits, +1 renown']]] },
      b2a: { code: 'B2A', name: 'Ghost Signal', type: 'RESCUE', x: 48, y: 22, req: ['b1'], fork: 'b2', brief: 'A Concord distress beacon: the cruiser CNS Halcyon, adrift and crippled, with Lancers closing to strip her.', terrain: 'Nebula edge; CNS Halcyon (Hull 6 of 8, cannot move, point defence still working) near the centre',
        blocks: [['ENEMY', '#ff8a8a', ['Two Lancers from the east; a Harrow raider on turn 3 and another Lancer from the north on turn 4']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: CNS Halcyon survives, uncaptured, to the end of turn 7', 'Secondary: lose no ships']],
                 ['REWARDS', '#7be3a4', ['CNS Halcyon joins your fleet (Valiant-class cruiser, needs repairs)', '+300 credits, +1 renown']],
                 ['IF YOU FAIL', '#ff8a8a', ['The Halcyon is lost with all hands']]] },
      b2b: { code: 'B2B', name: 'Burn the Depots', type: 'STRIKE', x: 48, y: 70, req: ['b1'], fork: 'b2', brief: 'Three fuel depots keep the Reaver dreadnought Gravemind fed. Burn them before it can sortie.', terrain: 'Open space; proximity mines around the depots',
        blocks: [['ENEMY', '#ff8a8a', ['Three fuel depots (Hull 6, no guns)', 'Two Lancers on guard', 'Proximity mines']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: destroy all three depots by turn 10', 'Secondary: lose no ships']],
                 ['REWARDS', '#7be3a4', ['+700 credits, +1 renown (+1 for the secondary)']],
                 ['IF YOU FAIL', '#ff8a8a', ['The Gravemind sails fully fuelled: +4 Hull and +1 shield on every facing in B3']]] },
      d3: { code: 'D3', name: 'Meridian Anchorage', type: 'DRYDOCK', x: 80, y: 46, dock: true, shipyard: true, tavern: true, req: ['b2a', 'b2b'], brief: 'A Concord anchorage at the edge of the Rift: full shipyard, and the last refit before the Gravemind. Leave dock to unlock B3.', terrain: 'Safe harbour',
        blocks: [['SERVICES', '#8cc4ff', ['Repairs, recruits, upgrades and new hulls', 'Capt. Davin Holt can be hired here if you have not already']]] },
      b3: { code: 'B3', name: 'The Gravemind', type: 'FLAGSHIP', x: 132, y: 46, req: ['d3'], brief: 'The Reaver dreadnought Gravemind, eleven units of armour and grudge, waits in the heart of the Rift with its Lancer escort. End it.', terrain: 'Nebula clouds; the Gravemind carries a tractor beam (10u) and torpedoes',
        blocks: [['ENEMY', '#ff8a8a', ['Gravemind (Reaver dreadnought: Hull 22, 8-dice broadsides, tractor beam 10u, 2 torpedoes)', 'Two Lancers']],
                 ['OBJECTIVES', '#ffc94d', ['Primary: destroy or capture the Gravemind by turn 12', 'Secondary: lose no ships']],
                 ['REWARDS', '#7be3a4', ['+1,200 credits, +3 renown (+1 for the secondary). Operation complete']]] }
    };
    this._ops = {
      iron_tide: { id: 'iron_tide', n: 1, title: 'Operation Iron Tide', nodes: ironTide, order: ['m1', 'm2a', 'm2b', 'd1', 'm3', 'm4', 'd2', 'm5'], final: 'm5', next: 'black_meridian',
        intro: 'The Reaver Clans have broken through the Varn picket. Rear-Admiral, take the Resolute squadron forward, break up their raiding parties, find the lair their ships return to, and hold Station Aurel when the Maw of Ruin comes for it. Your ships, crews and captains carry every scar from one mission to the next.',
        startYard: 'Fleet yard, before M1', legs: [['m1', 'm2a'], ['m1', 'm2b'], ['m2a', 'd1'], ['m2b', 'd1'], ['d1', 'm3'], ['m3', 'm4'], ['m4', 'd2'], ['d2', 'm5']],
        ending: (sv) => (sv.done.m5 === 'won' ? 'Station Aurel held.' : 'Station Aurel fell.') },
      black_meridian: { id: 'black_meridian', n: 2, title: 'Operation Black Meridian', nodes: blackMeridian, order: ['b1', 'b2a', 'b2b', 'd3', 'b3'], final: 'b3', next: null,
        intro: 'Iron Tide broke the Reaver advance; Black Meridian ends it. Follow the survivors into the Meridian Rift, where nebula clouds blind long guns, cut the Gravemind off from its fuel, and destroy the dreadnought before the clans can rebuild around it.',
        startYard: 'Varn yards, before B1', legs: [['b1', 'b2a'], ['b1', 'b2b'], ['b2a', 'd3'], ['b2b', 'd3'], ['d3', 'b3']],
        ending: (sv) => (sv.done.b3 === 'won' ? 'The Gravemind is gone and the Rift is quiet.' : 'The Gravemind escaped into the Rift.') }
    };
    return this._ops;
  }

  opOf(sv) { return this.opsData()[(sv && sv.op) || 'iron_tide']; }

  // Node states for the save's current operation: won / failed / skipped / open / dock / locked.
  progress(sv) {
    const op = this.opOf(sv), d = sv.done || {}, left = sv.dockLeft || {}, st = {};
    const settled = (k) => !!d[k] || !!left[k];
    op.order.forEach((k) => {
      const n = op.nodes[k], ready = (n.req || []).every(settled);
      st[k] = n.dock ? (ready ? (left[k] ? 'won' : 'dock') : 'locked') : (d[k] ? d[k] : ready ? 'open' : 'locked');
    });
    const flownAny = op.order.some((k) => !op.nodes[k].dock && d[k] && d[k] !== 'skipped');
    const dock = !flownAny ? 'start' : (op.order.filter((k) => st[k] === 'dock')[0] || null);
    return { op: op, st: st, dock: dock, complete: !!d[op.final], order: op.order };
  }

  // What the dock the fleet is at offers.
  dockInfo(sv, dock) {
    const op = this.opOf(sv);
    if (!dock) return null;
    if (dock === 'start') return { name: op.startYard, shipyard: true, repairsOnly: false, tavern: false };
    const n = op.nodes[dock];
    return { name: n.name, shipyard: !!n.shipyard, repairsOnly: !!n.repairsOnly, tavern: !!n.tavern };
  }

  // Flying one branch of a fork skips the others.
  forkSkips(sv, key) {
    const op = this.opOf(sv), n = op.nodes[key];
    if (!n || !n.fork) return [];
    return op.order.filter((k) => k !== key && op.nodes[k].fork === n.fork);
  }
}
