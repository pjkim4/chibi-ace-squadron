# Chibi Ace Squadron (Neon Surge 3D)

Welcome to **Chibi Ace Squadron**, the ultimate arcade survival shooter! This project started as **Neon Surge 3D** and has evolved into a high-octane 3D dogfight simulator. Navigate your aircraft through intense sectors, destroy waves of UFOs, and survive the massive Mothership boss encounters.

## 🚀 Version History (V94.8)

This project has undergone extensive restoration and optimization. Key highlights include:
- **V94.8: Radar Blackout & Transition Cleanup** — Resolved HUD "ghost" issues during sector transitions.
- **V94.7: Integrity Reset & Chibi-Scale** — Atomic state purge for Mothership UI and mobile-first mesh scaling.
- **V94.5: Label Synchronization** — Standardized "CONTINUE" and "RETIRED" arcade terminology.
- **V94.4: Mobile Elite Restoration** — Fixed engine-sync and nomenclature crashes in the game loop.
- **V94.3: Mission Feedback** — Restored "STAGE CLEARED" celebrations and sector scanning status.

## 🎮 Arcade Features

- **Dogfight AI:** Fast-paced enemy UFOs that track the player and fire magenta plasma bolts.
- **Mothership Boss Battles:** Encounter a massive octagonal dreadnought every 5 levels with targetable energy cores.
- **Chibi-Scale Proportions:** Optimized mesh sizes for mobile viewports (iPhone/Android).
- **Guardian Shield System:** Automated respawn invulnerability with visual flicker feedback.
- **Physics-Based Combat:** Powered by `cannon-es` for precise aircraft/bullet interactions.
- **Adaptive HUD:** Real-time tracking of Stage, Lives, Score, Armor Shield, and Ionizing Bomb charge.

## ⌨️ Controls

### Desktop
- **W / A / S / D**: Maneuver aircraft.
- **Mouse Movement**: Aim and track targets.
- **Left Click**: Fire Lasers.
- **Space**: Detonate Ionizing Bomb (when charged).
- **C**: Continue (at Menu).
- **E**: Retire (at Menu).

### Mobile (iPhone / Tablet)
- **Drag (Center)**: Proportional aircraft maneuvering and aiming.
- **Tap (Center)**: Fire Lasers.
- **Ionize Button**: Detonate Bomb.
- **CONTINUE**: Rejoin the fight after losing all lives.
- **RETIRED**: Exit the mission.

## 🛠️ Performance Scaling (Mobile Elite)
The engine automatically detects touch devices and adjusts:
- **Bullet Speed**: Reduced by 25% for fair touch-based dogfights.
- **UFO Scale**: 30% smaller meshes for better viewport visibility.
- **Mothership Volume**: Compressed radius to ensure HUD clarity.

## 🏗️ Development

This project uses **Vite** as its development server and bundler.

### Running Locally
1. Ensure you have [Node.js](https://nodejs.org/) installed.
2. Run `npm install` to download dependencies (`three`, `cannon-es`).
3. Run `npm run dev` to start the local server.
4. Visit `http://localhost:5173/`.

### Building for Deployment
1. Run `npm run build`.
2. Upload the `dist/` folder to your host (Vercel, GitHub Pages, etc.).

---
*Engine Version: V94.8 Prototype*
