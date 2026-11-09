# Gunline — Core Rules (draft v0.4)

Capital ships slugging it out in open space. Both admirals write orders in secret,
every ship moves at the same moment, and then every gun fires at the same moment.
Fistfuls of d6 decide who is still flying.

Distances are in units (u). The battle zone is 160u × 110u; a battleship is ~7u long.
Movement is free (no squares or hexes).

## 1. The turn

1. **Orders** — in secret, each player places a destination marker for every ship in their squadron, may give each one special order, and may nominate a priority target for each. A squadron's orders are sealed together once committed.
2. **Movement** — orders are revealed; all ships move simultaneously, each sweeping a smooth curve to its marker. Then resolve collisions and ships leaving the zone.
3. **Gunnery** — every weapon that bears fires. Each player rolls their own dice (to-hit and criticals for their weapons, armour saves for their ship). Damage is applied only after *all* ships have fired, so a ship destroyed this phase still gets its last broadside off.
4. **End phase** — fires burn, damage control repairs criticals, destroyed ships are removed, check victory.

## 2. Orders & movement

Every ship has **Speed** and **Turn**. The marker must be inside the ship's **manoeuvre zone**:

- between **½ Speed and full Speed** away, measured straight from the ship's centre (capital ships cannot stop), and
- no more than **Turn°** either side of the bow.

The ship follows a constant-curvature arc that starts tangent to its heading and ends on the marker.
It finishes pointing along the arc, so **its heading changes by twice the marker's bearing**
(a marker 30° off the bow = a 60° turn). Paths never block; only end positions matter.

### Special orders (one per ship per turn)

| Order | Manoeuvre | Gunnery / defence |
|---|---|---|
| Steady | Normal zone | — |
| All Ahead Full | Move full Speed to 1.5× Speed; Turn halved | This ship −1 to hit |
| Come About | Turn +30°; max move ½ Speed; min move 2u | — |
| Lock On | Turn halved | +1 to hit |
| Ram | Move full Speed to 1.5× Speed; Turn halved | This ship −1 to hit; rams an enemy ending within reach in its fore arc |
| Brace for Impact | Normal zone | Armour saves +1; every weapon rolls half dice (round up) |

## 3. Firing arcs & gunnery

Arcs are four 90° quadrants measured from the ship's centre: **fore** (±45° of the bow), **port**, **starboard**, **aft**.
**Targeting:** a ship may nominate a priority target. Every weapon that can bear on it (arc and range) fires at it; any weapon that can't fires at the closest enemy it can bear on. With no priority target, every weapon takes the closest enemy it can reach. Find which of the firer's arcs the target's centre is in; every weapon covering that arc and within range rolls its dice.

| Range | To hit |
|---|---|
| Close, ≤12u | 3+ |
| Medium, 12–24u | 4+ |
| Long, >24u (to weapon range) | 5+ |

