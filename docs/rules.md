# Sealed Orders — Core Rules (draft v0.2, working title)

Capital ships slugging it out in open space. Both admirals write orders in secret,
every ship moves at the same moment, and then every gun fires at the same moment.
Fistfuls of d6 decide who is still flying.

Distances are in units (u). The battle zone is 120u × 80u; a battleship is ~7u long.
Movement is free (no squares or hexes).

## 1. The turn

1. **Orders** — in secret, each player places a destination marker for every ship and may give it one special order. Orders are sealed once committed.
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
| Brace for Impact | Normal zone | Armour saves +1; every weapon rolls half dice (round up) |

## 3. Firing arcs & gunnery

Arcs are four 90° quadrants measured from the ship's centre: **fore** (±45° of the bow), **port**, **starboard**, **aft**.
Find which of the firer's arcs the target's centre is in; every weapon covering that arc and within range rolls its dice.

| Range | To hit |
|---|---|
| Close, ≤12u | 3+ |
| Medium, 12–24u | 4+ |
| Long, >24u (to weapon range) | 5+ |

Modifiers: **narrow profile −1** (firer is in the target's fore or aft arc); All Ahead Full −1; Lock On +1; Bridge Hit −1.
Natural 6 always hits, natural 1 always misses; to-hit is clamped to 2+…6+.

## 4. Shields, armour & damage

- **Shields (by facing)** — each ship has four shield values: fore / port / starboard / aft. Use the facing the shots arrive on (whichever of the target's arcs the firer sits in); that shield cancels that many hits outright. Ordinary hits are removed first, 6s last.
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

Criticals stack and take effect after gunnery. The firer rolls on the table. **End phase:** each Fire! deals 1 damage, then each player rolls a d6 per critical still active on their own ship to repair it.

## 6. Collisions, disengaging & victory

- **Collision** — ships ending with centres within 4u each take D3 damage (no saves) and are pushed apart. A **Ram Prow** with the enemy in its fore arc deals D6 instead.
- **Leaving the zone** — a ship ending outside the 120u × 80u zone has disengaged and counts as lost.
- **Victory** — destroy or drive off the enemy flagship. Both lost in the same turn = mutual destruction.

## 7. Ship profiles

### CNS Resolute — Dominion-class battleship (Concord Navy)
Speed 12u · Turn 45° · Hull 14 · Shields F2 P2 S2 A1 · Armour 4+

| Weapon | Arc | Dice | Range | Notes |
|---|---|---|---|---|
| Port broadside | Port | 7 | 30u | |
| Starboard broadside | Stbd | 7 | 30u | |
| Prow lance | Fore | 2 | 30u | Lance |
| Dorsal turrets | All | 2 | 18u | |

Model: `assets/ships/resolute.glb` (pack file "futuristic space battleship 3d model.glb").

### Maw of Ruin — Ravager-class battleship (Reaver Clans)
Speed 16u · Turn 60° · Hull 13 · Shields F3 P2 S2 A1 · Armour 5+

| Weapon | Arc | Dice | Range | Notes |
|---|---|---|---|---|
| Port broadside | Port | 6 | 24u | |
| Starboard broadside | Stbd | 6 | 24u | |
| Graviton maw | Fore | 4 | 18u | Lance |
| Spinal turrets | All | 2 | 18u | |
| Ram prow | Fore | — | — | Collisions deal D6 |

Model: `assets/ships/maw.glb` (pack file "sci-fi battleship 3d model.glb").

## Designer's notes (online build)

- **Server-authoritative turns**: clients submit `{destination, specialOrder}` per ship; the server validates against the manoeuvre zone and waits for both players (or a timer). In gunnery it prompts each player for their own rolls and generates each die on the player's click, so rolls stay tamper-proof, then streams results to both clients.
- **Balance snapshot**: `node tools/balance-sim.js` runs 1,500 AI-vs-AI duels. Current profiles (facing shields): Resolute ≈51%, Maw ≈32%, mutual destruction ≈17%, ~6.5 turns per duel. The AI is a simple one-turn look-ahead, so treat this as a starting point.
- **Open questions**: target priority for fleets; wreck hazards; firing in mid-move tick slices vs. end of move; altitude bands.
