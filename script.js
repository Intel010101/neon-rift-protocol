const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('scoreValue');
const energyEl = document.getElementById('energyValue');
const comboEl = document.getElementById('comboValue');
const runLevelEl = document.getElementById('runLevel');
const bestScoreEl = document.getElementById('bestScore');
const statusEl = document.getElementById('statusMessage');
const shardEl = document.getElementById('shardValue');
const upgradePanel = document.getElementById('upgradePanel');
const upgradeToggle = document.getElementById('upgradeToggle');
const closePanelBtn = document.getElementById('closePanel');
const upgradeCards = document.getElementById('upgradeCards');
const achievementList = document.getElementById('achievementList');
const mobileHint = document.getElementById('mobileHint');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnDash = document.getElementById('btnDash');

const LANES = 3;
const COLORS = {
  bg: '#05060b',
  lane: 'rgba(255,255,255,0.08)',
  player: '#36f5ff',
  playerGlow: '#7cffe6',
  obstacle: '#ff4dd8',
  shard: '#ffe45c',
  drone: '#7b8eff'
};

const profileKey = 'neon-rift-profile-v1';
const defaultProfile = {
  shards: 0,
  bestScore: 0,
  upgrades: {
    thrust: 0,
    focus: 0,
    magnet: 0,
    shield: 0,
    flux: 0
  },
  achievements: {}
};

const deepClone = typeof structuredClone === 'function'
  ? structuredClone
  : (obj) => JSON.parse(JSON.stringify(obj));

let profile = loadProfile();

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  running: false,
  lastTime: 0,
  spawnTimer: 0,
  shardTimer: 0,
  droneTimer: 0,
  baseSpeed: 260,
  player: {
    lane: 1,
    targetLane: 1,
    x: 0,
    y: 0,
    radius: 22,
    dash: 0,
    shieldTimer: 0
  },
  score: 0,
  energy: 100,
  combo: 1,
  comboDecay: 0,
  level: 1,
  obstacles: [],
  shards: [],
  drones: [],
  difficulty: 0,
  runShards: 0,
  runDistance: 0,
  burstMode: false,
  spawnBias: 0.4
};

const upgradeCatalog = {
  thrust: {
    title: 'Ion Thrust',
    description: lvl => `Boost top speed by ${(lvl + 1) * 6}% per rank.`,
    baseCost: 50,
    scale: 1.7,
    max: 7
  },
  focus: {
    title: 'Focus Lattice',
    description: lvl => `Combo decay slows ${(lvl + 1) * 12}% each rank.`,
    baseCost: 80,
    scale: 1.8,
    max: 5
  },
  magnet: {
    title: 'Shard Magnetics',
    description: lvl => `Shard pickup radius +${(lvl + 1) * 4}px per rank.`,
    baseCost: 65,
    scale: 1.65,
    max: 6
  },
  shield: {
    title: 'Phase Shield',
    description: lvl => `Begin runs with ${(lvl + 1)}s immunity.`,
    baseCost: 120,
    scale: 2.05,
    max: 4
  },
  flux: {
    title: 'Flux Engine',
    description: lvl => `Dash cooldown reduced ${(lvl + 1) * 10}% each rank.`,
    baseCost: 90,
    scale: 1.75,
    max: 6
  }
};

const achievements = [
  { key: 'firstRun', label: 'Boot Sequence', condition: () => state.runDistance > 200 },
  { key: 'shard10', label: 'Pocket Miner', condition: () => state.runShards >= 10 },
  { key: 'combo4', label: 'Combo Reactor', condition: () => state.combo >= 4 },
  { key: 'droneDodger', label: 'Drone Whisperer', condition: () => state.score >= 2400 },
  { key: 'burst', label: 'Overclocked', condition: () => state.burstMode },
  { key: 'perfect', label: 'Untouchable', condition: () => state.score >= 5000 && state.energy === 100 }
];

function loadProfile() {
  try {
    const raw = localStorage.getItem(profileKey);
    if (!raw) return deepClone(defaultProfile);
    const parsed = JSON.parse(raw);
    return {
      ...deepClone(defaultProfile),
      ...parsed,
      upgrades: { ...defaultProfile.upgrades, ...parsed.upgrades },
      achievements: parsed.achievements || {}
    };
  } catch (err) {
    console.warn('Profile load failed', err);
    return deepClone(defaultProfile);
  }
}

