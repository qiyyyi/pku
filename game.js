const canvas = document.getElementById('gameCanvas');
const gameStage = document.getElementById('gameStage');
const ctx = canvas.getContext('2d');

// 游戏逻辑仍使用固定坐标；画布按设备像素比高分辨率渲染，放大后也保持清晰。
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 360;
const IS_COARSE_POINTER = window.matchMedia('(pointer: coarse)').matches;
const RENDER_SCALE = IS_COARSE_POINTER ? Math.min(1.5, window.devicePixelRatio || 1) : Math.max(2, Math.min(3, window.devicePixelRatio || 1));
canvas.width = Math.round(VIEW_WIDTH * RENDER_SCALE);
canvas.height = Math.round(VIEW_HEIGHT * RENDER_SCALE);
ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);

const GOAL_KM = 7399;
const GROUND_Y = VIEW_HEIGHT - 70;
const PLAYER_W = 32;
const PLAYER_H = 32;
const GRAVITY = 1800;
const JUMP_FORCE = 620;

let state = 'ready';
let lastTime = 0;
let distance = 0;
let score = 0;
let coins = 0;
let worldSpeed = 320;
let backgroundOffset = 0;
let obstacleTimer = 0.7;
let coinTimer = 0.9;

let obstacles = [];
let coinsList = [];
let skyImage = null;
let mountainImage = null;
let backgroundCharacterImage = null;
let mountainContour = [];
let backgroundRunners = [];
let cloudLayer = [];
let treeFrames = [];
let treeSprites = [];
let treeAnimationTimer = 0;
let treeFrameIndex = 0;
let grassFrames = [];
let grassSprites = [];
let grassAnimationTimer = 0;
let grassFrameIndex = 0;
let shortTreeFrames = [];
let shortTreeSprites = [];
let shortTreeAnimationTimer = 0;
let shortTreeFrameIndex = 0;
let bushFrames = [];
let bushSprites = [];
let bushAnimationTimer = 0;
let bushFrameIndex = 0;
let endingPhase = 'approach';
let endingTimer = 0;
let victoryFrame = 0;
let victoryFrameTimer = 0;
let failurePhase = 'animate';
let failureTimer = 0;
let failureFrame = 0;
let audioContext = null;
let backgroundMusicTimer = null;
let backgroundMusicStep = 0;

const obstacleSprites = [
  {
    image: new Image(),
    bounds: { x: 192, y: 704, width: 1599, height: 1343 },
    height: 46,
  },
  {
    image: new Image(),
    bounds: { x: 128, y: 832, width: 1919, height: 1215 },
    height: 42,
  },
  {
    image: new Image(),
    bounds: { x: 128, y: 384, width: 1535, height: 1599 },
    height: 52,
  },
];

const failureSprites = {
  player: {
    frames: [new Image(), new Image()],
    bounds: [
      { x: 0, y: 192, width: 1981, height: 1789 },
      { x: 0, y: 192, width: 1981, height: 1789 },
    ],
  },
  npc: {
    frames: [new Image(), new Image()],
    bounds: [
      { x: 64, y: 192, width: 1853, height: 1725 },
      { x: 64, y: 256, width: 1917, height: 1661 },
    ],
  },
};

const victorySprites = {
  frames: [new Image(), new Image()],
  // 胜利图为 2048x1228，裁去外围透明区域后再放大显示。
  bounds: { x: 192, y: 128, width: 1697, height: 973 },
};

const characterSprites = {
  player: {
    run: [new Image(), new Image()],
    jump: new Image(),
    // 去除 2048x2048 源图周围的透明留白，防止动画切换时角色抖动。
    bounds: [
      { x: 128, y: 128, width: 1853, height: 1725 },
      { x: 0, y: 192, width: 1981, height: 1661 },
    ],
    jumpBounds: { x: 192, y: 128, width: 1789, height: 1661 },
  },
  npc: {
    run: [new Image(), new Image()],
    jump: new Image(),
    bounds: [
      { x: 128, y: 192, width: 1853, height: 1725 },
      { x: 0, y: 192, width: 1981, height: 1725 },
    ],
    jumpBounds: { x: 192, y: 64, width: 1789, height: 1725 },
  },
};

const player = {
  x: 220,
  y: GROUND_Y - PLAYER_H,
  width: PLAYER_W,
  height: PLAYER_H,
  vy: 0,
  grounded: true,
  spriteFrame: 0,
  spriteTimer: 0,
  spriteState: 'run',
};

const npc = {
  // 佐助保持在右侧，鸣人通过跳跃追逐他。
  x: 700,
  y: GROUND_Y - PLAYER_H,
  width: PLAYER_W,
  height: PLAYER_H,
  vy: 0,
  grounded: true,
  spriteFrame: 0,
  spriteTimer: 0,
  spriteState: 'run',
};

