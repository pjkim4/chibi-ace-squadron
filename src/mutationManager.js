/**
 * MutationManager.js
 * Handles stage-wide gameplay modifiers for Neon Surge.
 */

export const Mutations = {
  HYPER_DRIVE: {
    name: "HYPER-DRIVE",
    description: "SPEED +50%",
    color: "#00ffff",
    icon: "⚡"
  },
  SPLIT_SHOT: {
    name: "SPLIT-SHOT",
    description: "TWIN LASERS",
    color: "#00ff00",
    icon: "⚔️"
  },
  TIME_DILATION: {
    name: "TIME-DILATION",
    description: "ENEMIES -25% SPEED",
    color: "#aa00ff",
    icon: "⏳"
  },
  OVERLOAD: {
    name: "OVERLOAD",
    description: "DOUBLE SCORE / 25 MISS LIMIT",
    color: "#ffaa00",
    icon: "⚠️"
  },
  RAPIDFIRE: {
    name: "RAPID-FIRE",
    description: "COOLDOWN -50%",
    color: "#ff00aa",
    icon: "🔥"
  },
  BOSS_OVERLOAD: {
    name: "MEGA-OVERLOAD",
    description: "MAX CHALLENGE / 10 MISS LIMIT",
    color: "#ff0000",
    icon: "💀"
  },
  TRIPLE_LASER: {
    name: "TRIPLE-LASER",
    description: "OVERWHELMING FIREPOWER",
    color: "#00ffff",
    icon: "🔱"
  },
  NUCLEAR_SHOCKWAVE: {
    name: "NUCLEAR-SHOCKWAVE",
    description: "CHAIN REACTIONS",
    color: "#ffaa00",
    icon: "☢️"
  }
};

let currentMutation = null;

export function selectRandomMutation(stage) {
  // Boss Stages (Every 10)
  if (stage % 10 === 0) {
    currentMutation = Mutations.BOSS_OVERLOAD;
    return currentMutation;
  }

  // Bonus Stages (Every 4) - Usually no harmful mutations
  if (stage % 4 === 0) {
    currentMutation = null;
    return null;
  }

  const pool = Object.keys(Mutations).filter(key => key !== 'BOSS_OVERLOAD');
  const randomKey = pool[Math.floor(Math.random() * pool.length)];
  currentMutation = Mutations[randomKey];
  return currentMutation;
}

export function getCurrentMutation() {
  return currentMutation;
}

export function clearMutation() {
  currentMutation = null;
}

export function displayMutation(mutation) {
  const display = document.getElementById('mutation-display');
  if (!display) return;

  if (!mutation) {
    display.classList.remove('mutation-active');
    return;
  }

  display.innerText = `${mutation.name}: ${mutation.description}`;
  display.style.borderColor = mutation.color;
  display.style.textShadow = `0 0 10px ${mutation.color}`;
  display.classList.add('mutation-active');

  // Pulse effect duration
  setTimeout(() => {
    // Keep it active but maybe fade slightly? 
    // Actually, keeping it as a persistent HUD element is better.
  }, 3000);
}