Modifiers: **narrow profile −1** (firer is in the target's fore or aft arc); All Ahead Full −1; Lock On +1; Bridge Hit −1.
Natural 6 always hits, natural 1 always misses; to-hit is clamped to 2+…6+.

## 4. Shields, armour & damage

- **Shields (by facing)** — each ship has four shield values: fore / port / starboard / aft. Use the facing the shots arrive on (whichever of the target's arcs the firer sits in); that shield cancels that many hits outright, and it is shared by every attack on that facing this turn. Ordinary hits are removed first, 6s last.
- **Armour** — roll a d6 per remaining hit; meeting Armour saves it (a 1 always fails). Each failed save = 1 damage.
- **Lances** — ignore shields; each failed save = 2 damage.
- **Crippled** — at ≤ half Hull, broadsides roll half dice (round up). 0 Hull = destroyed.

## 5. Critical hits

A to-hit roll of a **natural 6 that causes damage** (gets past shields and armour) triggers a d6 roll:

| D6 | Critical | Effect | Repair |
|---|---|---|---|
| 1 | Hull Breach | +1 damage immediately | Permanent |
| 2 | Fire! | 1 damage every End phase | 4+ |
| 3 | Engines Hit | Speed −4u (min 4u) | 5+ |
| 4 | Steering Jammed | Turn −15° (min 15°) | 5+ |
| 5 | Gun Deck Hit | d6: 1–3 port, 4–6 starboard — that broadside rolls half dice | 5+ |
| 6 | Bridge Hit | No special orders; −1 to hit | 5+ |

**Structural failure:** the first time a ship's hull falls to two-thirds of its starting value, and again at one-third (rounded down), it immediately suffers an extra critical, rolled by its own player (e.g. Resolute, Hull 14, fails at 9 and at 4).

Criticals stack and take effect after gunnery. The firer rolls on the table. **End phase:** each Fire! deals 1 damage, then each player rolls a d6 per critical still active on their own ship to repair it.

## 6. Collisions, disengaging & victory

- **Collision** — any two ships (friend or foe) ending with centres within 4u each take D3 damage (no saves) and are pushed apart. A **Ram Prow** with the enemy in its fore arc deals D6 instead.
- **Leaving the zone** — a ship ending outside the 160u × 110u zone has disengaged and counts as lost.
- **Victory** — destroy or drive off every ship in the enemy squadron. Last ships on both sides lost in the same turn = mutual destruction.

## 7. Ramming & boarding

- **Ram (special order)** — move as All Ahead Full, −1 to hit. If after movement an enemy is within reach (4u + half your length) in your fore arc (priority target first), you ram it: 1d6 + mass (battleship +2, cruiser +1, ram prow +2) damage, **ignoring shields and armour**. You take half a d6 (rounded up; −1 with a ram prow). Rams resolve before gunnery.
- **Boarding** — after damage lands, a ship within 6u of an enemy that is **below half Hull** and whose **shield facing it is down** (spent this turn, or zero) may send a boarding party of any size, leaving at least 1 Crew aboard. Each ship boards, and can be boarded, once per turn.
- **The boarding fight (Risk-style)** — boarders roll one die each (max 3), defenders one each (max 2). Pair highest with highest, second with second; the higher die kills one enemy, **ties go to the defender**. After each round the attacker presses on or withdraws (survivors return). Defenders at 0: the ship **strikes its colours** and leaves the battle as lost, with the surviving boarders aboard as prize crew.

| Capture chance | vs 2 | vs 3 | vs 4 | vs 6 | vs 8 |
|---|---|---|---|---|---|
| 3 boarders | 66% | 47% | 31% | 13% | 5% |
| 5 boarders | 89% | 77% | 64% | 40% | 22% |
| 7 boarders | 97% | 91% | 83% | 64% | 45% |

## 8. Ship profiles (starter squadrons: Resolute + Vigilant vs Maw of Ruin + Carrion Wing)

### CNS Resolute — Dominion-class battleship (Concord Navy)
Speed 12u · Turn 45° · Hull 14 · Shields F2 P2 S2 A1 · Armour 4+ · Crew 8

| Weapon | Arc | Dice | Range | Notes |
|---|---|---|---|---|
| Port broadside | Port | 7 | 30u | |
| Starboard broadside | Stbd | 7 | 30u | |
| Prow lance | Fore | 2 | 30u | Lance |
| Dorsal turrets | All | 2 | 18u | |

Model: `assets/ships/resolute.glb` (pack file "futuristic space battleship 3d model.glb").

### Maw of Ruin — Ravager-class battleship (Reaver Clans)
Speed 16u · Turn 60° · Hull 13 · Shields F3 P2 S2 A1 · Armour 5+ · Crew 7

| Weapon | Arc | Dice | Range | Notes |
|---|---|---|---|---|
| Port broadside | Port | 6 | 24u | |
| Starboard broadside | Stbd | 6 | 24u | |
| Graviton maw | Fore | 4 | 18u | Lance |
| Spinal turrets | All | 2 | 18u | |
| Ram prow | Fore | — | — | Collisions deal D6 |

Model: `assets/ships/maw.glb` (pack file "sci-fi battleship 3d model.glb").

### CNS Vigilant — Valiant-class cruiser (Concord Navy)
Speed 14u · Turn 50° · Hull 8 · Shields F2 P1 S1 A1 · Armour 4+ · Crew 6

| Weapon | Arc | Dice | Range | Notes |
|---|---|---|---|---|
| Port broadside | Port | 4 | 24u | |
| Starboard broadside | Stbd | 4 | 24u | |
| Prow lance | Fore | 1 | 24u | Lance |
| Dorsal turrets | All | 2 | 18u | |

Model: `assets/ships/vigilant.glb` (pack file "space battleship 3d model.glb").

### Carrion Wing — Harrow-class raider (Reaver Clans)
Speed 18u · Turn 60° · Hull 10 · Shields F3 P1 S1 A0 · Armour 5+ · Crew 4

| Weapon | Arc | Dice | Range | Notes |
|---|---|---|---|---|
| Port broadside | Port | 5 | 24u | |
| Starboard broadside | Stbd | 5 | 24u | |
| Talon lances | Fore | 3 | 18u | Lance |
| Spinal turrets | All | 2 | 18u | |

Model: `assets/ships/carrion.glb` (pack file "spacecraft battleship 3d model.glb").

## 9. Campaign battles (Operation Iron Tide)

In the campaign the battle board loads your saved fleet and the mission readied on the Operation board, then writes the result back.

- **Scars carry over** — each ship starts with the hull, crew and criticals it ended its last battle with, and its fitted upgrades. Destroyed or captured ships leave the fleet; enemy ships captured by boarding join it as prizes.
- **Objectives & exits** — each mission has a turn limit and objectives checked at the end of every turn. Leaving by the mission's exit edge (green band) is escaping, not fleeing.
- **Asteroids** block line of fire; a ship ending its move inside one takes D3 (no saves). **Mines**: 2d6 to a ship ending within 3u, once. **Salvage beacons**: your warships recover one by ending within 5u.
- **Gravity well** — after orders are revealed, every destination inside the well is dragged toward its centre (up to ~5u near the core).
- **Freighters** hold course at full speed and can't be ordered. **Stations** never move, fire at the closest enemy in range, and can be boarded.
- **Refits in battle** — heavy broadsides (+1 die, Turn −5°), long-focus lances (+6u), reinforced emitters (+1 fore shield), ablative plating (+1 save vs the first volley each turn), drives (+2u), thrusters (+10°), marines (Crew +2), veteran gun crews (re-roll 1s on broadsides), damage-control teams (repairs 4+, Fire! 3+), ram prow, ECM (−1 to hit at >24u) and point defence (lances −1 to hit). Torpedoes and tractor beams are not in the battle rules yet.

| Mission | Set-up | Win | Reward | If you fail |
|---|---|---|---|---|
| M1 Picket Line | 2v2 vs Maw of Ruin + Carrion Wing | Destroy, capture or drive off both | +400 cr, +1 renown | — |
| M2A Convoy Run | 3 freighters steam west; 2 raiders turn 3, the Maw turn 5 | 2 freighters off the west edge by turn 9 | +250 cr per freighter | Drydock prices +25% |
| M2B Salvage Field | Asteroids, mines, 3 beacons, 2 raiders | 2 beacons + exit east by turn 12 | +200 cr per beacon, +1 renown | Reaver lances +6u |
| M3 The Reaver Lair | Mother Hydra (Hull 14, Crew 5), Lair Station (4d6, 20u), the Maw | Capture the Hydra by boarding by turn 10 | Hydra joins, +500 cr, +2 renown | +1 raider in M4 and M5 |
| M4 Kessel Gate | Gravity well; the Maw + 2 raiders | 2 ships off the east edge by turn 10 | +600 cr | Ships left in the zone are captured |
| M5 Iron Tide | Station Aurel (Hull 20, 6d6 at 24u); Maw (Hull 16) + raider; reinforcements turns 4 and 7 | Station survives 8 turns | +800 cr, +3 renown | Operation lost |

M2A and M2B are a fork: flying one skips the other. Drydocks (before M1, D1 after the fork, D2 after M4) sell repairs (hull 40, criticals 60, crew 30 credits) and upgrades (D2: repairs only); a ship with more than 4 hull repaired or a new upgrade sits out the next mission.

## Designer's notes (online build)

- **Server-authoritative turns**: clients submit `{destination, specialOrder}` per ship; the server validates against the manoeuvre zone and waits for both players (or a timer). In gunnery it prompts each player for their own rolls and generates each die on the player's click, so rolls stay tamper-proof, then streams results to both clients.
- **Balance snapshot**: `node tools/balance-sim.js` runs 1,500 AI-vs-AI duels. Current 2v2 squadrons with ramming and boarding: Concord ≈47%, Reaver ≈47%, mutual destruction ≈6%, ~7 turns per battle. The AI is a simple one-turn look-ahead, so treat this as a starting point.
- **Campaign check**: `node tools/campaign-sim.js` plays every mission AI-vs-AI and checks the save write-back. With a scripted pilot that flies the objective, M2B is won ~74% of the time, M4 ~32% and M3 ~25% (that pilot also shoots the Hydra to pieces in about a third of runs).
- **Open questions**: should a priority target cost something (e.g. −1 to hit when it isn't the closest enemy)?; wreck hazards; firing in mid-move tick slices vs. end of move; altitude bands.