function loadBackgroundAssets() {
  skyImage = new Image();
  skyImage.src = 'images/天空.png';

  mountainImage = new Image();
  mountainImage.src = 'images/山.png';
  mountainImage.onload = () => {
    computeMountainContour();
  };
  if (mountainImage.complete) {
    computeMountainContour();
  }

  backgroundCharacterImage = new Image();
  backgroundCharacterImage.src = 'images/鸣佐.png';

  characterSprites.player.run[0].src = 'images/鸣喵1.png';
  characterSprites.player.run[1].src = 'images/鸣喵2.png';
  characterSprites.player.jump.src = 'images/鸣喵跳.png';
  characterSprites.npc.run[0].src = 'images/佐喵1.png';
  characterSprites.npc.run[1].src = 'images/佐喵2.png';
  characterSprites.npc.jump.src = 'images/佐喵跳.png';
  victorySprites.frames[0].src = 'images/胜利1.png';
  victorySprites.frames[1].src = 'images/胜利2.png';
  failureSprites.player.frames[0].src = 'images/失败鸣1.png';
  failureSprites.player.frames[1].src = 'images/失败鸣2.png';
  failureSprites.npc.frames[0].src = 'images/失败佐1.png';
  failureSprites.npc.frames[1].src = 'images/失败佐2.png';
  obstacleSprites[0].image.src = 'images/障碍1.png';
  obstacleSprites[1].image.src = 'images/障碍2.png';
  obstacleSprites[2].image.src = 'images/障碍3.png';

  treeFrames = [
    new Image(), new Image(), new Image()
  ];
  treeFrames[0].src = 'images/树1.png';
  treeFrames[1].src = 'images/树2.png';
  treeFrames[2].src = 'images/树3.png';

  // 所有图片树共用树1/树2/树3动画帧，并以不同尺寸和间距循环铺满场景。
  treeSprites = [
    { x: 35, height: 128, speed: 0.12, phase: 0 },
    { x: 165, height: 148, speed: 0.14, phase: 1 },
    { x: 305, height: 122, speed: 0.11, phase: 2 },
    { x: 440, height: 158, speed: 0.14, phase: 0 },
    { x: 585, height: 134, speed: 0.12, phase: 2 },
    { x: 725, height: 151, speed: 0.13, phase: 1 },
    { x: 865, height: 126, speed: 0.12, phase: 0 },
    { x: 1000, height: 156, speed: 0.15, phase: 2 },
    { x: 1140, height: 138, speed: 0.13, phase: 1 }
  ];

  grassFrames = [new Image(), new Image(), new Image()];
  grassFrames[0].src = 'images/草1.png';
  grassFrames[1].src = 'images/草2.png';
  grassFrames[2].src = 'images/草3.png';

  // 草丛使用错落尺寸和间距，移动速度略快于树，形成前景层次。
  grassSprites = [
    { x: 30, height: 42, speed: 0.22 },
    { x: 145, height: 34, speed: 0.20 },
    { x: 285, height: 46, speed: 0.23 },
    { x: 430, height: 36, speed: 0.21 },
    { x: 575, height: 43, speed: 0.22 },
    { x: 725, height: 32, speed: 0.20 },
    { x: 850, height: 45, speed: 0.23 },
    { x: 1010, height: 37, speed: 0.21 }
  ];

  shortTreeFrames = [new Image(), new Image()];
  shortTreeFrames[0].src = 'images/矮树1.png';
  shortTreeFrames[1].src = 'images/矮树2.png';
  shortTreeSprites = [
    { x: 95, height: 92, speed: 0.16, phase: 0 },
    { x: 265, height: 80, speed: 0.15, phase: 1 },
    { x: 430, height: 101, speed: 0.17, phase: 0 },
    { x: 600, height: 85, speed: 0.16, phase: 1 },
    { x: 765, height: 98, speed: 0.17, phase: 0 },
    { x: 930, height: 83, speed: 0.15, phase: 1 },
    { x: 1095, height: 94, speed: 0.16, phase: 0 }
  ];

  bushFrames = [new Image(), new Image()];
  bushFrames[0].src = 'images/灌木1.png';
  bushFrames[1].src = 'images/灌木2.png';
  bushSprites = [
    { x: 45, height: 62, speed: 0.20, phase: 0 },
    { x: 175, height: 55, speed: 0.19, phase: 1 },
    { x: 310, height: 67, speed: 0.21, phase: 0 },
    { x: 445, height: 58, speed: 0.20, phase: 1 },
    { x: 580, height: 65, speed: 0.21, phase: 0 },
    { x: 715, height: 54, speed: 0.19, phase: 1 },
    { x: 850, height: 66, speed: 0.20, phase: 0 },
    { x: 985, height: 57, speed: 0.21, phase: 1 },
    { x: 1120, height: 63, speed: 0.20, phase: 0 }
  ];

  cloudLayer = [
    { baseX: 140, y: 82, scale: 0.92, speed: 0.16 },
    { baseX: 320, y: 118, scale: 0.76, speed: 0.11 },
    { baseX: 520, y: 92, scale: 0.88, speed: 0.14 },
    { baseX: 730, y: 136, scale: 0.70, speed: 0.10 },
    { baseX: 900, y: 72, scale: 0.82, speed: 0.13 },
    { baseX: 1040, y: 100, scale: 0.74, speed: 0.12 },
  ];

  backgroundRunners = [
    { progress: 0.22, speed: 0.12, scale: 0.95 },
    { progress: 0.62, speed: 0.16, scale: 0.88 },
  ];
}

