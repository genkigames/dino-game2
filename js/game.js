(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const achPointsEl = document.getElementById('ach-points');
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
  const ACHIEVEMENTS_KEY = 'orange-jump-achievements';
  const MAX_LIVES = 3;

  // 実績の定義（達成時に一度だけptを獲得）
  const ACHIEVEMENTS = {
    stage1: { id: 'stage1', name: 'ステージ1クリア', points: 50 },
    stage2: { id: 'stage2', name: 'ステージ2クリア', points: 50 },
    stage3: { id: 'stage3', name: 'ステージ3クリア', points: 100 },
    stage4: { id: 'stage4', name: 'ステージ4クリア', points: 100 },
    stage5: { id: 'stage5', name: 'ステージ5クリア', points: 100 },
    bossClear: { id: 'bossClear', name: 'ボスクリア', points: 200 },
    bossPerfect: { id: 'bossPerfect', name: 'ボスダメージなしクリア', points: 100 },
  };

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
  const BOSS_BASE_Y = 95;        // 空中の中央あたり

  // 決着演出のタイミング
  const CHARGE_MS = 1400;        // チャージ（従来の2倍）
  const FIRE_EXTEND_MS = 520;    // ビームが伸びてボスに届くまで
  const FIRE_EXPLODE_AT = 1500;  // 発射演出の後半で爆発
  const FIRE_END_MS = 2100;      // 発射演出の終わり

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

  // ドット絵をそのままの形で塗る（オーラ用のシルエット描画にも使う）
  function fillCells(rows, x, y, pix) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === '1') ctx.fillRect(x + c * pix, y + r * pix, pix, pix);
      }
    }
  }

  // キャラの形に沿ったオーラ（真四角にならないよう周囲8方向にずらして重ねる）
  const AURA_OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  function drawAura(rows, x, y, pix, color, alpha, spread) {
    ctx.fillStyle = color;
    for (let i = 0; i < AURA_OFFSETS.length; i++) {
      ctx.globalAlpha = alpha;
      fillCells(rows, x + AURA_OFFSETS[i][0] * spread, y + AURA_OFFSETS[i][1] * spread, pix);
    }
    ctx.globalAlpha = 1;
  }

  function bossDrawY() {
    return BOSS_BASE_Y + Math.sin(bossBob) * 6;
  }

  function drawBoss() {
    let bx = BOSS_X, by = bossDrawY();
    let bodyColor = COLOR_BOSS, eyeColor = COLOR_BOSS_DARK;
    if (bossHurt) { // 被弾中は自キャラと同じ赤で震える
      bodyColor = COLOR_HURT; eyeColor = '#7a1712';
      bx += (Math.random() - 0.5) * 8;
      by += (Math.random() - 0.5) * 8;
    }
    // チャージのオーラ（ボスの形に沿わせる）
    if (bossCharge > 0) {
      drawAura(BOSS, bx, by, BOSS_PIX, '#ffb347', 0.16 * bossCharge, 7);
      drawAura(BOSS, bx, by, BOSS_PIX, '#fff0d0', 0.14 * bossCharge, 3);
    }
    ctx.fillStyle = bodyColor;
    fillCells(BOSS, bx, by, BOSS_PIX);
    // 目の周りを塗りつぶしてから目を描く（ドット欠けを防ぐ）
    ctx.fillRect(bx + 2 * BOSS_PIX, by + 4 * BOSS_PIX, BOSS_PIX * 4, BOSS_PIX * 4);
    ctx.fillRect(bx + 9 * BOSS_PIX, by + 4 * BOSS_PIX, BOSS_PIX * 4, BOSS_PIX * 4);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(bx + 3 * BOSS_PIX, by + 5 * BOSS_PIX, BOSS_PIX * 2, BOSS_PIX * 2);
    ctx.fillRect(bx + 10 * BOSS_PIX, by + 5 * BOSS_PIX, BOSS_PIX * 2, BOSS_PIX * 2);
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
  let bossHurt = false;
  let bossStartLives = MAX_LIVES;  // ボスステージ開始時の生命
  let finalePhase = 'none'; // none|item|charge|fire|explode|done
  let finaleTimer = 0;
  let orb = null;
  let hyperBeam = null;
  let particles = [];
  let flash = 0;
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
  let unlockedAchievements = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '{}');
  let totalAchievementPoints = 0;
  for (const id in unlockedAchievements) totalAchievementPoints += unlockedAchievements[id];

  // URLの印で途中から開始できる（例: ...?boss ／ ...?finale）確認用
  const BOSS_START = STAGES.slice(0, 5).reduce((s, st) => s + st.len, 0); // 100000
  const params = new URLSearchParams(location.search);
  let startDistance = 0;
  if (params.has('boss')) startDistance = BOSS_START;
  else if (params.has('finale')) startDistance = BOSS_START + FINALE_AT - 1000;
  else if (params.has('d')) startDistance = Number(params.get('d')) || 0;
  const isDebugStart = startDistance > 0;

  bestEl.textContent = 'HI ' + String(highScore).padStart(5, '0');

  function unlockAchievement(achId) {
    if (!unlockedAchievements[achId]) {
      const ach = ACHIEVEMENTS[achId];
      unlockedAchievements[achId] = ach.points;
      totalAchievementPoints += ach.points;
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlockedAchievements));
      return true;
    }
    return false;
  }

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
    bossHurt = false;
    bossStartLives = MAX_LIVES;
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

  // ビームがボスに当たっている場所（着弾点）
  function impactPoint() {
    return { x: BOSS_X + BOSS_W * 0.45, y: bossDrawY() + BOSS_H / 2 };
  }

  function spawnImpactParticles(n) {
    const p = impactPoint();
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.6; // 主に左へ散る
      const sp = 0.08 + Math.random() * 0.3;
      particles.push({
        x: p.x + (Math.random() - 0.5) * 16, y: p.y + (Math.random() - 0.5) * 26,
        vx: -Math.abs(Math.cos(a)) * sp, vy: (Math.random() - 0.5) * sp * 1.4,
        life: 260 + Math.random() * 320, age: 0, size: 2 + Math.random() * 5,
        color: Math.random() < 0.5 ? '#ffd9a0' : COLOR_BODY,
      });
    }
  }

  function updateFinale(dt) {
    finaleTimer += dt;
    if (finalePhase === 'item') {
      orb.x -= 0.5 * dt;
      orb.y += (140 - orb.y) * 0.06;
      // 離れていても取得できるように広めに判定
      if (orb.x <= player.x + CHAR_W + 70) { orb = null; finalePhase = 'charge'; finaleTimer = 0; }
    } else if (finalePhase === 'charge') {
      if (finaleTimer > CHARGE_MS) {
        finalePhase = 'fire'; finaleTimer = 0;
        hyperBeam = { reach: 0 };
        flash = 1;
      }
    } else if (finalePhase === 'fire') {
      hyperBeam.reach = Math.min(1, finaleTimer / FIRE_EXTEND_MS);
      if (hyperBeam.reach >= 1 && bossActive) {
        bossHurt = true;              // 爆発するまで被弾演出を継続
        spawnImpactParticles(3);      // 着弾点にパーティクル
      }
      if (finaleTimer >= FIRE_EXPLODE_AT && bossActive) {
        explodeBoss(); bossHurt = false; flash = 1;
      }
      if (finaleTimer >= FIRE_END_MS) { finalePhase = 'explode'; finaleTimer = 0; hyperBeam = null; }
    } else if (finalePhase === 'explode') {
      if (finaleTimer > 1200) { finalePhase = 'done'; }
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
    achPointsEl.textContent = 'PT ' + String(totalAchievementPoints).padStart(5, '0');

    const si = stageInfo(distance);
    if (si.cfg.boss) {
      speed = si.max; // ボスは一定の低速
    } else if (si.dIn < STAGE_RAMP) {
      speed = START_SPEED + (si.max - START_SPEED) * (si.dIn / STAGE_RAMP);
    } else {
      speed = si.max;
    }

    // ステージ切り替わり・クリア検出
    if (si.gIdx !== currentStageIndex) {
      // 前のステージをクリアしたかチェック
      if (currentStageIndex >= 0) {
        const prevCycle = Math.floor(currentStageIndex / STAGES.length);
        const prevIdx = currentStageIndex % STAGES.length;
        // 最初のサイクル（cycle 0）のみ実績として記録
        if (prevCycle === 0) {
          const stageKeys = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'bossClear'];
          if (prevIdx < stageKeys.length && stageKeys[prevIdx] !== 'bossClear') {
            unlockAchievement(stageKeys[prevIdx]);
          } else if (prevIdx === 5) { // ボスステージを出るとき
            unlockAchievement('bossClear');
            if (lives === bossStartLives) unlockAchievement('bossPerfect');
          }
        }
      }
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
        bossStartLives = lives; // ボス開始時の生命を記録
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

    // 決着アイテム（自キャラと同じオレンジ・大きめ）
    if (orb) {
      const og = ctx.createRadialGradient(orb.x, orb.y, 2, orb.x, orb.y, 34);
      og.addColorStop(0, '#fffaf0');
      og.addColorStop(0.35, '#ffb347');
      og.addColorStop(0.65, 'rgba(245,124,43,0.7)');
      og.addColorStop(1, 'rgba(245,124,43,0)');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(orb.x, orb.y, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLOR_BODY;
      ctx.beginPath(); ctx.arc(orb.x, orb.y, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath(); ctx.arc(orb.x, orb.y, 8, 0, Math.PI * 2); ctx.fill();
    }

    // 必殺ハイパービーム（暖色・発射口は「）」・着弾はなめらかな光球）
    if (hyperBeam) {
      const ox = player.x + CHAR_W, oy = player.y + CHAR_H / 2;
      const tp = impactPoint();
      const dx = tp.x - ox, dy = tp.y - oy;
      const ang = Math.atan2(dy, dx);
      const full = Math.hypot(dx, dy);
      const len = Math.max(1, full * hyperBeam.reach);
      const flick = 0.9 + 0.1 * Math.sin(finaleTimer * 0.05);

      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(ang);

      // 発射口が細く、着弾側が太い先細り形状
      function beamPath(h0, h1) {
        ctx.beginPath();
        ctx.moveTo(0, -h0 / 2);
        ctx.quadraticCurveTo(h0 * 0.55, 0, 0, h0 / 2); // 「）」の発射口
        ctx.lineTo(len, h1 / 2);
        ctx.lineTo(len, -h1 / 2);
        ctx.closePath();
      }

      // 外側のグロー
      ctx.globalAlpha = 0.35 * flick;
      ctx.fillStyle = COLOR_BODY;
      beamPath(30, 62); ctx.fill();
      // 中間
      ctx.globalAlpha = 0.85;
      const gm = ctx.createLinearGradient(0, -22, 0, 22);
      gm.addColorStop(0, 'rgba(245,124,43,0.5)');
      gm.addColorStop(0.5, '#ffb347');
      gm.addColorStop(1, 'rgba(245,124,43,0.5)');
      ctx.fillStyle = gm;
      beamPath(18, 44); ctx.fill();
      // 芯
      ctx.globalAlpha = 1;
      const gc = ctx.createLinearGradient(0, -11, 0, 11);
      gc.addColorStop(0, 'rgba(255,240,210,0.7)');
      gc.addColorStop(0.5, '#fffaf0');
      gc.addColorStop(1, 'rgba(255,240,210,0.7)');
      ctx.fillStyle = gc;
      beamPath(9, 22); ctx.fill();

      // 着弾のなめらかな光球（放射グラデーションで境目を消す）
      const R = 46 * flick;
      const rg = ctx.createRadialGradient(len, 0, 2, len, 0, R);
      rg.addColorStop(0, 'rgba(255,255,255,0.95)');
      rg.addColorStop(0.35, 'rgba(255,205,120,0.75)');
      rg.addColorStop(0.7, 'rgba(245,124,43,0.35)');
      rg.addColorStop(1, 'rgba(245,124,43,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(len, 0, R, 0, Math.PI * 2); ctx.fill();

      ctx.restore();
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

    // チャージ中のオーラ（自キャラの形に沿わせる）
    if (finalePhase === 'charge') {
      const pulse = 0.55 + 0.45 * Math.sin(finaleTimer * 0.02);
      const rows = BODY_ROWS.concat(legs);
      drawAura(rows, player.x, player.y, PIX, COLOR_BODY, 0.18 * pulse, 9);
      drawAura(rows, player.x, player.y, PIX, '#ffb347', 0.20 * pulse, 5);
      drawAura(rows, player.x, player.y, PIX, '#fff0d0', 0.22 * pulse, 2);
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

  achPointsEl.textContent = 'PT ' + String(totalAchievementPoints).padStart(5, '0');
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
