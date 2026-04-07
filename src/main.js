// --- Neon Surge 3D Game Engine ---
// Consolidated and stabilized version V59.3
window.onerror = (msg, url, line, col, error) => {
  const ps = document.getElementById('panic-screen');
  const pr = document.getElementById('panic-report');
  if (ps && pr) {
     ps.style.display = 'block';
     pr.innerText = `ERR: ${msg}\nLINE: ${line}\nSTACK: ${error?.stack || 'N/A'}`;
  }
  return false;
};

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as MutationManager from './mutationManager.js';
import { BulletPool } from './bullets.js';

// --- Globals & Engine ---
let scene, camera, renderer, world, composer, bloomPass, controls;
let clock = new THREE.Clock();
let leftEngineGlow, rightEngineGlow, bombCooldown = 0, propellerGroup = null;
let playerShadow = null; // NEW XEVIOUS SHADOW V60
let hypergate = null, groundPlane = null, terrainTexture = null;
let enemyBullets = [];
let audioCtx, mouseDeltaX = 0, mouseDeltaY = 0;
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
window.respawnShieldTimer = 0; // V77 GLOBAL ANCHOR

// --- Game State ---
let isGameOver = false, gameStarted = false;
let currentLevel = 0, score = 0, totalShots = 0, totalHits = 0, targetsRemaining = 0;
let enemiesKilled = 0, enemiesRequired = 100; // V88 EXTENDED QUOTA (100)
let bombCharge = 0; // V89 ION CHARGE SYSTEM
let comboMultiplier = 1, comboTimer = 0, stageStartTime = Date.now();
let elapsedTime = 0, timeDilation = 1.0, hitStopTimer = 0, glitchIntensity = 0;
let overdriveAmount = 0, isOverdrive = false, overdriveTimer = 0;
let enemyBulletPool, enemyFireTimer = 0, playerShield = 100, shieldTimer = 0;
let lastBeatTime = 0, beatInterval = 0.5, flashOpacity = 0;

// --- Assets & FX ---
let playerBody, playerRadius = 1;
let physicsMeshes = [], particles = [], laserBeams = [], ripples = [], floatingTexts = [];
let weaponGroup, barrelTip, muzzleFlashLight, muzzleFlashTimer = 0;
let mazeGrid = [], mazeMeshes = [], mazeSize = 17, cellSize = 6;
let shield = 3, lives = 3, weaponLevel = 1;
let continueTimer = 0, isContinueMenu = false, nextLifeScore = 100000; // 100K BONUS LIVES V80
let explosionTimer = 0, spawnTimer = 0, powerups = [], activeNukes = []; 
let floorMaterial, skybox, chromAbPass;
let hudCanvas, hudCtx, shakeAmount = 0, chromAbTarget = 0.0015;
let energyCore, weaponSideFins = [], weaponEngines = [], shieldMesh = null; // V80 SHIELD MESH
let spaceDust, isLevelAdvancing = false, globalFireTimer = 3.5; // V80 WAVE TIMING
let engineHumOsc, engineHumGain, navArrow, controlStick, targetingLine;
let lastHitTime = 0; // V74 GLOBAL COOLDOWN

// --- UI Elements ---
let instructions, startButton, replayBtn, saveScoreBtn, playerNameInput, leaderboardList;
let radarCanvas, radarCtx, bonusNotificationElement;
let chibiTex, droneTex, forestTex; // V68 TEXTURES