function saveProfile() {
  localStorage.setItem(profileKey, JSON.stringify(profile));
}

function updateMeta() {
  bestScoreEl.textContent = Math.round(profile.bestScore).toLocaleString();
  shardEl.textContent = profile.shards;
  renderAchievements();
  renderUpgrades();
}

function formatPercent(value) {
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
}

function resize() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = state.width * window.devicePixelRatio;
  canvas.height = state.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

resize();
window.addEventListener('resize', resize);

function resetRun() {
  state.running = true;
  state.lastTime = performance.now();
  state.spawnTimer = 0;
  state.shardTimer = 0;
  state.droneTimer = 0;
  state.score = 0;
  state.energy = 100;
  state.combo = 1;
  state.comboDecay = 0;
  state.level = 1;
  state.difficulty = 0;
  state.obstacles = [];
  state.shards = [];
  state.drones = [];
  state.runShards = 0;
  state.runDistance = 0;
  state.burstMode = false;
  state.player.dash = 0;
  state.player.lane = 1;
  state.player.targetLane = 1;
  state.player.shieldTimer = profile.upgrades.shield * 1000;
  statusEl.textContent = 'RUNNING — survive the rift';
}

function endRun() {
  state.running = false;
  statusEl.textContent = 'Impact detected. Tap to rerun.';
  profile.shards += Math.round(state.runShards * (1 + state.combo * 0.1));
  if (state.score > profile.bestScore) {
    profile.bestScore = state.score;
    statusEl.textContent = 'New record! Tap anywhere to dive again.';
  }
  saveProfile();
  updateMeta();
}

function laneX(lane) {
  const spacing = state.width / (LANES + 1);
  return spacing * (lane + 1);
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * LANES);
  const size = 32 + Math.random() * 32 + state.difficulty * 2;
  state.obstacles.push({
    lane,
    x: state.width + size,
    size,
    speed: state.baseSpeed + state.difficulty * 15 + profile.upgrades.thrust * 12,
    wobble: Math.random() * Math.PI * 2
  });
}

function spawnShard() {
  const lane = Math.floor(Math.random() * LANES);
  state.shards.push({
    lane,
    x: state.width + 10,
    yOffset: (Math.random() - 0.5) * 20,
    collected: false,
    drift: Math.random() * Math.PI * 2
  });
}

function spawnDrone() {
  const lane = Math.floor(Math.random() * LANES);
  state.drones.push({
    lane,
    x: state.width + 80,
    y: Math.random() * state.height * 0.4 + state.height * 0.3,
    timer: 0,
    frequency: 0.0015 + Math.random() * 0.001,
    amplitude: 45 + Math.random() * 55
  });
}