function computeMountainContour() {
  if (!mountainImage || !mountainImage.width) {
    return;
  }

  const width = mountainImage.naturalWidth || mountainImage.width;
  const height = mountainImage.naturalHeight || mountainImage.height;
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const offCtx = offscreen.getContext('2d');
  offCtx.drawImage(mountainImage, 0, 0, width, height);

  const data = offCtx.getImageData(0, 0, width, height).data;
  const contour = [];

  for (let x = 0; x < width; x += 2) {
    let y = 0;
    while (y < height) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 20) {
        break;
      }
      y += 1;
    }

    contour.push(y < height ? y : height);
  }

  mountainContour = contour;
}

function loopValue(value, size) {
  return ((value % size) + size) % size;
}

function resetGame() {
  state = 'playing';
  lastTime = performance.now();
  distance = 0;
  score = 0;
  coins = 0;
  worldSpeed = 320;
  backgroundOffset = 0;
  obstacleTimer = 0.7;
  coinTimer = 0.9;
  obstacles = [];
  coinsList = [];
  treeAnimationTimer = 0;
  treeFrameIndex = 0;
  grassAnimationTimer = 0;
  grassFrameIndex = 0;
  shortTreeAnimationTimer = 0;
  shortTreeFrameIndex = 0;
  bushAnimationTimer = 0;
  bushFrameIndex = 0;
  endingPhase = 'approach';
  endingTimer = 0;
  victoryFrame = 0;
  victoryFrameTimer = 0;
  failurePhase = 'animate';
  failureTimer = 0;
  failureFrame = 0;

  Object.assign(player, {
    x: 220,
    y: GROUND_Y - PLAYER_H,
    vy: 0,
    grounded: true,
    spriteFrame: 0,
    spriteTimer: 0,
    spriteState: 'run',
  });

  Object.assign(npc, {
    x: 700,
    y: GROUND_Y - PLAYER_H,
    vy: 0,
    grounded: true,
    spriteFrame: 0,
    spriteTimer: 0,
    spriteState: 'run',
  });
}

function startGame() {
  resetGame();
  setJumpButtonMode('jump');
  startBackgroundMusic();
}

function jumpPlayer() {
  if (state === 'ready' || state === 'failure') {
    startGame();
    return;
  }

  if (state !== 'playing') {
    return;
  }

  if (player.grounded) {
    player.grounded = false;
    player.vy = -JUMP_FORCE;
    player.spriteState = 'jump';
    playJumpSound();
  }
}

function spawnObstacle() {
  const spriteIndex = Math.floor(Math.random() * obstacleSprites.length);
  const sprite = obstacleSprites[spriteIndex];
  const height = sprite.height;
  const width = Math.round(height * (sprite.bounds.width / sprite.bounds.height));
  obstacles.push({ x: VIEW_WIDTH + 40, width, height, spriteIndex });
}

function spawnCoin() {
  coinsList.push({ x: VIEW_WIDTH + 40, y: GROUND_Y - 42, width: 18, height: 18 });
}

function jumpNpc() {
  if (!npc.grounded) {
    return;
  }

  npc.grounded = false;
  npc.vy = -JUMP_FORCE;
  npc.spriteState = 'jump';
}

function beginEnding() {
  state = 'ending';
  setJumpButtonMode('restart');
  stopBackgroundMusic();
  playVictorySound();
  endingPhase = 'approach';
  endingTimer = 0;
  victoryFrame = 0;
  victoryFrameTimer = 0;
  obstacles = [];
  coinsList = [];
  npc.vy = 0;
  npc.y = GROUND_Y - npc.height;
  npc.grounded = true;
  npc.spriteState = 'run';
  npc.spriteFrame = 0;
  player.vy = 0;
  player.y = GROUND_Y - player.height;
  player.grounded = true;
  player.spriteState = 'run';
}

function beginFailure() {
  state = 'failure';
  stopBackgroundMusic();
  playFailureSound();
  failurePhase = 'animate';
  failureTimer = 0;
  failureFrame = 0;
  obstacles = [];
  coinsList = [];
  player.vy = 0;
  player.y = GROUND_Y - player.height;
  player.grounded = true;
  npc.vy = 0;
  npc.y = GROUND_Y - npc.height;
  npc.grounded = true;
}