// --- Shaders ---
const ChromaticAberrationShader = {
  uniforms: { "tDiffuse": { value: null }, "amount": { value: 0.0015 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
    void main() {
      vec4 color;
      color.r = texture2D( tDiffuse, vUv + vec2(amount, 0.0) ).r;
      color.g = texture2D( tDiffuse, vUv ).g;
      color.b = texture2D( tDiffuse, vUv - vec2(amount, 0.0) ).b;
      color.a = texture2D( tDiffuse, vUv ).a;
      gl_FragColor = color;
    }`
};

// --- AUDIO MANAGER ---
let ambientOscL, ambientOscR, ambientGain;

function startAmbientSynth() {
  if (!audioCtx) return;
  try {
    ambientGain = audioCtx.createGain();
    const lpf = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.setValueAtTime(400, audioCtx.currentTime);
    
    ambientOscL = audioCtx.createOscillator();
    ambientOscR = audioCtx.createOscillator();
    ambientOscL.type = 'sine'; ambientOscR.type = 'sine';
    ambientOscL.frequency.setValueAtTime(40, audioCtx.currentTime);
    ambientOscR.frequency.setValueAtTime(40.5, audioCtx.currentTime);
    
    ambientGain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    ambientOscL.connect(lpf); ambientOscR.connect(lpf); 
    lpf.connect(ambientGain); ambientGain.connect(audioCtx.destination);
    
    ambientOscL.start(); ambientOscR.start();
  } catch(e) { console.warn("AUDIO: AMBIENT FAILED", e); }
}// --- ARCADE NANO-SYNTH ENGINE (NAMCO-STYLE) V69 ---
function playArcadeSFX(type, vol = 0.1) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const noise = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  switch(type) {
    case 'blaster': // XEVIOUS SWEEP
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(vol * 0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      break;
    case 'explosion': // NOISE-GATE CRUNCH
      const bufferSize = audioCtx.sampleRate * 0.4;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.4);
      gain.gain.setValueAtTime(vol * 2.0, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      noise.connect(filter); filter.connect(gain);
      noise.start();
      break;
    case 'bomb': // GROUND HIT THUD
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(vol * 1.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      break;
    case 'extend': // CHIME
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      setTimeout(() => osc.frequency.setValueAtTime(1760, audioCtx.currentTime), 100);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      break;
    case 'ion_detonation': // V95.1 FUTURISTIC MULTI-LAYER DETONATION
      const ionGain = audioCtx.createGain();
      const warp = audioCtx.createOscillator();
      const thud = audioCtx.createOscillator();
      
      // LAYER 1: THE WARP (CHARGE-UP)
      warp.type = 'sine';
      warp.frequency.setValueAtTime(500, audioCtx.currentTime);
      warp.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.2);
      
      // LAYER 2: THE THUD (IMPACT)
      thud.type = 'square';
      thud.frequency.setValueAtTime(100, audioCtx.currentTime + 0.1);
      thud.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.8);
      
      ionGain.gain.setValueAtTime(0.5 * vol, audioCtx.currentTime);
      ionGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      
      warp.connect(ionGain); thud.connect(ionGain);
      ionGain.connect(audioCtx.destination);
      
      warp.start(); warp.stop(audioCtx.currentTime + 0.25);
      thud.start(audioCtx.currentTime + 0.1); thud.stop(audioCtx.currentTime + 1.2);
      
      // LAYER 3: THE RUMBLE (LF NOISE)
      const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.5, audioCtx.sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseBuf.length; i++) noiseData[i] = Math.random() * 2 - 1;
      const noiseSrc = audioCtx.createBufferSource(); noiseSrc.buffer = noiseBuf;
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'lowpass'; noiseFilter.frequency.setValueAtTime(400, audioCtx.currentTime + 0.1);
      noiseFilter.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 1.0);
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(vol, audioCtx.currentTime + 0.1);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
      noiseSrc.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(audioCtx.destination);
      noiseSrc.start(audioCtx.currentTime + 0.1);
      break;
  }
  if (type !== 'explosion' && type !== 'ion_detonation') {
    gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.5);
  } else if (type === 'explosion') {
    gain.connect(audioCtx.destination);
  }
}

const playLaserSound = () => playArcadeSFX('blaster');
const playExplosionSound = () => playArcadeSFX('explosion');
const playBombSound = () => playArcadeSFX('bomb');
const playPowerupSound = () => playArcadeSFX('extend', 0.2);
const playExtendSound = () => playArcadeSFX('extend', 0.3);
const playArmorCrunchSound = () => playArcadeSFX('explosion', 0.05);
const playBossVictorySound = () => {
  [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => playArcadeSFX('extend', 0.2), i*150));
};

let bgmOsc;
function startArcadeBGM() {
  if (!audioCtx) return;
  const thump = () => {
    if (!gameStarted || isGameOver) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60 + (currentLevel * 5), audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.2);
    g.gain.setValueAtTime(0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    setTimeout(thump, 600 - (currentLevel * 40)); // SPEED UP PER STAGE
  };
  thump();
}

function playVictoryMelody() {
    stopAllAudio();
    const notes = [600, 800, 1000, 1200];
    notes.forEach((f, i) => {
        setTimeout(() => playSound(f, 'sine', 0.5, 0.2), i * 300);
    });
    setTimeout(() => spawnPowerup({ x:0, y:5, z:-50 }, 'shield'), 2000); // VICTORY DROPS V92
}

function stopAllAudio() {
  [ambientOscL, ambientOscR, engineHumOsc].forEach(osc => {
    if (osc) { try { osc.stop(); osc.disconnect(); } catch(e) {} }
  });
  ambientOscL = null; ambientOscR = null; engineHumOsc = null;
}

// --- Initialization ---
function initEngine() {
  console.info("??BOOT: ENGINE INITIALIZING...");
  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020205);
    scene.fog = null; // NO FOG V59

    const texLoader = new THREE.TextureLoader();
    chibiTex = texLoader.load('chibi_skin.png');
    droneTex = texLoader.load('drone_skin.png');
    forestTex = texLoader.load('forest_ground.png');
    forestTex.wrapS = forestTex.wrapT = THREE.RepeatWrapping;
    forestTex.repeat.set(10, 10);
    
    console.info("??BOOT: SCENE & TEXTURES READY.");
  } catch(e) { console.error("BOOSTER: SCENE FAILED", e); }

  try {
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(0, 350, 250); // BROUGHT CLOSER FOR BETTER VISIBILITY V60.8
    camera.lookAt(0, 0, 0); 
    camera.rotation.order = 'YXZ';
    const mainLight = new THREE.AmbientLight(0xffffff, 2.0); // BRIGHTER V60.3
    scene.add(mainLight);

    const sun = new THREE.DirectionalLight(0xffffff, 1.5); // DIRECT SUNLIGHT
    sun.position.set(200, 500, 100); scene.add(sun);

    const headlight = new THREE.PointLight(0xffffff, 50, 1000); // SOFT HEADLIGHT
    headlight.position.set(0, 50, 0); 
    camera.add(headlight);
  } catch(e) { console.error("BOOSTER: CAMERA FAILED", e); }

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);
  } catch(e) { console.error("BOOSTER: RENDERER FAILED", e); }

  try {
    const renderScene = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.0, 0.4, 0.85);
    chromAbPass = new ShaderPass(ChromaticAberrationShader);
    const outputPass = new OutputPass();
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(chromAbPass);
    composer.addPass(outputPass);
  } catch(e) { console.error("BOOSTER: POST-FX FAILED", e); }

  controls = new PointerLockControls(camera, document.body);
  window.addEventListener('blur', () => { 
    const fh = document.getElementById('focus-hint');
    if (fh && gameStarted) fh.style.display = 'block'; 
  });
  window.addEventListener('focus', () => { 
    const fh = document.getElementById('focus-hint');
    if (fh) fh.style.display = 'none'; 
    if (gameStarted && !isGameOver) controls.lock();
  });

  try {
    world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;
  } catch(e) { console.error("BOOSTER: PHYSICS FAILED", e); }

  try { createSkybox(); } catch(e) {}
  try { createFloor(); } catch(e) {}
  try { createWeapon(); } catch(e) {}
  try { createSpaceDust(); } catch(e) {}
  
  enemyBulletPool = new BulletPool(scene, 500);
  renderLeaderboard(); 
  window.addEventListener('resize', onWindowResize);
  console.info("??BOOT: ENGINE COMPLETE.");
}

function renderLeaderboard() {
  let lbEntries = JSON.parse(localStorage.getItem('chibi_ace_scores') || '[]');
  if (lbEntries.length === 0) {
    lbEntries = [
      { name: "ACE_01", score: 500000 },
      { name: "SQUAD_LDR", score: 350000 },
      { name: "WINGMAN", score: 150000 }
    ];
  }
  lbEntries.sort((a,b) => b.score - a.score);
  const startList = document.getElementById('start-leaderboard-list');
  if (startList) {
    startList.innerHTML = lbEntries.slice(0, 5).map(e => `<div>${e.name}: ${e.score.toLocaleString()}</div>`).join('');
  }
  const endList = document.getElementById('leaderboard-list');
  if (endList) {
    endList.innerHTML = lbEntries.slice(0, 10).map(e => `<li>${e.name}: ${e.score.toLocaleString()}</li>`).join('');
  }
}

function saveScore() {
  const nameInput = document.getElementById('player-name');
  const name = nameInput.value.trim() || "PLAYER";
  let lbEntries = JSON.parse(localStorage.getItem('chibi_ace_scores') || '[]');
  lbEntries.push({ name, score });
  lbEntries.sort((a,b) => b.score - a.score);
  localStorage.setItem('chibi_ace_scores', JSON.stringify(lbEntries.slice(0, 50)));
  renderLeaderboard();
  nameInput.value = "";
  alert("SCORE SECURED, PILOT!");
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

function createSkybox() {
  const starCount = 2000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 400 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    starPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i*3+2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ size: 1.5, color: 0xffffff, transparent: true, opacity: 0.8 });
  scene.add(new THREE.Points(starGeo, starMat));
}

function createSpaceDust() {
  const count = 500;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const x = (Math.random()-0.5)*300, y = (Math.random()-0.5)*150, z = (Math.random()-0.5)*300;
    pos[i*6] = x; pos[i*6+1] = y; pos[i*6+2] = z;
    pos[i*6+3] = x; pos[i*6+4] = y; pos[i*6+5] = z - 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
  spaceDust = new THREE.LineSegments(geo, mat);
  scene.add(spaceDust);
}

function createFloor() {
  const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(floorBody);
}

function createWeapon() {
  weaponGroup = new THREE.Group();
  weaponGroup.scale.setScalar(14.0); // ULTIMATE SUPER-CHIBI SCALE V62

  const silverMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3, map: chibiTex }); // TEXTURED HULL V68
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 1.0 }); // GLOWING ENGINE V60.9
  const redMat = new THREE.MeshStandardMaterial({ color: 0xaa0000 });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });

  // 1. CARTOON CHIBI HULL (Wedge-fied)
  const hullGroup = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 4), silverMat);
  hull.rotation.x = Math.PI / 2; hull.position.z = 0.1;
  hullGroup.add(hull);

  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 }));
  cowl.rotation.x = Math.PI / 2; cowl.position.z = -0.45;
  hullGroup.add(cowl);
  weaponGroup.add(hullGroup);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  canopy.position.set(0, 0.15, -0.2); canopy.scale.set(1, 0.7, 1.4);
  weaponGroup.add(canopy);

  // 2. Wings (Solvalou Style)
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.6), silverMat);
    wing.position.set(side * 0.5, 0, 0);
    weaponGroup.add(wing);
    const detail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.2), redMat);
    detail.position.set(side * 0.5, 0.03, 0);
    weaponGroup.add(detail);
  }

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.4), silverMat);
  fin.position.set(0, 0.3, 0.6);
  weaponGroup.add(fin);

  propellerGroup = new THREE.Group();
  propellerGroup.position.z = -0.65;
  const blurDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.01, 24), new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.25 }));
  blurDisc.rotation.x = Math.PI / 2;
  propellerGroup.add(blurDisc);
  weaponGroup.add(propellerGroup);

  scene.add(weaponGroup); 

  // V80 NEON SHIELD AEGIS
  const shieldGeo = new THREE.IcosahedronGeometry(1.2, 1); // SCALED TO WEAPONGROUP V80
  const shieldMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.4 
  });
  shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  weaponGroup.add(shieldMesh);
}

function renderEnvironment() {
  // PROCEDURAL XEVIOUS FOREST GENERATOR V60.3
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#113311'; ctx.fillRect(0,0,512,512); // DARK GREEN BASE
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = (Math.random() > 0.5) ? '#225522' : '#0a220a';
    ctx.fillRect(Math.random()*512, Math.random()*512, 10 + Math.random()*40, 10 + Math.random()*40);
  }
  // NAZCA LINES PROXY
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(512,512); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(512,0); ctx.lineTo(0,512); ctx.stroke();

  terrainTexture = new THREE.CanvasTexture(canvas);
  terrainTexture.wrapS = terrainTexture.wrapT = THREE.RepeatWrapping;
  terrainTexture.repeat.set(20, 20);
  
  const groundMat = new THREE.MeshBasicMaterial({ map: terrainTexture, color: 0x224422 }); // XEVIOUS FOREST V60.3
  groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(15000, 15000), groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -50; // DEEPER VALLEY FOR STABILITY
  scene.add(groundPlane);

  // Player Shadow Mesh (Arcade Depth)
  const shadowGeo = new THREE.CircleGeometry(6, 32);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
  playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
  playerShadow.rotation.x = -Math.PI / 2;
  playerShadow.position.y = -49.5;
  scene.add(playerShadow);

  playerShadow.position.y = -49.5;
  scene.add(playerShadow);
}

let bossActive = false, bossMesh = null, bossHealth = 100;

function tickSpawner(delta) {
  if (bossActive || !gameStarted || isGameOver || isLevelAdvancing) return;
  
  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    // Stage 1 arrival, 5, 10... V66
    if (currentLevel > 0 && (currentLevel === 1 || currentLevel % 5 === 0) && !bossActive && targetsRemaining <= 0) {
      spawnMothership();
    } else if (targetsRemaining < 10 + currentLevel * 5) {
      spawnEnemies(1); 
    }
    spawnTimer = 2.0 - Math.min(1.5, currentLevel * 0.1); 
  }
}

function spawnEnemies(count) {
  for (let i = 0; i < count; i++) {
    const typeRoll = Math.random();
    let hullCol = 0x888888, lightCol = 0x00ffff, hp = 1, scale = 2.5;

    if (typeRoll < 0.4) { // CYAN STRIKER
       hullCol = 0x444444; lightCol = 0x00ffff; hp = 1; scale = 1.8;
    } else if (typeRoll < 0.8) { // MAGENTA TANK
       hullCol = 0x664466; lightCol = 0xff00ff; hp = 5; scale = 3.5;
    } else { // LIME SCOUT
       hullCol = 0x446644; lightCol = 0x00ff00; hp = 2; scale = 2.2;
    }

    // --- V90 CHIBI UFO DESIGN ---
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: hullCol, metalness: 1.0, roughness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, metalness: 1.0 });
    const alienMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1.0 }); // V93
    const lightMat = new THREE.MeshStandardMaterial({ color: lightCol, emissive: lightCol, emissiveIntensity: 2.0 }); // V93

    // 1. UFO Hull (Disc)
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 3, 16), hullMat);
    g.add(hull);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 2, 8, 24), hullMat);
    rim.rotation.x = Math.PI/2; g.add(rim);

    // 2. Dome (Glass)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8, 0, Math.PI*2, 0, Math.PI/2), glassMat);
    dome.position.y = 1.5; g.add(dome);

    // 3. Alien Pilot
    const head = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), alienMat);
    head.position.y = 3; g.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), eyeMat);
    lEye.position.set(-1.2, 3.5, 1.8); g.add(lEye);
    const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), eyeMat);
    rEye.position.set(1.2, 3.5, 1.8); g.add(rEye);

    // 4. Energy Lights
    for (let j = 0; j < 6; j++) {
        const light = new THREE.Mesh(new THREE.SphereGeometry(1.2), lightMat);
        const ang = (j / 6) * Math.PI * 2;
        light.position.set(Math.cos(ang) * 11, 0, Math.sin(ang) * 11);
        g.add(light);
    }
    
    const x = (Math.random() - 0.5) * 200, z = -500 - (Math.random() * 500);
    g.position.set(x, 10 + currentLevel * 2, z);
    const ufoScale = isTouch ? 0.7 : 1.0; // V94.7 MOBILE SCALE
    g.scale.setScalar(scale * ufoScale);
    scene.add(g);

    const body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(12) });
    body.position.copy(g.position);
    world.addBody(body);
    
    physicsMeshes.push({ 
        mesh: g, body, type: 'enemy', hp, 
        isCarrier: (Math.random() < 0.20), 
        fireTimer: 2 + Math.random() * 5 
    });
    targetsRemaining++;
  }
}

function animate() {
  requestAnimationFrame(animate);
  let delta = clock.getDelta();
  if (delta > 0.1) delta = 0.016;

  if (gameStarted && !isGameOver && !isContinueMenu) {
    if (hitStopTimer > 0) { hitStopTimer -= delta; if (hitStopTimer <= 0) hitStopTimer = 0; }

    world.step(1/60, delta);
    updatePlayer();
    if (propellerGroup) propellerGroup.rotation.z += delta * 25;
    
    [particles, laserBeams].forEach(list => {
      for (let i = list.length-1; i >= 0; i--) {
        const p = list[i]; p.lifespan -= delta;
        if (p.lifespan <= 0) { scene.remove(p.mesh); list.splice(i, 1); }
        else if (p.velocity) p.mesh.position.addScaledVector(p.velocity, delta);
      }
    });

    const activeEnemies = physicsMeshes.filter(p=>p.type==='enemy' && !p.toDelete).length;
    if (activeEnemies < 8 && (enemiesKilled + activeEnemies) < enemiesRequired) { // V94.2 POPULATION CONTROL
        spawnEnemies(3); 
    }

    physicsMeshes.forEach(p => {
       if (p.type === 'enemy') {
          if (window.respawnShieldTimer <= 0 && p.mesh.position.distanceTo(weaponGroup.position) < 35) {
             handlePlayerHit(); scene.remove(p.mesh); world.removeBody(p.body); p.toDelete = true; targetsRemaining--;
          }
          const distToPlayer = p.mesh.position.distanceTo(weaponGroup.position);
          p.body.position.y += ((distToPlayer < 100 ? 8 : 12) - p.body.position.y) * delta * 2;
          p.body.velocity.z = 45 + (currentLevel * 2); 
          if (p.body.position.z > 250) {
             p.body.position.z = -400; p.body.position.x = (Math.random()-0.5)*200;
          }

          // V94 AGGRESSIVE AI: UFO FIRING LOGIC
          p.fireTimer -= delta;
          if (p.fireTimer <= 0) {
              const bCol = 0xff00ff;
              const b = new THREE.Mesh(new THREE.SphereGeometry(3), new THREE.MeshStandardMaterial({ color: bCol, emissive: bCol, emissiveIntensity: 5.0 }));
              b.position.copy(p.mesh.position); scene.add(b);
              const dir = new THREE.Vector3().subVectors(playerBody.position, b.position).normalize();
              // V94.4 MOBILE DIFFICULTY SCALE
              const mVel = (isTouch ? 160 : 220) + currentLevel * 10;
              enemyBullets.push({ mesh: b, velocity: dir.multiplyScalar(mVel), lifespan: 5.0 });
              p.fireTimer = ( (isTouch ? 4 : 3) + Math.random() * 4) / Math.max(1, currentLevel * 0.15); 
              playSound(350, 'square', 0.15, 0.05);
          }
       }
       p.mesh.position.copy(p.body.position); p.mesh.quaternion.copy(p.body.quaternion);
    });

    // --- V93 COMBAT RESTORATION: LASER COLLISION ---
    laserBeams.forEach(l => {
        physicsMeshes.forEach(p => {
            if (p.toDelete) return;
            if (p.type === 'enemy' && l.mesh.position.distanceToSquared(p.mesh.position) < 900) { 
                l.toDelete = true;
                p.mesh.traverse(c => { if(c.material) c.material.emissive?.setHex(0xffffff); });
                setTimeout(() => { if(p.mesh) p.mesh.traverse(c => { if(c.material) c.material.emissive?.setHex(0x000000); }); }, 50);
                if (!p.hp) p.hp = 1; p.hp--;
                if (p.hp <= 0) {
                    if (p.isCarrier) spawnPowerup(p.mesh.position, 'shield');
                    else if (Math.random() < 0.03) spawnPowerup(p.mesh.position, 'weapon');
                    scene.remove(p.mesh); world.removeBody(p.body);
                    p.toDelete = true; enemiesKilled++; score += 100;
                    playExplosionSound();
                }
            }
            if (p.type === 'boss' && bossActive && l.mesh.position.distanceToSquared(p.mesh.position) < 40000) { 
                bossHealth -= 20; l.toDelete = true;
                if (bossHealth <= 0) {
                    bossActive = false; detonateMothership(p.mesh);
                    playVictoryMelody(); hitStopTimer = 3.0; // V93 CELEBRATION
                    scene.remove(p.mesh); world.removeBody(p.body); p.toDelete = true;
                }
            }
        });
    });

    enemyBullets.forEach(b => {
       b.mesh.position.addScaledVector(b.velocity, delta * (isTouch ? 0.85 : 1.0)); 
       if (playerBody && window.respawnShieldTimer <= 0 && b.mesh.position.distanceTo(playerBody.position) < 15) {
          handlePlayerHit(); scene.remove(b.mesh); b.toDelete = true;
       }
    }); enemyBullets = enemyBullets.filter(b => !b.toDelete);

    powerups.forEach(p => {
       p.mesh.rotation.y += delta * 2; p.mesh.position.z += delta * 180;
       if (playerBody && p.mesh.position.distanceTo(playerBody.position) < 30) {
          if (p.type === 'shield') shield = Math.min(5, shield + 1);
          if (p.type === 'weapon') weaponLevel = Math.min(5, weaponLevel + 1);
          playPowerupSound(); scene.remove(p.mesh); p.toDelete = true;
       }
       if (p.mesh.position.z > 200) { scene.remove(p.mesh); p.toDelete = true; }
    }); powerups = powerups.filter(p => !p.toDelete);

    if (bossActive && bossMesh) {
        bossMesh.rotation.y += delta * 0.4;
        if (bossMesh.position.z < -600) bossMesh.position.z += delta * 30;
        else bossMesh.position.z = -600 + Math.sin(Date.now()*0.001) * 80;
    }

    if (bombCharge < 100) {
        bombCharge += delta * 15;
        if (bombCharge >= 100) { bombCharge = 100; playSound(800, 'triangle', 0.4, 0.2); }
    }

    if (explosionTimer > 0) {
        explosionTimer -= delta;
        if (bloomPass) bloomPass.strength = 1.5 + (explosionTimer * 10);
    } else if (bloomPass) { bloomPass.strength = 1.5; }

    activeNukes.forEach(n => {
       n.scale += delta * 400; n.lifespan -= delta;
       n.mesh.scale.setScalar(n.scale);
       n.mesh.material.opacity = n.lifespan;
       if (n.lifespan <= 0) { scene.remove(n.mesh); n.toDelete = true; }
    }); activeNukes = activeNukes.filter(n => !n.toDelete);

    if (score >= nextLifeScore) { lives++; nextLifeScore += 200000; playExtendSound(); }

    tickSpawner(delta); 

    if (window.respawnShieldTimer > 0) {
        window.respawnShieldTimer -= delta;
        if (weaponGroup) weaponGroup.visible = Math.floor(Date.now() / 100) % 2 === 0; // FLICKER
        if (shieldMesh) { shieldMesh.visible = true; shieldMesh.rotation.y += delta * 5; }
    } else {
        if (weaponGroup) weaponGroup.visible = true;
        if (shieldMesh) shieldMesh.visible = false;
    }

    if (enemiesKilled >= enemiesRequired && !isLevelAdvancing) {
        isLevelAdvancing = true;
        // V94.8 INSTANT RADAR SHUTDOWN
        bossActive = false; bossMesh = null;
        setTimeout(() => { 
            advanceLevel(); 
            isLevelAdvancing = false; 
            if (currentLevel > 0 && currentLevel % 5 === 0) spawnMothership();
        }, 3000); 
    }

    updateHUDMarkers();
    physicsMeshes = physicsMeshes.filter(p => !p.toDelete);
    laserBeams = laserBeams.filter(l => { if(l.toDelete){ scene.remove(l.mesh); return false; } return true; });
  } else if (isContinueMenu) {
    // V94.2/V94.4 SYNC
    continueTimer -= delta;
    if (continueTimer <= 0) {
        isContinueMenu = false; isGameOver = true;
        triggerGameOver("MISSION FAILURE");
    }
    // V94.4 MOBILE OPTION OVERLAY
    const mobCont = document.getElementById('mobile-continue-ui');
    if (mobCont) mobCont.style.display = isTouch ? 'flex' : 'none';
  }
  updateHUDMarkers(); // V94.4 NOMENCLATURE FIX
  composer.render();
}

function updatePlayer() {
  if (isGameOver || !gameStarted || !playerBody) return;
  playerBody.position.y = 5;
  playerBody.velocity.y = 0;

  // --- ENHANCED MANEUVERABILITY V64 (2x SPEED) ---
  const moveX = (keys['ArrowRight'] || keys['d'] ? 1 : 0) - (keys['ArrowLeft'] || keys['a'] ? 1 : 0);
  const moveZ = (keys['ArrowDown'] || keys['s'] ? 1 : 0) - (keys['ArrowUp'] || keys['w'] ? 1 : 0);
  
  playerBody.position.x += moveX * 4;
  playerBody.position.z += moveZ * 4;

  if (weaponGroup) weaponGroup.rotation.set(0, Math.PI, moveX * -0.3);

  // V84 ABSOLUTE BOUNDARY LOCKDOWN (KEEP CHIBI ON SCREEN)
  playerBody.position.x = Math.max(-120, Math.min(120, playerBody.position.x));
  playerBody.position.z = Math.max(-20, Math.min(150, playerBody.position.z));
  weaponGroup.position.copy(playerBody.position);
  if (playerShadow) {
     playerShadow.position.x = playerBody.position.x;
     playerShadow.position.z = playerBody.position.z;
  }
}

function fireLaser() {
  if (isGameOver || !gameStarted) return;
  
  const spread = 20;
  const patterns = [
    [{ x: 0, a: 0 }], // T1: SINGLE
    [{ x: -4, a: 0 }, { x: 4, a: 0 }], // T2: DUAL
    [{ x: 0, a: 0 }, { x: -8, a: -0.1 }, { x: 8, a: 0.1 }], // T3: TRIPLE
    [{ x: -5, a: -0.1 }, { x: 5, a: 0.1 }, { x: -10, a: -0.2 }, { x: 10, a: 0.2 }], // T4: QUAD V87 CORE
    [{ x: 0, a: 0 }, { x: -4, a: -0.05 }, { x: 4, a: 0.05 }, { x: -8, a: -0.15 }, { x: 8, a: 0.15 }, { x: -12, a: -0.25 }, { x: 12, a: 0.25 }] // V87 CORE-FIRE STACK
  ];
  
  const currentLevelShots = patterns[Math.min(weaponLevel - 1, 4)];
  
  currentLevelShots.forEach(p => {
    // V87 BEAM LIMITER (PREVENT PHYSICS STUCK)
    if (laserBeams.length > 28) {
       const old = laserBeams.shift();
       if (old) scene.remove(old.mesh);
    }

    const mat = new THREE.MeshStandardMaterial({ 
      color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 5.0, 
      transparent: true, opacity: 0.9 
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 40, 8), mat);
    beam.rotation.x = Math.PI / 2;
    beam.position.copy(weaponGroup.position);
    beam.position.x += p.x;
    scene.add(beam);
    
    laserBeams.push({ 
      mesh: beam, 
      toDelete: false, 
      velocity: new THREE.Vector3(Math.sin(p.a) * 200, 0, -700), 
      lifespan: 1.0 
    });
  });

  playLaserSound(); shakeAmount = 2; muzzleFlashTimer = 0.15;
}

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (e.key === 'q' || e.key === 'Q') { location.reload(); }
  if (e.key === ' ' || e.key === 'f' || e.key === 'F') fireLaser();
  if (e.key === 'b' || e.key === 'B') detonateBomb();
  
  if (isContinueMenu) {
      if (e.key === 'c' || e.key === 'C') {
          isContinueMenu = false; lives = 3; shield = 3; score = 0; // PENALTY RESET V64
          playerBody.position.set(0, 5, 50); 
      }
      if (e.key === 'e' || e.key === 'E') {
          location.reload();
      }
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});
window.addEventListener('mousedown', e => { if (gameStarted && !isGameOver) fireLaser(); });

// --- MOBILE ELITE CONTROLS (MULTI-TOUCH) V95.0 ---
let lastTouchX = 0, lastTouchY = 0, moveTouchId = null;
window.addEventListener('touchstart', e => {
  if (!gameStarted || isGameOver || moveTouchId !== null) return;
  const t = e.changedTouches[0];
  moveTouchId = t.identifier;
  lastTouchX = t.clientX; lastTouchY = t.clientY;
}, { passive: false });

window.addEventListener('touchmove', e => {
  if (moveTouchId === null || !playerBody) return;
  e.preventDefault();
  let t = null;
  for (let i=0; i<e.touches.length; i++) {
    if (e.touches[i].identifier === moveTouchId) { t = e.touches[i]; break; }
  }
  if (!t) return;

  const dx = t.clientX - lastTouchX;
  const dy = t.clientY - lastTouchY;
  playerBody.position.x += dx * 0.5;
  playerBody.position.z += dy * 0.5;
  lastTouchX = t.clientX; lastTouchY = t.clientY;
}, { passive: false });

window.addEventListener('touchend', e => {
    for (let i=0; i<e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === moveTouchId) moveTouchId = null;
    }
});
// GLOBAL COCKPIT LOCK V95.4
document.addEventListener('touchmove', e => { if (e.touches.length > 1 || e.scale !== 1) e.preventDefault(); }, { passive: false });
document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

function startGame() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const instr = document.getElementById('instructions');
  if (instr) instr.style.display = 'none';
  const panic = document.getElementById('panic-screen');
  if (panic) panic.style.display = 'none';

  startAmbientSynth(); // FORCE AMBIENT V80
  startArcadeBGM(); // START HEARTBEAT V69
  
  // V90 DEEP STATE PURGE
  physicsMeshes.forEach(p => { scene.remove(p.mesh); world.removeBody(p.body); }); physicsMeshes = [];
  enemyBullets.forEach(b => scene.remove(b.mesh)); enemyBullets = [];
  powerups.forEach(p => scene.remove(p.mesh)); powerups = [];
  laserBeams.forEach(l => scene.remove(l.mesh)); laserBeams = [];
  
  gameStarted = true; isGameOver = false; isContinueMenu = false; // RESET STATE V72
  score = 0; currentLevel = 0; enemiesKilled = 0; enemiesRequired = 100; // V88 EXTENDED QUOTA (RESET)
  lives = 3; shield = 3; weaponLevel = 1;
  window.respawnShieldTimer = 6.0; // V90 STARTUP RECOVERY (EXTENDED)
  bombCharge = 0; // RESET ION CHARGE
  console.warn("🚀 MISSION START: V91 ABSOLUTE LOCKDOWN");
  
  // ATOMIC COORDINATE RESET V74
  if (playerBody) {
      playerBody.position.set(0, 5, 50);
      playerBody.velocity.set(0,0,0); // FORCE STILL V78
  }
  if (weaponGroup) weaponGroup.position.set(0, 5, 50);
  
  advanceLevel(); 
  if (controls) controls.lock();
}

function advanceLevel() {
  currentLevel++; 
  enemiesKilled = 0; // V86 ATOMIC QUOTA RESET
  stageStartTime = Date.now();
  
  // V94.7 ATOMIC HUD RESET (CLEAR BOSS GHOST)
  bossActive = false; 
  bossMesh = null;
  if (groundPlane) scene.remove(groundPlane); // PREVENT STACKING
  if (playerShadow) scene.remove(playerShadow);
  
  switch (currentLevel % 3) {
    case 1: // FOREST
      scene.background = new THREE.Color(0x000510);
      floorMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: forestTex }); // TEXTURED FLOOR V68
      const planeGeo = new THREE.PlaneGeometry(2000, 2000);
      break;
  }
  
  renderEnvironment();
  physicsMeshes.forEach(p => { scene.remove(p.mesh); world.removeBody(p.body); });
  physicsMeshes = [];
  
  // V75/V94.2 STRATEGIC DELAY & POPULATION CONTROL
  setTimeout(() => {
    if (gameStarted && !isGameOver) spawnEnemies(12 + currentLevel * 4); // V94.2 BALANCED SPAWN
  }, 2000); 
}

function initUI() {
  hudCanvas = document.getElementById('hud-overlay');
  if (hudCanvas) { 
    hudCtx = hudCanvas.getContext('2d');
    hudCanvas.width = window.innerWidth; hudCanvas.height = window.innerHeight;
  }
  const sb = document.getElementById('start-button');
  if (sb) sb.onclick = startGame;

  // V94.4 MOBILE CONTINUE BUTTONS
  const mobCont = document.createElement('div');
  mobCont.id = 'mobile-continue-ui';
  mobCont.style.cssText = "position:absolute; bottom:200px; width:100%; display:none; justify-content:center; gap:20px; z-index:2000;";
  mobCont.innerHTML = `
    <button onclick="window.handleContinue()" style="padding:20px 40px; background:#00ffff; color:black; font-family:Orbitron; border:none; font-weight:bold; border-radius:10px;">CONTINUE</button>
    <button onclick="window.handleExit()" style="padding:20px 40px; background:#ff0000; color:white; font-family:Orbitron; border:none; font-weight:bold; border-radius:10px;">RETIRED</button>
  `;
  document.body.appendChild(mobCont);
  
  const saveBtn = document.getElementById('save-score-btn');
  if (saveBtn) saveBtn.onclick = saveScore; // FIX SAVE SCORE V68

  // POPULATE ATTRACTION STATE V67.1
  renderLeaderboard();

  const rb = document.getElementById('replay-btn');
  if (rb) {
      rb.style.display = 'block';
      rb.onclick = () => { location.reload(); };
  }
}

function updateHUDMarkers() {
  if (!hudCtx) return;
  hudCtx.clearRect(0,0,hudCanvas.width, hudCanvas.height);
  
  // HUD AESTHETIC V63
  hudCtx.fillStyle = "white"; hudCtx.font = "bold 20px Orbitron";
  hudCtx.fillText(`STAGE: ${currentLevel} | LIVES: ${lives} | SCORE: ${score}`, 20, 60);
  
  // EXTEND NOTIFICATION V66
  if (score > nextLifeScore - 10000) {
      hudCtx.fillStyle = "#ff00ff"; hudCtx.font = "bold 12px Orbitron";
      hudCtx.fillText(`EXTEND AT: ${nextLifeScore}`, 20, 115);
  }
  
  // SHIELD BAR V63
  const shieldColor = shield > 1 ? "#00ffff" : "#ff0000";
  hudCtx.fillStyle = "rgba(0,0,0,0.5)"; hudCtx.fillRect(20, 80, 200, 20);
  hudCtx.fillStyle = shieldColor; hudCtx.fillRect(20, 80, (shield/3) * 200, 20);
  hudCtx.strokeStyle = "white"; hudCtx.strokeRect(20, 80, 200, 20);
  hudCtx.font = "bold 12px Orbitron"; hudCtx.fillText("ARMOR SHIELD", 25, 95);

  // V74 SHIELD ACTIVE INDICATOR
  if (window.respawnShieldTimer > 0) {
      hudCtx.fillStyle = "#00ffff"; hudCtx.font = "bold 24px Orbitron";
      hudCtx.fillText("[ GUARDIAN SHIELD ACTIVE ]", 25, 140);
  }

  // V89 BOMB IONIZING RADAR
  if (gameStarted) {
      hudCtx.fillStyle = "rgba(0,255,255,0.2)"; hudCtx.fillRect(hudCanvas.width - 250, 40, 200, 10);
      hudCtx.fillStyle = bombCharge >= 100 ? "#ffffff" : "#00aaaa";
      hudCtx.fillRect(hudCanvas.width - 250, 40, bombCharge * 2, 10);
      hudCtx.font = "bold 10px Orbitron"; hudCtx.fillStyle = "white";
      hudCtx.fillText(bombCharge >= 100 ? "BOMB READY [SPACE]" : "IONIZING BOMB...", hudCanvas.width - 250, 35);
  }

  // V94.3 MISSION COMPLETE CELEBRATION
  if (isLevelAdvancing) {
      hudCtx.fillStyle = "#00ffff"; hudCtx.font = "bold 60px Orbitron"; hudCtx.textAlign = "center";
      hudCtx.shadowBlur = 20; hudCtx.shadowColor = "#00ffff";
      hudCtx.fillText(`STAGE ${currentLevel+1} CLEARED`, hudCanvas.width/2, hudCanvas.height/2);
      hudCtx.font = "bold 24px Orbitron";
      hudCtx.fillText("SCANNING NEXT SECTOR...", hudCanvas.width/2, hudCanvas.height/2 + 60);
      hudCtx.shadowBlur = 0; hudCtx.textAlign = "left";
  }

  // V89/V94.8 BOSS HEALTH RADAR (ACCURATE DENOMINATOR)
  if (bossActive && bossMesh && !isLevelAdvancing) {
      const maxHP = 5000 + currentLevel * 1000;
      const hpWidth = (bossHealth / maxHP) * (hudCanvas.width - 200);
      hudCtx.fillStyle = "rgba(0,0,0,0.5)"; hudCtx.fillRect(100, 40, hudCanvas.width - 200, 15);
      hudCtx.fillStyle = "#ff0000"; hudCtx.fillRect(100, 40, Math.max(0, hpWidth), 15);
      hudCtx.strokeStyle = "white"; hudCtx.strokeRect(100, 40, hudCanvas.width - 200, 15);
      hudCtx.fillStyle = "white"; hudCtx.font = "bold 12px Orbitron";
      hudCtx.fillText("MOTHERSHIP INTEGRITY", 100, 35);
  }
  
  // V94.2 CONTINUE HUD RESTORATION
  if (isContinueMenu) {
      hudCtx.fillStyle = "rgba(0,0,0,0.8)"; hudCtx.fillRect(0,0,hudCanvas.width, hudCanvas.height);
      hudCtx.fillStyle = "#ff0000"; hudCtx.font = "bold 80px Orbitron"; hudCtx.textAlign = "center";
      hudCtx.fillText("CONTINUE?", hudCanvas.width/2, hudCanvas.height/2 - 50);
      hudCtx.fillStyle = "white"; hudCtx.font = "bold 120px Orbitron";
      hudCtx.fillText(Math.ceil(continueTimer), hudCanvas.width/2, hudCanvas.height/2 + 80);
      hudCtx.font = "bold 30px Orbitron";
      hudCtx.fillText("[C] CONTINUE   [E] RETIRED", hudCanvas.width/2, hudCanvas.height/2 + 160);
      hudCtx.textAlign = "left";
  }

  // V93 NEUTRALIZED BANNER
  if (!bossActive && hitStopTimer > 0) {
      hudCtx.fillStyle = "#ffffff"; hudCtx.font = "bold 80px Orbitron"; hudCtx.textAlign = "center";
      hudCtx.shadowBlur = 20; hudCtx.shadowColor = "#00ffff";
      hudCtx.fillText("NEUTRALIZED", hudCanvas.width/2, hudCanvas.height/2);
      hudCtx.shadowBlur = 0; hudCtx.textAlign = "left";
  }
}

function handlePlayerHit() {
    // V76 ABSOLUTE PRIORITY CHECK
    if (window.respawnShieldTimer > 0) {
        console.warn("🛡️ SHIELD BLOCKED HIT | REMAINING: " + window.respawnShieldTimer.toFixed(2));
        return;
    }

    if (isContinueMenu || isGameOver) return; // SAFETY LOCK V66.3
    
    // V74 GLOBAL COOLDOWN (1 SECOND)
    if (Date.now() - lastHitTime < 1000) return;
    lastHitTime = Date.now();
    
    console.warn("⚠️ DAMAGE TAKEN! | LIVES: " + lives + " | ARMOR: " + shield);
    hitStopTimer = 0.1; // V77 HIT STOP FRAME

    shield--;
    if (shield <= 0) {
        lives--;
        playExplosionSound();
        if (lives <= 0) {
            isContinueMenu = true; continueTimer = 9.9; // START COUNTDOWN V64
            // CLEAR SCREEN FOR CONTINUE V66.3
            enemyBullets.forEach(b => scene.remove(b.mesh)); enemyBullets = [];
            physicsMeshes.forEach(p => { if (p.type === 'enemy') { scene.remove(p.mesh); world.removeBody(p.body); p.toDelete = true; } });
        } else {
            shield = 3; weaponLevel = 1; // RESET WEAPON ON LIFE LOSS V69
            playerBody.position.set(0, 5, 50);
            window.respawnShieldTimer = 3.0; // RESET GUARDIAN SHIELD V74
        }
    } else {
        playArmorCrunchSound(); // NEW IMPACT SOUND V65
        shakeAmount = 10; // CAMERA STUN V65
    }
}

function spawnPowerup(pos, type) {
    const group = new THREE.Group();
    // V89 CRYSTALLINE DIAMOND CORE
    const coreGeo = new THREE.OctahedronGeometry(8);
    const col = type === 'shield' ? 0x00ffff : 0xffff00;
    const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({ 
        color: col, emissive: col, emissiveIntensity: 2.0, metalness: 1.0, roughness: 0 
    }));
    group.add(core);

    const glassGeo = new THREE.SphereGeometry(12, 8, 8);
    const glass = new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({ 
        color: 0xffffff, transparent: true, opacity: 0.3, wireframe: true 
    }));
    group.add(glass);

    group.position.copy(pos); scene.add(group);
    powerups.push({ mesh: group, type });
}

function spawnMothership() {
    bossActive = true; bossHealth = 5000 + currentLevel * 1000; // V88 DREADNOUGHT BUFF
    const g = new THREE.Group();
    // V86 HOLOGRAPHIC HULL (TRANSPARENT SILVER)
    const silverMat = new THREE.MeshStandardMaterial({ 
        color: 0x999999, metalness: 0.9, transparent: true, opacity: 0.7, emissive: 0x000000 
    });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.95 });

    // --- TRUE ANDOR GENESIS (OCTAGONAL PLATE) V66 ---
    const plateGeo = new THREE.CylinderGeometry(150, 150, 20, 8); // OCTAGON
    const hull = new THREE.Mesh(plateGeo, silverMat);
    g.add(hull);

    // --- 8 TARGETABLE ENERGY CORES V88 ---
    for (let i = 0; i < 8; i++) {
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(20), coreMat);
        const angle = (i / 8) * Math.PI * 2;
        core.position.set(Math.cos(angle) * 120, 10, Math.sin(angle) * 120);
        g.add(core);
    }
    
    const centerCore = new THREE.Mesh(new THREE.IcosahedronGeometry(40), coreMat);
    centerCore.position.set(0, 20, 0); g.add(centerCore);

    // V84/V94.7 CHIBI-SCALE REMOTE POSITIONING
    g.position.set(0, 150, -1200); 
    const bScale = isTouch ? 2.1 : 3.0; // V94.7 MOBILE BOSS SCALE (30% REDUCTION)
    g.scale.setScalar(bScale); scene.add(g);
    const pBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(450, 40, 450)) }); // KINEMATIC V84
    pBody.position.copy(g.position); world.addBody(pBody);
    physicsMeshes.push({ mesh: g, body: pBody, type: 'boss' });
    bossMesh = g;
}

// --- V88 CINEMATIC DESTRUCTION ---
function detonateMothership(mesh) {
    playBossVictorySound();
    timeDilation = 0.3; // BULLET TIME V88
    shakeAmount = 50; 
    
    let count = 0;
    const interval = setInterval(() => {
        const p = new THREE.Vector3(
            mesh.position.x + (Math.random() - 0.5) * 400,
            mesh.position.y + (Math.random() - 0.5) * 100,
            mesh.position.z + (Math.random() - 0.5) * 400
        );
        createExplosion(p, 0xffaa00, 70);
        playExplosionSound();
        count++;
        if (count > 25) {
            clearInterval(interval);
            scene.remove(mesh);
            bossMesh = null; // V94.7 CLEAR REFERENCE
            timeDilation = 1.0;
            shakeAmount = 0;
            bossActive = false; // V89 CLEAR HUD IMMEDIATELY
            // CELEBRATION BANNER
            floatingTexts.push({ text: "NEUTRALIZED", x: 0, y: 150, z: -100, life: 3.0 });
        }
    }, 150);
}

function triggerGameOver(reason) {
  isGameOver = true; gameStarted = false; stopAllAudio();
  if (controls) controls.unlock();
  document.exitPointerLock();
  
  const go = document.getElementById('game-over');
  const mobileUI = document.getElementById('mobile-decision-ui');
  const desktopHint = document.getElementById('desktop-decision-hint');

  if (go) {
    go.style.display = 'flex';
    if (isTouch && mobileUI) {
        mobileUI.style.display = 'flex';
        if (desktopHint) desktopHint.style.display = 'none';
    }
    const fs = document.getElementById('final-stats');
    if (fs) fs.innerHTML = `<h3 style="color:#0ff">${reason}</h3><h4>STAGE REACHED: ${currentLevel}</h4>`;
  }
}

function handleContinue() {
    isGameOver = false; lives = 3; shield = 3; score = 0; weaponLevel = 1; // RESET PENALTY V71
    playerBody.position.set(0, 5, 50);
    const go = document.getElementById('game-over');
    if (go) go.style.display = 'none';
    window.respawnShieldTimer = 3.0; // 3S INVULNERABILITY
}

function handleExit() {
    location.reload();
}

// BIND TO WINDOW FOR BUTTONS V71
window.handleContinue = handleContinue;
window.handleExit = handleExit;

function detonateBomb() {
  if (bombCharge < 100 || isGameOver || !gameStarted) return; // V89 ION LOCK
  bombCharge = 0; // RESET CHARGE
  // --- NUCLEAR NOVA BOMB FX V66 ---
  const nuclearGeo = new THREE.SphereGeometry(1, 32, 32);
  const nuclearMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, emissive: 0xffaa00, emissiveIntensity: 10 });
  const nuke = new THREE.Mesh(nuclearGeo, nuclearMat);
  nuke.position.copy(weaponGroup.position);
  scene.add(nuke); activeNukes.push({ mesh: nuke, scale: 1, lifespan: 1.0 });

  // TACTICAL CLEAR V66
  enemyBullets.forEach(b => {
      if (b.mesh.position.distanceTo(weaponGroup.position) < 200) { scene.remove(b.mesh); b.toDelete = true; }
  });
  physicsMeshes.forEach(p => {
      if (p.mesh.position.distanceTo(weaponGroup.position) < 200) {
          if (p.type === 'enemy') {
              scene.remove(p.mesh); world.removeBody(p.body); p.toDelete = true; 
              enemiesKilled++; score += 100;
          }
          if (p.type === 'boss' && bossActive) {
              bossHealth -= 2000; // BOMB MASSIVE REDUCTION V92
              if (bossHealth <= 0) {
                  bossActive = false; detonateMothership(p.mesh);
                  playVictoryMelody(); hitStopTimer = 3.0;
                  scene.remove(p.mesh); world.removeBody(p.body); p.toDelete = true;
              }
          }
          playExplosionSound();
      }
  });

  explosionTimer = 0.2; shakeAmount = 25; // MASSIVE IMPACT
  playArcadeSFX('ion_detonation', 0.5);
}

try {
  initUI(); initEngine();
  playerBody = new CANNON.Body({ mass: 5, shape: new CANNON.Sphere(1) });
  playerBody.position.set(0, 5, 50); // CENTER-BOTTOM FRUSTUM ALIGNMENT V60.5
  world.addBody(playerBody);
  try { controls.lock(); } catch(e) { console.error("Lock Fail:", e); }
  animate();
} catch (err) { 
  console.error("??ENGINE ERROR:", err); 
}

// --- GLOBAL UNLOCK V70.1 REPAIR ---
window.fireLaser = fireLaser;
window.detonateBomb = detonateBomb;
window.startGame = startGame;
window.handleContinue = () => {
    isContinueMenu = false; lives = 3; shield = 3; score = 0; // PENALTY RESET V64.4 (MOBILE)
    if (playerBody) playerBody.position.set(0, 5, 50); 
    const mobCont = document.getElementById('mobile-continue-ui');
    if (mobCont) mobCont.style.display = 'none';
};
window.handleExit = () => {
    location.reload();
};
console.log("🚀 BOOT: V95.4 ONLINE - MOBILE-LOCK COCKPIT");