function update(delta) {
  if (!state.running) return;
  state.spawnTimer += delta;
  state.shardTimer += delta;
  state.droneTimer += delta;
  const spawnInterval = Math.max(450 - state.difficulty * 12, 180);
  const shardInterval = Math.max(600 - state.difficulty * 10, 200);
  const droneInterval = 4000 - Math.min(state.difficulty * 40, 2500);

  if (state.spawnTimer > spawnInterval) {
    spawnObstacle();
    state.spawnTimer = 0;
  }
  if (state.shardTimer > shardInterval) {
    spawnShard();
    state.shardTimer = 0;
  }
  if (state.droneTimer > droneInterval) {
    spawnDrone();
    state.droneTimer = 0;
  }

  const laneXPos = laneX(state.player.lane);
  state.player.x += (laneX(state.player.targetLane) - laneXPos) * 0.12;
  state.player.y = state.height * 0.75;
  if (state.player.dash > 0) state.player.dash -= delta;
  if (state.player.shieldTimer > 0) state.player.shieldTimer -= delta;

  const travelSpeed = (state.baseSpeed + state.difficulty * 6 + profile.upgrades.thrust * 18) * (state.burstMode ? 1.25 : 1);
  state.runDistance += travelSpeed * (delta / 1000);
  state.score = Math.round(state.runDistance + state.runShards * 25 * state.combo);

  state.energy = Math.max(0, Math.min(100, state.energy - 0.01 * delta + state.combo * 0.003 * delta));
  if (state.energy <= 10 && !state.burstMode) {
    statusEl.textContent = 'Energy critical — grab shards!';
  }
  if (state.energy >= 90 && !state.burstMode) {
    state.burstMode = true;
    statusEl.textContent = 'Flux burst! everything speeds up.';
  }
  if (state.energy < 30 && state.burstMode) {
    state.burstMode = false;
    statusEl.textContent = 'Stabilized. Keep weaving.';
  }

  state.comboDecay += delta;
  const decayDelay = 2200 + profile.upgrades.focus * 420;
  if (state.comboDecay > decayDelay && state.combo > 1) {
    state.combo -= 0.01 * delta / 16;
    state.combo = Math.max(1, state.combo);
  }

  const magnetRadius = 40 + profile.upgrades.magnet * 8;

  state.obstacles.forEach(ob => {
    ob.x -= (ob.speed + state.difficulty * 3) * (delta / 1000);
    ob.wobble += delta * 0.003;
  });
  state.shards.forEach(sh => {
    const targetY = state.height * 0.5 + sh.yOffset;
    sh.drift += delta * 0.004;
    sh.y = targetY + Math.sin(sh.drift) * 14;
    sh.x -= (travelSpeed * 0.8) * (delta / 1000);
    const dx = laneX(state.player.lane) - sh.x;
    const dy = state.player.y - sh.y;
    const dist = Math.hypot(dx, dy);
    if (!sh.collected && dist < state.player.radius + magnetRadius) {
      collectShard(sh);
    }
  });
  state.drones.forEach(dr => {
    dr.x -= travelSpeed * 0.7 * (delta / 1000);
    dr.timer += delta;
    dr.y += Math.sin(dr.timer * dr.frequency) * (dr.amplitude * delta / 1000);
  });

  state.obstacles = state.obstacles.filter(ob => ob.x > -ob.size * 2);
  state.shards = state.shards.filter(sh => !sh.collected && sh.x > -20);
  state.drones = state.drones.filter(dr => dr.x > -120);

  detectCollisions();
  escalateDifficulty(delta);
  updateHud();
  checkAchievements();
}

function detectCollisions() {
  const px = laneX(state.player.lane);
  const py = state.player.y;

  for (const ob of state.obstacles) {
    if (ob.lane !== state.player.lane) continue;
    const dist = Math.abs(ob.x - px);
    if (dist < ob.size * 0.5 + state.player.radius) {
      if (state.player.dash > 0 || state.player.shieldTimer > 0) {
        state.energy = Math.min(100, state.energy + 12);
        state.combo += 0.5;
        ob.x = -999;
      } else {
        endRun();
      }
      return;
    }
  }

  for (const dr of state.drones) {
    const dist = Math.hypot(dr.x - px, dr.y - py);
    if (dist < 40) {
      if (state.player.dash > 0 || state.player.shieldTimer > 0) {
        state.energy = Math.min(100, state.energy + 8);
        dr.x = -999;
      } else {
        state.energy -= 25;
        if (state.energy <= 0) endRun();
      }
      return;
    }
  }
}

function collectShard(shard) {
  shard.collected = true;
  const reward = 1 + state.combo * 0.2;
  state.runShards += reward;
  state.combo += 0.15;
  state.combo = Math.min(state.combo, 9);
  state.energy = Math.min(110, state.energy + 4);
  state.comboDecay = 0;
}

function escalateDifficulty(delta) {
  state.difficulty += delta * 0.0045;
  state.level = Math.min(10, 1 + Math.floor(state.difficulty / 4));
}

function updateHud() {
  scoreEl.textContent = Math.round(state.score).toLocaleString();
  energyEl.textContent = formatPercent(state.energy);
  comboEl.textContent = `x${state.combo.toFixed(1)}`;
  runLevelEl.textContent = state.level;
}