function updateFailure(dt) {
  failureTimer += dt;

  if (failurePhase === 'animate') {
    failureFrame = failureTimer >= 0.42 ? 1 : 0;
    if (failureTimer >= 0.84) {
      failurePhase = 'message';
      failureTimer = 0;
    }
  }
}

function updateEnding(dt) {
  if (endingPhase === 'approach') {
    const targetX = npc.x - 52;
    player.spriteTimer += dt;
    if (player.spriteTimer >= 0.12) {
      player.spriteTimer = 0;
      player.spriteFrame = player.spriteFrame === 0 ? 1 : 0;
    }

    player.x = Math.min(targetX, player.x + 155 * dt);
    if (player.x >= targetX) {
      endingPhase = 'celebrate';
      endingTimer = 0;
      victoryFrame = 0;
      victoryFrameTimer = 0;
    }
    return;
  }

  endingTimer += dt;
  victoryFrameTimer += dt;
  while (victoryFrameTimer >= 0.34) {
    victoryFrameTimer -= 0.34;
    victoryFrame = (victoryFrame + 1) % victorySprites.frames.length;
  }
}

function update(dt) {
  if (state === 'ending') {
    updateEnding(dt);
    return;
  }

  if (state === 'failure') {
    updateFailure(dt);
    return;
  }

  if (state !== 'playing') {
    return;
  }

  backgroundOffset += worldSpeed * dt * 0.18;
  distance += dt * 150;
  worldSpeed = 320 + Math.min(180, distance / 80);

  if (distance >= GOAL_KM) {
    beginEnding();
    return;
  }

  backgroundRunners.forEach((runner) => {
    runner.progress = (runner.progress + dt * runner.speed) % 1;
  });

  if (treeFrames.length > 0) {
    treeAnimationTimer += dt;
    // 用 while 防止掉帧时跳过动画节奏；取模保证树1→树2→树3→树1循环。
    while (treeAnimationTimer >= 0.25) {
      treeAnimationTimer -= 0.25;
      treeFrameIndex = (treeFrameIndex + 1) % treeFrames.length;
    }
  }

  if (grassFrames.length > 0) {
    grassAnimationTimer += dt;
    while (grassAnimationTimer >= 0.2) {
      grassAnimationTimer -= 0.2;
      grassFrameIndex = (grassFrameIndex + 1) % grassFrames.length;
    }
  }

  if (shortTreeFrames.length > 0) {
    shortTreeAnimationTimer += dt;
    while (shortTreeAnimationTimer >= 0.3) {
      shortTreeAnimationTimer -= 0.3;
      shortTreeFrameIndex = (shortTreeFrameIndex + 1) % shortTreeFrames.length;
    }
  }

  if (bushFrames.length > 0) {
    bushAnimationTimer += dt;
    while (bushAnimationTimer >= 0.24) {
      bushAnimationTimer -= 0.24;
      bushFrameIndex = (bushFrameIndex + 1) % bushFrames.length;
    }
  }

  player.spriteTimer += dt;
  if (player.spriteTimer >= 0.12) {
    player.spriteTimer = 0;
    player.spriteFrame = player.spriteFrame === 0 ? 1 : 0;
  }

  npc.spriteTimer += dt;
  if (npc.spriteTimer >= 0.12) {
    npc.spriteTimer = 0;
    npc.spriteFrame = npc.spriteFrame === 0 ? 1 : 0;
  }

  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  if (player.y + player.height >= GROUND_Y) {
    player.y = GROUND_Y - player.height;
    player.vy = 0;
    player.grounded = true;
    if (player.spriteState !== 'run') {
      player.spriteState = 'run';
      player.spriteFrame = 0;
    }
  }

  // 佐助会观察前方的障碍物，提前起跳，保持在画面右侧继续领跑。
  const npcLookAhead = 135;
  const npcObstacle = obstacles.find((item) =>
    item.x > npc.x - item.width && item.x < npc.x + npc.width + npcLookAhead
  );
  if (npc.grounded && npcObstacle) {
    jumpNpc();
  }

  npc.vy += GRAVITY * dt;
  npc.y += npc.vy * dt;
  if (npc.y + npc.height >= GROUND_Y) {
    npc.y = GROUND_Y - npc.height;
    npc.vy = 0;
    npc.grounded = true;
    if (npc.spriteState !== 'run') {
      npc.spriteState = 'run';
      npc.spriteFrame = 0;
    }
  }

  obstacleTimer -= dt;
  if (obstacleTimer <= 0) {
    spawnObstacle();
    obstacleTimer = 0.8 + Math.random() * 1.1;
  }

  coinTimer -= dt;
  if (coinTimer <= 0) {
    spawnCoin();
    coinTimer = 1.2 + Math.random() * 1.2;
  }

  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    const item = obstacles[i];
    item.x -= worldSpeed * dt;

    if (item.x + item.width < -20) {
      obstacles.splice(i, 1);
      continue;
    }

    const obstacleRect = {
      x: item.x,
      y: GROUND_Y - item.height,
      width: item.width,
      height: item.height,
    };

    if (rectsIntersect(player, obstacleRect)) {
      beginFailure();
      return;
    }

  }

  for (let i = coinsList.length - 1; i >= 0; i -= 1) {
    const item = coinsList[i];
    item.x -= worldSpeed * dt;

    if (item.x + item.width < -20) {
      coinsList.splice(i, 1);
      continue;
    }

    if (rectsIntersect(player, item)) {
      coinsList.splice(i, 1);
      coins += 1;
      score += 100;
      playCoinSound();
    }
  }
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function ensureAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playTone(frequency, duration, type = 'sine', volume = 0.08, delay = 0) {
  const audio = ensureAudio();
  if (!audio) {
    return;
  }

  const startTime = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function playJumpSound() {
  playTone(520, 0.11, 'square', 0.055);
  playTone(740, 0.13, 'square', 0.045, 0.06);
}

function playCoinSound() {
  playTone(880, 0.09, 'sine', 0.075);
  playTone(1320, 0.14, 'sine', 0.065, 0.07);
}

function playFailureSound() {
  playTone(220, 0.25, 'sawtooth', 0.07);
  playTone(147, 0.38, 'sawtooth', 0.06, 0.16);
}

function playVictorySound() {
  playTone(523.25, 0.3, 'triangle', 0.07);
  playTone(659.25, 0.3, 'triangle', 0.07, 0.11);
  playTone(783.99, 0.48, 'triangle', 0.07, 0.22);
}

function startBackgroundMusic() {
  const audio = ensureAudio();
  if (!audio || backgroundMusicTimer) {
    return;
  }

  const notes = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
  const playNextNote = () => {
    if (state !== 'playing') {
      return;
    }
    playTone(notes[backgroundMusicStep], 0.22, 'triangle', 0.024);
    backgroundMusicStep = (backgroundMusicStep + 1) % notes.length;
  };
  playNextNote();
  backgroundMusicTimer = window.setInterval(playNextNote, 310);
}

function stopBackgroundMusic() {
  if (backgroundMusicTimer) {
    window.clearInterval(backgroundMusicTimer);
    backgroundMusicTimer = null;
  }
}

function drawClouds() {
  ctx.save();
  for (const cloud of cloudLayer) {
    const wrap = VIEW_WIDTH + 260;
    const x = loopValue(cloud.baseX - backgroundOffset * cloud.speed, wrap) - 130;
    const y = cloud.y;
    const scale = cloud.scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.arc(18, -6, 16, 0, Math.PI * 2);
    ctx.arc(36, 0, 20, 0, Math.PI * 2);
    ctx.arc(18, 10, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
  ctx.restore();
}

function drawBackgroundRunners() {
  if (!mountainContour.length || !mountainImage) {
    return;
  }

  const mountainHeight = Math.round(VIEW_HEIGHT * 0.42);
  const tileWidth = Math.max(480, VIEW_WIDTH + 220);
  const baseY = VIEW_HEIGHT - mountainHeight - 58;
  const offset = backgroundOffset * 0.08;
  const startX = loopValue(-offset, tileWidth);

  backgroundRunners.forEach((runner) => {
    const screenX = (runner.progress * (VIEW_WIDTH + 220) - offset) % (VIEW_WIDTH + 220) - 110;
    const contourX = loopValue(screenX - startX, tileWidth);
    const contourIndex = Math.round((contourX / tileWidth) * (mountainContour.length - 1));
    const contourY = (mountainContour[contourIndex] / (mountainImage.naturalHeight || mountainImage.height || 1)) * mountainHeight;
    const drawX = screenX;
    const baseDrawY = baseY + contourY - 8;
    const floatOffset = Math.sin((runner.progress * Math.PI * 2) + backgroundOffset * 0.06) * 12;
    const drawY = baseDrawY - 8 - floatOffset;

    if (drawX < -40 || drawX > VIEW_WIDTH + 40) {
      return;
    }

    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.scale(runner.scale, runner.scale);

    if (backgroundCharacterImage && backgroundCharacterImage.complete) {
      const drawHeight = 72;
      const aspectRatio = backgroundCharacterImage.naturalWidth / Math.max(1, backgroundCharacterImage.naturalHeight);
      const drawWidth = drawHeight * aspectRatio;
      ctx.drawImage(backgroundCharacterImage, -drawWidth / 2, -drawHeight + 10, drawWidth, drawHeight);
    } else {
      ctx.fillStyle = '#ffab2d';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#1d2d6d';
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 2, 4, 4);
      ctx.fillRect(10, 2, 4, 4);
    }

    ctx.restore();
  });
}

function drawTreeSprites() {
  if (!treeFrames.length) {
    return;
  }

  treeSprites.forEach((tree) => {
    const frameImage = treeFrames[(treeFrameIndex + (tree.phase || 0)) % treeFrames.length];
    if (!frameImage || !frameImage.complete || !frameImage.naturalWidth) {
      return;
    }

    // 树沿着背景方向循环移动，超出右侧后从左侧重新出现。
    const x = loopValue(tree.x - backgroundOffset * tree.speed, VIEW_WIDTH + 220) - 110;
    if (x < -180 || x > VIEW_WIDTH + 180) {
      return;
    }

    const drawHeight = tree.height;
    const aspectRatio = frameImage.naturalWidth / Math.max(1, frameImage.naturalHeight);
    const drawWidth = drawHeight * aspectRatio;

    ctx.save();
    ctx.translate(x, GROUND_Y);
    ctx.filter = 'saturate(68%) brightness(88%)';
    ctx.globalAlpha = 0.9;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(frameImage, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
    ctx.restore();
  });
}

function drawVegetationLayer(frames, sprites, frameIndex, wrapPadding) {
  if (!frames.length) {
    return;
  }

  sprites.forEach((sprite) => {
    const phase = sprite.phase || 0;
    const frameImage = frames[(frameIndex + phase) % frames.length];
    if (!frameImage || !frameImage.complete || !frameImage.naturalWidth) {
      return;
    }

    const wrapWidth = VIEW_WIDTH + wrapPadding;
    const x = loopValue(sprite.x - backgroundOffset * sprite.speed, wrapWidth) - wrapPadding / 2;
    if (x < -160 || x > VIEW_WIDTH + 160) {
      return;
    }

    const drawHeight = sprite.height;
    const aspectRatio = frameImage.naturalWidth / Math.max(1, frameImage.naturalHeight);
    const drawWidth = drawHeight * aspectRatio;

    ctx.save();
    ctx.translate(x, GROUND_Y);
    ctx.filter = 'saturate(70%) brightness(90%)';
    ctx.globalAlpha = 0.92;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(frameImage, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
    ctx.restore();
  });
}

function drawShortTreeSprites() {
  drawVegetationLayer(shortTreeFrames, shortTreeSprites, shortTreeFrameIndex, 220);
}

function drawBushSprites() {
  drawVegetationLayer(bushFrames, bushSprites, bushFrameIndex, 190);
}

function drawGrassSprites() {
  const frameImage = grassFrames[grassFrameIndex % grassFrames.length];
  if (!frameImage || !frameImage.complete || !frameImage.naturalWidth) {
    return;
  }

  grassSprites.forEach((grass) => {
    const wrapWidth = VIEW_WIDTH + 180;
    const x = loopValue(grass.x - backgroundOffset * grass.speed, wrapWidth) - 90;
    if (x < -140 || x > VIEW_WIDTH + 140) {
      return;
    }

    const drawHeight = grass.height;
    const aspectRatio = frameImage.naturalWidth / Math.max(1, frameImage.naturalHeight);
    const drawWidth = drawHeight * aspectRatio;

    ctx.save();
    ctx.translate(x, GROUND_Y);
    ctx.filter = 'saturate(78%) brightness(92%)';
    ctx.globalAlpha = 0.94;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // 图片底边锚定 GROUND_Y，确保每一帧都贴合地面。
    ctx.drawImage(frameImage, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
    ctx.restore();
  });
}

function drawBackground() {
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  skyGrad.addColorStop(0, '#071a30');
  skyGrad.addColorStop(0.55, '#315995');
  skyGrad.addColorStop(1, '#d9efff');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  if (skyImage && skyImage.complete) {
    ctx.globalAlpha = 0.95;
    ctx.drawImage(skyImage, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.globalAlpha = 1;
  }

  drawClouds();
  drawBackgroundRunners();

  if (mountainImage && mountainImage.complete) {
    const mountainHeight = Math.round(VIEW_HEIGHT * 0.42);
    const tileWidth = Math.max(480, VIEW_WIDTH + 220);
    const offset = backgroundOffset * 0.08;
    const startX = loopValue(-offset, tileWidth);

    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.filter = 'saturate(72%) brightness(90%)';
    for (let i = -1; i <= 1; i += 1) {
      const x = startX + i * tileWidth;
      ctx.drawImage(mountainImage, x, VIEW_HEIGHT - mountainHeight - 58, tileWidth, mountainHeight);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = '#3b4d5f';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 60);
    ctx.lineTo(140, GROUND_Y - 110);
    ctx.lineTo(260, GROUND_Y - 60);
    ctx.lineTo(380, GROUND_Y - 140);
    ctx.lineTo(520, GROUND_Y - 60);
    ctx.lineTo(720, GROUND_Y - 120);
    ctx.lineTo(VIEW_WIDTH, GROUND_Y - 70);
    ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
    ctx.lineTo(0, VIEW_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  // 绘制有层次的草土地面：草皮、亮边、泥土与循环纹理。
  const soilGradient = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_HEIGHT);
  soilGradient.addColorStop(0, '#73512d');
  soilGradient.addColorStop(0.42, '#593b24');
  soilGradient.addColorStop(1, '#352419');
  ctx.fillStyle = soilGradient;
  ctx.fillRect(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y);

  ctx.fillStyle = '#315f2c';
  ctx.fillRect(0, GROUND_Y - 10, VIEW_WIDTH, 10);
  ctx.fillStyle = '#6f9a42';
  ctx.fillRect(0, GROUND_Y - 10, VIEW_WIDTH, 3);
  ctx.fillStyle = '#a6c85c';
  ctx.fillRect(0, GROUND_Y - 10, VIEW_WIDTH, 1);

  // 地表短草随场景移动，丰富边缘但不再使用矢量树。
  ctx.fillStyle = '#497d35';
  for (let i = 0; i < 42; i += 1) {
    const x = loopValue(i * 29 - backgroundOffset * 0.55, VIEW_WIDTH + 30) - 15;
    const bladeHeight = 3 + (i % 4) * 2;
    ctx.fillRect(Math.round(x), GROUND_Y - 10 - bladeHeight, 2, bladeHeight);
  }

  // 泥土中的石子和横向纹理采用循环坐标，移动时不会出现接缝。
  for (let i = 0; i < 18; i += 1) {
    const x = loopValue(i * 67 - backgroundOffset * 0.42, VIEW_WIDTH + 70) - 35;
    const y = GROUND_Y + 18 + (i % 3) * 15;
    ctx.fillStyle = i % 2 === 0 ? '#8b6840' : '#4b3222';
    ctx.beginPath();
    ctx.ellipse(x, y, 6 + (i % 3), 2.5 + (i % 2), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(37, 24, 17, 0.42)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i += 1) {
    const x = loopValue(i * 125 - backgroundOffset * 0.32, VIEW_WIDTH + 130) - 65;
    const y = GROUND_Y + 31 + (i % 2) * 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 28, y + 2);
    ctx.stroke();
  }

  // 植被由高到低叠放，速度逐层加快，形成稳定的前后景深。
  drawTreeSprites();
  drawShortTreeSprites();
  drawBushSprites();
  drawGrassSprites();
}

function drawCharacterSprite(character, sprites, label) {
  const isJumping = character.spriteState === 'jump';
  const image = isJumping ? sprites.jump : sprites.run[character.spriteFrame];
  const bounds = isJumping ? sprites.jumpBounds : sprites.bounds[character.spriteFrame];
  const drawHeight = 68;
  const drawWidth = drawHeight * (bounds.width / bounds.height);
  const drawX = character.x + character.width / 2 - drawWidth / 2;
  const drawY = character.y + character.height - drawHeight;

  ctx.save();
  if (image.complete && image.naturalWidth) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(character.x, character.y, character.width, character.height);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '12px Microsoft YaHei';
  ctx.textAlign = 'center';
  ctx.fillText(label, character.x + character.width / 2, drawY - 6);
  ctx.restore();
}

function drawNpc() {
  drawCharacterSprite(npc, characterSprites.npc, '佐助');
}

function drawPlayer() {
  drawCharacterSprite(player, characterSprites.player, '鸣人');
}

function drawFailureCharacter(character, spriteSet) {
  const image = spriteSet.frames[failureFrame];
  const bounds = spriteSet.bounds[failureFrame];
  const drawHeight = 82;
  const drawWidth = drawHeight * (bounds.width / bounds.height);
  const drawX = character.x + character.width / 2 - drawWidth / 2;
  const drawY = character.y + character.height - drawHeight;

  if (image.complete && image.naturalWidth) {
    ctx.drawImage(
      image,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
  }
}

function drawFailureSequence() {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawFailureCharacter(player, failureSprites.player);
  drawFailureCharacter(npc, failureSprites.npc);

  if (failurePhase === 'message') {
    const textProgress = Math.min(1, failureTimer / 0.36);
    ctx.globalAlpha = textProgress;
    ctx.textAlign = 'center';
    ctx.translate(VIEW_WIDTH / 2, 86);
    const textScale = 0.86 + textProgress * 0.14;
    ctx.scale(textScale, textScale);
    ctx.shadowColor = 'rgba(30, 12, 18, 0.85)';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#ffd2d2';
    ctx.font = 'bold 36px Microsoft YaHei';
    ctx.fillText('摔倒了 再试一次吧！', 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Microsoft YaHei';
    ctx.fillText('点击画布或按空格重新开始', 0, 34);
  }
  ctx.restore();
}

function drawVictoryCelebration() {
  const image = victorySprites.frames[victoryFrame];
  const { x, y, width, height } = victorySprites.bounds;
  const drawHeight = 206;
  const drawWidth = drawHeight * (width / height);
  const drawX = (VIEW_WIDTH - drawWidth) / 2;
  const drawY = GROUND_Y - drawHeight;
  const textProgress = Math.min(1, endingTimer / 0.38);

  ctx.save();
  if (image.complete && image.naturalWidth) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, x, y, width, height, drawX, drawY, drawWidth, drawHeight);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Microsoft YaHei';
  ctx.fillText('2026.7.23 琪翼@微博71___71制作', VIEW_WIDTH / 2, 28);

  ctx.globalAlpha = textProgress;
  ctx.translate(VIEW_WIDTH / 2, 72);
  const textScale = 0.85 + textProgress * 0.15;
  ctx.scale(textScale, textScale);
  ctx.shadowColor = 'rgba(35, 16, 54, 0.85)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#fff4a9';
  ctx.font = 'bold 34px Microsoft YaHei';
  ctx.fillText('宇智波佐助生日快乐！鸣佐贴贴', 0, 0);

  if (endingTimer >= 1.5) {
    const restartProgress = Math.min(1, (endingTimer - 1.5) / 0.3);
    ctx.globalAlpha = restartProgress;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Microsoft YaHei';
    ctx.fillText('点击下方“重新开始”按钮再来一次', 0, 42);
  }
  ctx.restore();
}

function drawObstacle(item) {
  const sprite = obstacleSprites[item.spriteIndex];
  const { image, bounds } = sprite;

  if (!image.complete || !image.naturalWidth) {
    return;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    item.x,
    GROUND_Y - item.height,
    item.width,
    item.height
  );
  ctx.restore();
}

function drawCoin(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.fillStyle = '#ffd54f';
  ctx.beginPath();
  ctx.arc(item.width / 2, item.height / 2, item.width / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8f00';
  ctx.font = '12px Microsoft YaHei';
  ctx.textAlign = 'center';
  ctx.fillText('¥', item.width / 2, item.height / 2 + 4);
  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = 'rgba(10, 21, 36, 0.7)';
  ctx.fillRect(18, 18, 300, 64);
  ctx.fillStyle = '#fff';
  ctx.font = '16px Microsoft YaHei';
  ctx.fillText(`距离: ${Math.min(Math.floor(distance), GOAL_KM)} / ${GOAL_KM} km`, 32, 44);
  ctx.fillText(`金币: ${coins}  分数: ${score}`, 32, 70);

  ctx.fillStyle = 'rgba(10, 21, 36, 0.7)';
  ctx.fillRect(332, 18, 240, 64);
  ctx.fillStyle = '#fff';
  ctx.font = '16px Microsoft YaHei';
  ctx.fillText('鸣人追逐佐助', 352, 44);
  ctx.fillText('佐助会自动跳过障碍', 352, 70);
}

function drawOverlay() {
  if (state === 'ready') {
    ctx.fillStyle = 'rgba(8, 13, 24, 0.7)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px Microsoft YaHei';
    ctx.fillText('准备开始！', 330, 150);
    ctx.font = '22px Microsoft YaHei';
    ctx.fillText(`按空格 / ↑ / W 跳跃，冲向 ${GOAL_KM}km`, 250, 196);
    ctx.fillText('点击画布或按空格即可开始', 260, 232);
  }

}

function drawFrame(timestamp) {
  // 每帧恢复逻辑坐标到高清画布的映射，避免后续绘制修改状态。
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  if (!lastTime) {
    lastTime = timestamp;
  }
  const dt = Math.min(0.028, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  update(dt);
  drawBackground();
  if (state !== 'ending' && state !== 'failure') {
    drawHud();
  }

  for (const item of obstacles) {
    drawObstacle(item);
  }
  for (const item of coinsList) {
    drawCoin(item);
  }

  if (state === 'ending' && endingPhase === 'celebrate') {
    drawVictoryCelebration();
  } else if (state === 'failure') {
    drawFailureSequence();
  } else {
    drawNpc();
    drawPlayer();
  }
  drawOverlay();

  requestAnimationFrame(drawFrame);
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
    event.preventDefault();
    jumpPlayer();
  }
});

function isPortraitStageClick(event) {
  if (!gameStage || window.matchMedia('(orientation: landscape)').matches) {
    return true;
  }

  const rect = gameStage.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

canvas.addEventListener('click', (event) => {
  if (!isPortraitStageClick(event)) {
    return;
  }

  if (state === 'ready' || state === 'failure') {
    startGame();
  } else if (state === 'playing') {
    jumpPlayer();
  }
});

const jumpButton = document.getElementById('jumpButton');
function setJumpButtonMode(mode) {
  if (!jumpButton) {
    return;
  }

  const isRestart = mode === 'restart';
  jumpButton.textContent = isRestart ? '重新开始' : '跳跃';
  jumpButton.setAttribute('aria-label', jumpButton.textContent);
  jumpButton.classList.toggle('is-restart', isRestart);
}

if (jumpButton) {
  jumpButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (state === 'ending') {
      startGame();
    } else {
      jumpPlayer();
    }
  });
}

loadBackgroundAssets();
requestAnimationFrame(drawFrame);
