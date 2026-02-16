# Neon Rift Protocol

An original, mobile-first, lane-shifting roguelite built entirely in vanilla HTML5 canvas. You thread a pulse orb through three neon lanes, weaving past void spires, drones, and shard storms while stacking combos, triggering flux dashes, and unlocking permanent upgrades.

https://github.com placeholder until deployment

## Core Features

- **Adaptive difficulty curve** – enemy spawn tables evolve as you survive longer, introducing drones, erratic obstacles, and higher drift speeds.
- **Combo + energy economy** – shards refill energy, increase combo multipliers, and unlock burst phases. Miss too many and the rift collapses.
- **Permanent workshop upgrades** – spend banked shards on thrust, focus, magnet, shield, and dash-flux modules. Everything persists locally via `localStorage`.
- **Touch + keyboard parity** – swipe/tap controls for phones, arrow/WASD + space for keyboards, plus on-screen buttons for dashes.
- **Achievement telemetry** – lightweight feat tracker that rewards high-score hunts and flawless runs.
- **PWA-ready shell** – manifest + icons let you “Add to Home Screen” on iOS/Android for fullscreen play.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Shift lane | Arrow keys / A-D | Swipe left/right or tap left/right thirds |
| Dash (invulnerability + burst) | Space / W / Arrow Up | Tap center third or ⚡ button |

## Local Development

```bash
# serve locally (any static server works)
npx serve .
# or
python3 -m http.server 4173
```

Visit `http://localhost:4173` (or whichever port your server prints). Because the game uses `localStorage`, you’ll keep your upgrade profile between reloads.

## Deployment

1. Push the repository to GitHub.
2. Enable GitHub Pages → Branch: `main`, folder: `/`.
3. Share the Pages URL (`https://<username>.github.io/<repo>/`).

The build is static, so Pages/Netlify/Vercel all work without additional config.

## Assets & License

- Icons generated procedurally at runtime (no external IP).
- Code and assets are released under the MIT License. Feel free to remix, but keep the credit line.
