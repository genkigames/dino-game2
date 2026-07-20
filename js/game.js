(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const messageEl = document.getElementById('message');
  const messageText = document.getElementById('message-text');

  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = 230;

  const COLOR_BODY = '#f57c2b';
  const COLOR_DARK = '#3d2712';
  const COLOR_GROUND = '#535353';
  const COLOR_OBSTACLE = '#535353';
  const COLOR_CLOUD = '#c9c9c9';
  const COLOR_HURT = '#e5443b';
  const COLOR_HEART_EMPTY = '#d0d0d0';
  const COLOR_BOSS = '#4caf50';
  const COLOR_BOSS_DARK = '#1b5e20';

  const HIGH_SCORE_KEY = 'orange-jump-highscore';
  const MAX_LIVES = 3;

  // ステージ設定（1〜5＋ボス。末尾までいくと先頭に戻る）
  const START_SPEED = 0.42;      // 通常ステージの開始スピード
  const STAGE_RAMP = 2000;       // 開始から最大スピードに到達するまでの距離
  const SPAWN_START = 2000;      // この距離までは障害物を出さない（加速中は安全）
  const SPAWN_END_BUF = 1200;    // クリア前この距離は障害物を出さない
  const STAGES = [
    { max: 0.52, len: 20000, types: [1] },                 // ステージ1
    { max: 0.62, len: 20000, types: [1, 2] },              // ステージ2
    { max: 0.62, len: 20000, types: [1, 2, 3] },           // ステージ3
    { max: 0.82, len: 20000, types: [1] },                 // ステージ4
    { max: 0.52, len: 20000, types: [1, 2, 3], dense: true }, // ステージ5（多め）
    { max: 0.35, len: 30000, boss: true },                 // ボスステージ
  ];
  const CYCLE_LEN = STAGES.reduce((s, st) => s + st.len, 0);

  function stageInfo(dist) {
    const n = STAGES.length;
    const cyc = Math.floor(dist / CYCLE_LEN);
    const d = dist - cyc * CYCLE_LEN;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      if (d < acc + STAGES[i].len) {
        return {
          gIdx: cyc * n + i, i: i, num: i + 1, cfg: STAGES[i], max: STAGES[i].max,
          dIn: d - acc, len: STAGES[i].len, startDist: cyc * CYCLE_LEN + acc,
        };
      }
      acc += STAGES[i].len;
    }
    const last = n - 1;
    return {
      gIdx: cyc * n + last, i: last, num: last + 1, cfg: STAGES[last], max: STAGES[last].max,
      dIn: STAGES[last].len, len: STAGES[last].len, startDist: cyc * CYCLE_LEN + acc - STAGES[last].len,
    };
  }

  const HEART_ITEM_PIX = 4;
  const HEART_ITEM_W = 7 * HEART_ITEM_PIX;
  const HEART_ITEM_H = 6 * HEART_ITEM_PIX;
  const HEART_ITEM_Y = 150;

  const WALL_W = 14;             // 障害物2（壁）
  const WALL_H = 78;

  const FLYER_PIX = 4;           // 障害物3（飛翔物）
  const FLYER_COLS = 13;
  const FLYER_ROWS = 7;
  const FLYER_W = FLYER_COLS * FLYER_PIX;
  const FLYER_Y = 92;

  // ボスのビーム3種（回避方法が異なる）
  const BEAM_SPEED = 0.5;
  const BEAM_W = 44;
  const BEAM_TYPES = {
    low:    { y: 190, h: 34 },  // ジャンプで回避
    pillar: { y: 136, h: 94 },  // 2段ジャンプで回避
    high:   { y: 94,  h: 82 },  // ジャンプなし（地上）で回避
  };
  const FINALE_AT = 28000;       // ボスステージ内この距離で決着演出へ

  // ボス（トゲトゲした緑のインベーダー）
  const BOSS = [
    '100010000010001',
    '010111000111010',
    '001111111111100',
    '011111111111110',
    '111111111111111',
    '110111111110111',
    '111111111111111',
    '111101111011111',
    '011111111111110',
    '110110110110110',
    '100100000100100',
    '010000000000010',
  ];
  const BOSS_PIX = 7;
  const BOSS_W = BOSS[0].length * BOSS_PIX;
  const BOSS_H = BOSS.length * BOSS_PIX;
  const BOSS_X = W - BOSS_W - 12;
  const BOSS_BASE_Y = 50;

  // キャラのドット絵
  const BODY_ROWS = [
    '001111100',
    '011111110',
    '110111011',
    '111111111',
    '111111111',
    '011111110',
  ];
  const LEGS_RUN_A = ['010000010', '110000011'];
  const LEGS_RUN_B = ['010000010', '011000110'];
  const LEGS_JUMP  = ['011000110', '000000000'];

  const HEART = [
    '0110110',
    '1111111',
    '1111111',
    '0111110',
    '0011100',
    '0001000',
  ];

  const PTERO_A = [
    '0000000011000',
    '0000000110000',
    '0000011100000',
    '1111111100000',
    '0111111000000',
    '0000110000000',
    '0000000000000',
  ];
  const PTERO_B = [
    '0000000000000',
    '0000110000000',
    '1111111100000',
    '0111111000000',
    '0000011100000',
    '0000000110000',
    '0000000011000',
  ];

  const PIX = 5;
  const CHAR_COLS = 9;
  const CHAR_ROWS_BODY = BODY_ROWS.length;
  const CHAR_W = CHAR_COLS * PIX;
  const CHAR_H = (CHAR_ROWS_BODY + 2) * PIX;

  const HITBOX_MX = 10;
  const HITBOX_TOP = 8;
  const HITBOX_BOTTOM = 2;

  function drawSprite(rows2, x, y, bodyColor) {
    bodyColor = bodyColor || COLOR_BODY;
    const rows = BODY_ROWS.concat(rows2);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '1') {
          const isEye = r === 2 && (c === 2 || c === 6);
          ctx.fillStyle = isEye ? COLOR_DARK : bodyColor;
          ctx.fillRect(x + c * PIX, y + r * PIX, PIX, PIX);
        }
      }
    }
  }

  function drawHeart(x, y, filled, p) {
    p = p || 3;
    ctx.fillStyle = filled ? COLOR_HURT : COLOR_HEART_EMPTY;
    for (let r = 0; r < HEART.length; r++) {
      for (let c = 0; c < HEART[r].length; c++) {
        if (HEART[r][c] === '1') ctx.fillRect(x + c * p, y + r * p, p, p);
      }
    }
  }

  function drawFlyer(x, y) {
    const rows = flyerFrame === 0 ? PTERO_A : PTERO_B;
    ctx.fillStyle = COLOR_OBSTACLE;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === '1') ctx.fillRect(x + c * FLYER_PIX, y + r * FLYER_PIX, FLYER_PIX, FLYER_PIX);
      }
    }
  }

  function drawBeam(ob) {
    const cx = ob.x + ob.w / 2;
    const pulse = 0.85 + 0.15 * Math.sin((ob.t || 0) * 0.02);
    ctx.fillStyle = 'rgba(55,214,122,' + (0.28 * pulse) + ')';
    ctx.fillRect(ob.x - 7, ob.y - 7, ob.w + 14, ob.h + 14);
    ctx.fillStyle = 'rgba(123,255,234,0.55)';
    ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - ob.w * 0.22, ob.y + 3, ob.w * 0.44, ob.h - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(ob.x - 3, ob.y, 6, ob.h);
  }

  function drawBoss() {
    const by = BOSS_BASE_Y + Math.sin(bossBob) * 6;
    if (bossCharge > 0) {
      ctx.fillStyle = 'rgba(123,255,234,' + (0.45 * bossCharge) + ')';
      ctx.fillRect(BOSS_X - 12, by - 12, BOSS_W + 24, BOSS_H + 24);
    }
    ctx.fillStyle = COLOR_BOSS;
    for (let r = 0; r < BOSS.length; r++) {
      for (let c = 0; c < BOSS[r].length; c++) {
        if (BOSS[r][c] === '1') ctx.fillRect(BOSS_X + c * BOSS_PIX, by + r * BOSS_PIX, BOSS_PIX, BOSS_PIX);
      }
    }
    ctx.fillStyle = COLOR_BOSS_DARK;
    ctx.fillRect(BOSS_X + 3 * BOSS_PIX, by + 5 * BOSS_PIX, BOSS_PIX * 2, BOSS_PIX * 2);
    ctx.fillRect(BOSS_X + 10 * BOSS_PIX, by + 5 * BOSS_PIX, BOSS_PIX * 2, BOSS_PIX * 2);
  }

  const player = {
    x: 60,
    y: GROUND_Y - CHAR_H,
    vy: 0,
    gravity: 0.0028,
    jumpVel: -0.62,
    onGround: true,
    jumpsLeft: 2,
    runFrame: 0,
    runTimer: 0,
  };

  let obstacles = [];
  let clouds = [];
  let groundOffset = 0;
  let speed = START_SPEED;
  let distance = 0;
  let state = 'waiting';
  let lastTime = null;
  let nextObstacleAt = 0;
  let lives = MAX_LIVES;
  let hurtTimer = 0;
  let currentStageIndex = -1;
  let stageStartDist = 0;
  let stageLen = STAGES[0].len;
  let stageHeartSpawnAt = 0;
  let stageHeartDone = false;
  let heartItem = null;
  let banner = null;
  let flyerFrame = 0;
  let flyerAnimTimer = 0;
  // ボス関連
  let bossActive = false;
  let bossBob = 0;
  let bossFireTimer = 0;
  let bossCharge = 0;
  let finalePhase = 'none'; // none|item|charge|fire|explode|done
  let finaleTimer = 0;
  let orb = null;
  let hyperBeam = null;
  let particles = [];
  let flash = 0;
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);

  // URLの印で途中から開始できる（例: ...?boss ／ ...?finale）確認用
  const BOSS_START = STAGES.slice(0, 5).reduce((s, st) => s + st.len, 0); // 100000
  const params = new URLSearchParams(location.search);
  let startDistance = 0;
  if (params.has('boss')) startDistance = BOSS_START;
  else if (params.has('finale')) startDistance = BOSS_START + FINALE_AT - 1000;
  else if (params.has('d')) startDistance = Number(params.get('d')) || 0;
  const isDebugStart = startDistance > 0;

  bestEl.textContent = 'HI ' + String(highScore).padStart(5, '0');

  function resetGame() {
    obstacles = [];
    clouds = [];
    for (let i = 0; i < 3; i++) clouds.push({ x: Math.random() * W, y: 30 + Math.random() * 60 });
    groundOffset = 0;
    speed = START_SPEED;
    distance = startDistance;
    lives = MAX_LIVES;
    hurtTimer = 0;
    currentStageIndex = -1;
    stageStartDist = 0;
    stageLen = STAGES[0].len;
    stageHeartDone = false;
    heartItem = null;
    banner = null;
    flyerFrame = 0;
    flyerAnimTimer = 0;
    bossActive = false;
    bossBob = 0;
    bossFireTimer = 0;
    bossCharge = 0;
    finalePhase = 'none';
    finaleTimer = 0;
    orb = null;
    hyperBeam = null;
    particles = [];
    flash = 0;
    player.y = GROUND_Y - CHAR_H;
    player.vy = 0;
    player.onGround = true;
    player.jumpsLeft = 2;
    nextObstacleAt = SPAWN_START;
    scoreEl.textContent = '00000';
  }

  function spawnGroup() {
    const shapes = [
      [{ w: 12, h: 30 }],
      [{ w: 12, h: 45 }],
      [{ w: 12, h: 20 }, { w: 12, h: 30 }],
      [{ w: 10, h: 25 }, { w: 10, h: 40 }, { w: 10, h: 22 }],
    ];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    let offsetX = 0;
    const parts = shape.map(p => {
      const part = { x: offsetX, w: p.w, h: p.h };
      offsetX += p.w + 2;
      return part;
    });
    obstacles.push({ kind: 'ground', x: W + 20, w: offsetX - 2, parts: parts });
  }

  function spawnWall() {
    obstacles.push({ kind: 'ground', x: W + 20, w: WALL_W, parts: [{ x: 0, w: WALL_W, h: WALL_H }] });
  }

  function spawnFlyer() {
    obstacles.push({ kind: 'flyer', x: W + 20, y: FLYER_Y, w: FLYER_W });
  }

  function spawnForStage(cfg) {
    const canFly = cfg.types.indexOf(3) >= 0;
    const canWall = cfg.types.indexOf(2) >= 0;
    if (canFly && Math.random() < 0.35) {
      spawnFlyer();
      if (Math.random() < 0.5) spawnGroup();
    } else if (canWall && Math.random() < 0.45) {
      spawnWall();
    } else {
      spawnGroup();
    }
  }

  function spawnBeam(type) {
    const b = BEAM_TYPES[type];
    obstacles.push({ kind: 'beam', type: type, x: BOSS_X + 4, y: b.y, h: b.h, w: BEAM_W, speed: BEAM_SPEED, t: 0 });
  }

  function startFinale() {
    finalePhase = 'item';
    finaleTimer = 0;
    obstacles = obstacles.filter(o => o.kind !== 'beam');
    orb = { x: BOSS_X, y: 120 };
  }

  function explodeBoss() {
    const cx = BOSS_X + BOSS_W / 2, cy = BOSS_BASE_Y + BOSS_H / 2;
    for (let i = 0; i < 52; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.05 + Math.random() * 0.28;
      particles.push({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.05,
        life: 700 + Math.random() * 800, age: 0, size: 3 + Math.random() * 6,
        color: Math.random() < 0.5 ? COLOR_BOSS : COLOR_BOSS_DARK,
      });
    }
    bossActive = false;
  }

  function updateFinale(dt) {
    finaleTimer += dt;
    if (finalePhase === 'item') {
      orb.x -= 0.5 * dt;
      orb.y += (140 - orb.y) * 0.06;
      if (orb.x <= player.x + CHAR_W) { orb = null; finalePhase = 'charge'; finaleTimer = 0; }
    } else if (finalePhase === 'charge') {
      if (finaleTimer > 700) {
        finalePhase = 'fire'; finaleTimer = 0;
        hyperBeam = { x: player.x + CHAR_W, len: 0 };
        flash = 1;
      }
    } else if (finalePhase === 'fire') {
      hyperBeam.len += 2.4 * dt;
      if (hyperBeam.x + hyperBeam.len >= BOSS_X + BOSS_W * 0.5) {
        explodeBoss(); finalePhase = 'explode'; finaleTimer = 0; flash = 1;
      }
    } else if (finalePhase === 'explode') {
      if (finaleTimer > 1400) { finalePhase = 'done'; hyperBeam = null; }
    }
  }

  function updateBoss(dt, dIn) {
    bossBob += dt * 0.004;
    if (finalePhase !== 'none') { updateFinale(dt); return; }
    if (dIn >= FINALE_AT) { startFinale(); return; }
    const p = Math.min(1, dIn / FINALE_AT);
    const gap = 1500 - 800 * p; // 密度をだんだん上げる
    bossFireTimer -= dt;
    bossCharge = (bossFireTimer > 0 && bossFireTimer < 300) ? (1 - bossFireTimer / 300) : 0;
    if (bossFireTimer <= 0) {
      const types = ['low', 'pillar', 'high'];
      spawnBeam(types[Math.floor(Math.random() * types.length)]);
      bossFireTimer = gap;
    }
  }

  function hitsObstacle() {
    const px1 = player.x + HITBOX_MX;
    const px2 = player.x + CHAR_W - HITBOX_MX;
    const py1 = player.y + HITBOX_TOP;
    const py2 = player.y + CHAR_H - HITBOX_BOTTOM;
    for (const ob of obstacles) {
      if (ob.kind === 'flyer') {
        const fx1 = ob.x + 1 * FLYER_PIX, fx2 = ob.x + (FLYER_COLS - 2) * FLYER_PIX;
        const fy1 = ob.y + 1 * FLYER_PIX, fy2 = ob.y + 6 * FLYER_PIX;
        if (px2 > fx1 && px1 < fx2 && py2 > fy1 && py1 < fy2) return true;
      } else if (ob.kind === 'beam') {
        const bx1 = ob.x + 3, bx2 = ob.x + ob.w - 3;
        const by1 = ob.y, by2 = ob.y + ob.h;
        if (px2 > bx1 && px1 < bx2 && py2 > by1 && py1 < by2) return true;
      } else {
        for (const part of ob.parts) {
          const ox1 = ob.x + part.x, ox2 = ox1 + part.w;
          const oy1 = GROUND_Y - part.h, oy2 = GROUND_Y;
          if (px2 > ox1 && px1 < ox2 && py2 > oy1 && py1 < oy2) return true;
        }
      }
    }
    return false;
  }

  function jump() {
    if (state === 'waiting') {
      state = 'running';
      messageEl.classList.add('hidden');
      lastTime = null;
      requestAnimationFrame(loop);
    }
    if (state === 'over') {
      resetGame();
      state = 'running';
      messageEl.classList.add('hidden');
      lastTime = null;
      requestAnimationFrame(loop);
      return;
    }
    if (state === 'running' && player.jumpsLeft > 0) {
      player.vy = player.jumpVel;
      player.onGround = false;
      player.jumpsLeft--;
    }
  }

  function endGame() {
    state = 'over';
    const finalScore = Math.floor(distance / 10);
    if (!isDebugStart && finalScore > highScore) {
      highScore = finalScore;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    }
    bestEl.textContent = 'HI ' + String(highScore).padStart(5, '0');
    messageText.textContent = 'ゲームオーバー タップ or スペースキーでリスタート';
    messageEl.classList.remove('hidden');
  }

  function update(dt) {
    distance += speed * dt;
    scoreEl.textContent = String(Math.floor(distance / 10)).padStart(5, '0');

    const si = stageInfo(distance);
    if (si.cfg.boss) {
      speed = si.max; // ボスは一定の低速
    } else if (si.dIn < STAGE_RAMP) {
      speed = START_SPEED + (si.max - START_SPEED) * (si.dIn / STAGE_RAMP);
    } else {
      speed = si.max;
    }

    // ステージ切り替わり
    if (si.gIdx !== currentStageIndex) {
      currentStageIndex = si.gIdx;
      stageStartDist = si.startDist;
      stageLen = si.len;
      obstacles = [];
      heartItem = null;
      particles = [];
      hyperBeam = null; orb = null; flash = 0;
      finalePhase = 'none'; finaleTimer = 0; bossCharge = 0;
      if (si.cfg.boss) {
        banner = { text: 'BOSS STAGE', x: W };
        bossActive = true;
        bossFireTimer = 1600;
        stageHeartDone = true; // ボス中は回復ハート無し
      } else {
        banner = { text: 'STAGE ' + si.num, x: W };
        bossActive = false;
        stageHeartDone = false;
        stageHeartSpawnAt = si.startDist + 4000 + Math.random() * 10000;
        nextObstacleAt = si.startDist + SPAWN_START + Math.random() * 500;
      }
    }

    groundOffset = (groundOffset + speed * dt) % 20;
    if (hurtTimer > 0) hurtTimer -= dt;
    if (flash > 0) flash = Math.max(0, flash - dt * 0.004);

    flyerAnimTimer += dt;
    if (flyerAnimTimer > 180) { flyerAnimTimer = 0; flyerFrame = 1 - flyerFrame; }

    if (banner) {
      banner.x -= 0.5 * dt; // ステージ速度に依らず一定
      if (banner.x < -560) banner = null;
    }

    clouds.forEach(cl => {
      cl.x -= speed * dt * 0.3;
      if (cl.x < -60) { cl.x = W + Math.random() * 100; cl.y = 30 + Math.random() * 60; }
    });

    player.vy += player.gravity * dt;
    player.y += player.vy * dt;
    if (player.y >= GROUND_Y - CHAR_H) {
      player.y = GROUND_Y - CHAR_H;
      player.vy = 0;
      player.onGround = true;
      player.jumpsLeft = 2;
    }
    if (player.onGround) {
      player.runTimer += dt;
      if (player.runTimer > 100) { player.runTimer = 0; player.runFrame = 1 - player.runFrame; }
    }

    if (si.cfg.boss) {
      updateBoss(dt, si.dIn);
    } else if (si.dIn >= SPAWN_START && si.dIn <= si.len - SPAWN_END_BUF && distance > nextObstacleAt) {
      spawnForStage(si.cfg);
      const gap = si.cfg.dense ? (240 + Math.random() * 280) : (420 + Math.random() * 520);
      nextObstacleAt = distance + gap;
    }

    obstacles.forEach(ob => { ob.x -= (ob.speed || speed) * dt; if (ob.t !== undefined) ob.t += dt; });
    obstacles = obstacles.filter(ob => ob.x + ob.w > -10);

    // 回復ハート（通常ステージのみ）
    if (!stageHeartDone && distance > stageHeartSpawnAt) {
      stageHeartDone = true;
      heartItem = { x: W + 20, y: HEART_ITEM_Y };
    }
    if (heartItem) {
      heartItem.x -= speed * dt;
      const hx1 = heartItem.x, hx2 = heartItem.x + HEART_ITEM_W;
      const hy1 = heartItem.y, hy2 = heartItem.y + HEART_ITEM_H;
      if (player.x + CHAR_W > hx1 && player.x < hx2 && player.y + CHAR_H > hy1 && player.y < hy2) {
        if (lives < MAX_LIVES) lives++;
        heartItem = null;
      } else if (heartItem.x + HEART_ITEM_W < -10) {
        heartItem = null;
      }
    }

    // パーティクル
    if (particles.length) {
      particles.forEach(pt => { pt.age += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 0.0006 * dt; });
      particles = particles.filter(pt => pt.age < pt.life);
    }

    // 被弾（演出中は無敵）
    if (finalePhase === 'none' && hurtTimer <= 0 && hitsObstacle()) {
      lives--;
      if (lives <= 0) { endGame(); return; }
      hurtTimer = 1000;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    if (banner) {
      ctx.fillStyle = COLOR_CLOUD;
      ctx.font = 'bold 84px "Courier New", monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(banner.text, banner.x, 115);
    }

    ctx.fillStyle = COLOR_CLOUD;
    clouds.forEach(cl => { ctx.fillRect(cl.x, cl.y, 30, 8); ctx.fillRect(cl.x + 6, cl.y - 6, 18, 8); });

    ctx.fillStyle = COLOR_GROUND;
    ctx.fillRect(0, GROUND_Y, W, 2);
    for (let x = -groundOffset; x < W; x += 20) ctx.fillRect(x, GROUND_Y + 4, 10, 2);

    if (bossActive) drawBoss();

    obstacles.forEach(ob => {
      if (ob.kind === 'flyer') {
        drawFlyer(ob.x, ob.y);
      } else if (ob.kind === 'beam') {
        drawBeam(ob);
      } else {
        ctx.fillStyle = COLOR_OBSTACLE;
        ob.parts.forEach(part => ctx.fillRect(ob.x + part.x, GROUND_Y - part.h, part.w, part.h));
      }
    });

    // 決着アイテム
    if (orb) {
      ctx.fillStyle = 'rgba(255,240,150,0.35)'; ctx.beginPath(); ctx.arc(orb.x, orb.y, 20, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.arc(orb.x, orb.y, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(orb.x, orb.y, 5, 0, 7); ctx.fill();
    }

    // 必殺ハイパービーム
    if (hyperBeam) {
      const cy = player.y + CHAR_H / 2, x = hyperBeam.x, len = hyperBeam.len, h = 48;
      ctx.fillStyle = 'rgba(55,214,122,0.3)'; ctx.fillRect(x, cy - h / 2 - 10, len, h + 20);
      ctx.fillStyle = 'rgba(123,255,234,0.7)'; ctx.fillRect(x, cy - h / 2, len, h);
      ctx.fillStyle = '#fff'; ctx.fillRect(x, cy - h * 0.28, len, h * 0.56);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x + len, cy, h * 0.6, 0, 7); ctx.fill();
    }

    // 爆発パーティクル
    if (particles.length) {
      particles.forEach(pt => {
        ctx.globalAlpha = Math.max(0, 1 - pt.age / pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      });
      ctx.globalAlpha = 1;
    }

    if (heartItem) drawHeart(heartItem.x, heartItem.y, true, HEART_ITEM_PIX);

    for (let i = 0; i < MAX_LIVES; i++) drawHeart(14 + i * 26, 14, i < lives);

    let legs;
    if (!player.onGround) legs = LEGS_JUMP;
    else if (state !== 'running') legs = LEGS_RUN_A;
    else legs = player.runFrame === 0 ? LEGS_RUN_A : LEGS_RUN_B;

    // チャージ中の発光
    if (finalePhase === 'charge') {
      const g = 0.4 + 0.3 * Math.sin(finaleTimer * 0.03);
      ctx.fillStyle = 'rgba(123,255,234,' + g + ')';
      ctx.fillRect(player.x - 8, player.y - 8, CHAR_W + 16, CHAR_H + 16);
    }

    let drawX = player.x, drawY = player.y, bodyColor = COLOR_BODY, visible = true;
    if (hurtTimer > 0) {
      visible = Math.floor(hurtTimer / 80) % 2 === 0;
      if (hurtTimer > 600) { bodyColor = COLOR_HURT; drawX += (Math.random() - 0.5) * 6; drawY += (Math.random() - 0.5) * 6; }
    }
    if (visible) drawSprite(legs, drawX, drawY, bodyColor);

    // 進捗バー
    const prog = Math.min(1, Math.max(0, (distance - stageStartDist) / stageLen));
    ctx.fillStyle = COLOR_HEART_EMPTY;
    ctx.fillRect(0, H - 5, W, 3);
    ctx.fillStyle = COLOR_BODY;
    ctx.fillRect(0, H - 5, W * prog, 3);

    if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.7) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function loop(ts) {
    if (state !== 'running') return;
    if (lastTime === null) lastTime = ts;
    const dt = Math.min(ts - lastTime, 50);
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  draw();

  function onInput(e) {
    if (e.type === 'keydown' && e.code !== 'Space' && e.code !== 'ArrowUp') return;
    e.preventDefault();
    jump();
  }

  document.addEventListener('keydown', onInput, { passive: false });
  canvas.addEventListener('pointerdown', onInput, { passive: false });
  document.getElementById('message').addEventListener('pointerdown', onInput, { passive: false });

  document.addEventListener('touchend', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());

  resetGame();
})();