function render(delta) {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = 'rgba(8, 10, 22, 0.6)';
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.strokeStyle = COLORS.lane;
  ctx.lineWidth = 2;
  const spacing = state.width / (LANES + 1);
  for (let i = 1; i <= LANES; i++) {
    const x = spacing * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.height);
    ctx.stroke();
  }

  ctx.fillStyle = COLORS.shard;
  state.shards.forEach(sh => {
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, 9, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = COLORS.obstacle;
  state.obstacles.forEach(ob => {
    ctx.save();
    ctx.translate(ob.x, state.height * 0.75);
    ctx.rotate(Math.sin(ob.wobble) * 0.3);
    ctx.fillRect(-ob.size / 2, -ob.size / 2, ob.size, ob.size);
    ctx.restore();
  });

  ctx.strokeStyle = COLORS.drone;
  ctx.lineWidth = 3;
  state.drones.forEach(dr => {
    ctx.beginPath();
    ctx.arc(dr.x, dr.y, 24, 0, Math.PI * 2);
    ctx.stroke();
  });

  const px = laneX(state.player.lane);
  const py = state.height * 0.75;
  ctx.fillStyle = COLORS.player;
  ctx.shadowColor = state.burstMode ? COLORS.playerGlow : '#36f5ff22';
  ctx.shadowBlur = state.burstMode ? 30 : 10;
  ctx.beginPath();
  ctx.arc(px, py, state.player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (!state.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, state.width, state.height);
  }
}

function step(timestamp) {
  const delta = timestamp - state.lastTime;
  state.lastTime = timestamp;
  update(delta);
  render(delta);
  requestAnimationFrame(step);
}

requestAnimationFrame(ts => {
  state.lastTime = ts;
  step(ts);
});

function changeLane(direction) {
  if (!state.running) resetRun();
  state.player.targetLane = Math.max(0, Math.min(LANES - 1, state.player.targetLane + direction));
}

function dash() {
  if (!state.running) {
    resetRun();
    return;
  }
  const cooldown = 1200 - profile.upgrades.flux * 120;
  if (state.player.dash <= 0) {
    state.player.dash = cooldown;
    state.combo += 0.2;
    state.energy = Math.max(0, state.energy - 6);
    statusEl.textContent = 'Pulse dash engaged.';
  }
}

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') changeLane(-1);
  if (e.key === 'ArrowRight' || e.key === 'd') changeLane(1);
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
    e.preventDefault();
    dash();
  }
});

canvas.addEventListener('pointerdown', e => {
  const x = e.clientX;
  if (x < state.width * 0.33) changeLane(-1);
  else if (x > state.width * 0.66) changeLane(1);
  else dash();
});

btnLeft.addEventListener('click', () => changeLane(-1));
btnRight.addEventListener('click', () => changeLane(1));
btnDash.addEventListener('click', dash);

let touchStartX = null;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
});
canvas.addEventListener('touchend', e => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) < 30) dash();
  else if (dx < 0) changeLane(-1);
  else changeLane(1);
  touchStartX = null;
});

upgradeToggle.addEventListener('click', () => upgradePanel.classList.toggle('hidden'));
closePanelBtn.addEventListener('click', () => upgradePanel.classList.add('hidden'));

function renderUpgrades() {
  upgradeCards.innerHTML = '';
  Object.entries(upgradeCatalog).forEach(([key, meta]) => {
    const level = profile.upgrades[key];
    const cost = Math.round(meta.baseCost * Math.pow(meta.scale, level));
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <h4>${meta.title} (Lv ${level})</h4>
      <p>${meta.description(level)}</p>
    `;
    const button = document.createElement('button');
    button.textContent = level >= meta.max ? 'Maxed' : `Upgrade — ${cost} shards`;
    button.disabled = level >= meta.max || profile.shards < cost;
    button.addEventListener('click', () => buyUpgrade(key, cost));
    card.appendChild(button);
    upgradeCards.appendChild(card);
  });
  shardEl.textContent = profile.shards;
}

function buyUpgrade(key, cost) {
  const meta = upgradeCatalog[key];
  const level = profile.upgrades[key];
  if (level >= meta.max || profile.shards < cost) return;
  profile.shards -= cost;
  profile.upgrades[key] += 1;
  saveProfile();
  renderUpgrades();
  statusEl.textContent = `${meta.title} upgraded to Lv ${profile.upgrades[key]}`;
}

function renderAchievements() {
  achievementList.innerHTML = '';
  achievements.forEach(entry => {
    const li = document.createElement('li');
    const unlocked = profile.achievements[entry.key];
    li.textContent = unlocked ? `✔ ${entry.label}` : `○ ${entry.label}`;
    achievementList.appendChild(li);
  });
}

function checkAchievements() {
  achievements.forEach(entry => {
    if (profile.achievements[entry.key]) return;
    if (entry.condition()) {
      profile.achievements[entry.key] = true;
      statusEl.textContent = `Feat unlocked: ${entry.label}`;
      saveProfile();
      renderAchievements();
    }
  });
}

updateMeta();
setTimeout(() => mobileHint.remove(), 5000);
