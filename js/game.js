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

  const HIGH_SCORE_KEY = 'orange-jump-highscore';
  const MAX_LIVES = 3;

  // ステージ設定（順にステージ1〜5、末尾までいくと先頭に戻る）
  const START_SPEED = 0.42;      // 各ステージの開始スピード
  const STAGE_LEN = 20000;       // 1ステージの距離
  const STAGE_RAMP = 2000;       // 開始から最大スピードに到達するまでの距離
  const SPAWN_START = 2000;      // この距離までは障害物を出さない（＝加速中は安全）
  const SPAWN_END = STAGE_LEN - 1200; // この距離を過ぎたら障害物を出さない（クリア前を安全に）
  const STAGES = [
    { max: 0.52, types: [1] },              // ステージ1
    { max: 0.62, types: [1, 2] },           // ステージ2
    { max: 0.62, types: [1, 2, 3] },        // ステージ3
    { max: 0.82, types: [1] },              // ステージ4
    { max: 0.52, types: [1, 2, 3], dense: true }, // ステージ5（多め）
  ];

  const HEART_ITEM_PIX = 4;      // 流れてくるハートのドットサイズ
  const HEART_ITEM_W = 7 * HEART_ITEM_PIX;
  const HEART_ITEM_H = 6 * HEART_ITEM_PIX;
  const HEART_ITEM_Y = 150;      // ジャンプで届く高さ

  const WALL_W = 14;             // 障害物2（2段ジャンプでしか越えられない壁）
  const WALL_H = 78;

  const FLYER_PIX = 4;           // 障害物3（飛翔物）
  const FLYER_COLS = 13;
  const FLYER_ROWS = 7;
  const FLYER_W = FLYER_COLS * FLYER_PIX;
  const FLYER_H = FLYER_ROWS * FLYER_PIX;
  const FLYER_Y = 92;            // 2段ジャンプの頂点に当たる高さ

  function stageInfo(dist) {
    const n = STAGES.length;
    const idx = Math.floor(dist / STAGE_LEN);
    const cfg = STAGES[idx % n];
    return {
      idx: idx,
      num: (idx % n) + 1,
      max: cfg.max,
      cfg: cfg,
      dIn: dist - idx * STAGE_LEN,
    };
  }

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

  // プテラノドン（左向き・翼の上下2フレーム）
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

  const PIX = 5; // キャラのドットサイズ
  const CHAR_COLS = 9;
  const CHAR_ROWS_BODY = BODY_ROWS.length;
  const CHAR_W = CHAR_COLS * PIX;
  const CHAR_H = (CHAR_ROWS_BODY + 2) * PIX;

  // 当たり判定を見た目より一回り小さくする余白
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
        if (HEART[r][c] === '1') {
          ctx.fillRect(x + c * p, y + r * p, p, p);
        }
      }
    }
  }

  function drawFlyer(x, y) {
    const rows = flyerFrame === 0 ? PTERO_A : PTERO_B;
    ctx.fillStyle = COLOR_OBSTACLE;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === '1') {
          ctx.fillRect(x + c * FLYER_PIX, y + r * FLYER_PIX, FLYER_PIX, FLYER_PIX);
        }
      }
    }
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
  let speed = START_SPEED; // px per ms
  let distance = 0;
  let state = 'waiting'; // waiting | running | over
  let lastTime = null;
  let nextObstacleAt = 0;
  let lives = MAX_LIVES;
  let hurtTimer = 0; // >0の間は無敵＆点滅
  let currentStageIndex = -1;    // 現在のステージ番号(内部)
  let stageHeartSpawnAt = 0;     // このステージでハートを出す距離
  let stageHeartDone = false;    // このステージのハートを出したか
  let heartItem = null;          // 流れてくるハート {x, y}
  let banner = null;             // ステージ表示 {text, x}
  let flyerFrame = 0;
  let flyerAnimTimer = 0;
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);

  bestEl.textContent = 'HI ' + String(highScore).padStart(5, '0');

  function resetGame() {
    obstacles = [];
    clouds = [];
    for (let i = 0; i < 3; i++) {
      clouds.push({ x: Math.random() * W, y: 30 + Math.random() * 60 });
    }
    groundOffset = 0;
    speed = START_SPEED;
    distance = 0;
    lives = MAX_LIVES;
    hurtTimer = 0;
    currentStageIndex = -1;
    stageHeartDone = false;
    heartItem = null;
    banner = null;
    flyerFrame = 0;
    flyerAnimTimer = 0;
    player.y = GROUND_Y - CHAR_H;
    player.vy = 0;
    player.onGround = true;
    player.jumpsLeft = 2;
    nextObstacleAt = SPAWN_START;
    scoreEl.textContent = '00000';
  }

  // 障害物1（群）
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
    const totalW = offsetX - 2;
    obstacles.push({ kind: 'ground', x: W + 20, w: totalW, parts: parts });
  }

  // 障害物2（壁）
  function spawnWall() {
    obstacles.push({
      kind: 'ground', x: W + 20, w: WALL_W,
      parts: [{ x: 0, w: WALL_W, h: WALL_H }],
    });
  }

  // 障害物3（飛翔物）
  function spawnFlyer() {
    obstacles.push({ kind: 'flyer', x: W + 20, y: FLYER_Y, w: FLYER_W });
  }

  function spawnForStage(cfg) {
    const canFly = cfg.types.indexOf(3) >= 0;
    const canWall = cfg.types.indexOf(2) >= 0;
    if (canFly && Math.random() < 0.35) {
      spawnFlyer();
      // 飛翔物は障害物1（群）とだけ同時に出ることがある
      if (Math.random() < 0.5) spawnGroup();
    } else if (canWall && Math.random() < 0.45) {
      spawnWall();
    } else {
      spawnGroup();
    }
  }

  // プレイヤーが障害物に当たっているか
  function hitsObstacle() {
    const px1 = player.x + HITBOX_MX;
    const px2 = player.x + CHAR_W - HITBOX_MX;
    const py1 = player.y + HITBOX_TOP;
    const py2 = player.y + CHAR_H - HITBOX_BOTTOM;
    for (const ob of obstacles) {
      if (ob.kind === 'flyer') {
        const fx1 = ob.x + 1 * FLYER_PIX;
        const fx2 = ob.x + (FLYER_COLS - 2) * FLYER_PIX;
        const fy1 = ob.y + 1 * FLYER_PIX;
        const fy2 = ob.y + 6 * FLYER_PIX;
        if (px2 > fx1 && px1 < fx2 && py2 > fy1 && py1 < fy2) return true;
      } else {
        for (const part of ob.parts) {
          const ox1 = ob.x + part.x;
          const ox2 = ox1 + part.w;
          const oy1 = GROUND_Y - part.h;
          const oy2 = GROUND_Y;
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
    if (finalScore > highScore) {
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

    // ステージに応じたスピード（開始0.42→距離2000で最大→以降維持）
    const si = stageInfo(distance);
    if (si.dIn < STAGE_RAMP) {
      speed = START_SPEED + (si.max - START_SPEED) * (si.dIn / STAGE_RAMP);
    } else {
      speed = si.max;
    }

    // ステージが切り替わったらバナー表示＆このステージのハートを予約
    if (si.idx !== currentStageIndex) {
      currentStageIndex = si.idx;
      banner = { text: 'STAGE ' + si.num, x: W };
      stageHeartDone = false;
      stageHeartSpawnAt = si.idx * STAGE_LEN + 4000 + Math.random() * 10000;
      heartItem = null;
      obstacles = []; // 境界をクリーンにして事故を防ぐ
      nextObstacleAt = si.idx * STAGE_LEN + SPAWN_START + Math.random() * 500;
    }

    groundOffset = (groundOffset + speed * dt) % 20;

    if (hurtTimer > 0) hurtTimer -= dt;

    flyerAnimTimer += dt;
    if (flyerAnimTimer > 180) { flyerAnimTimer = 0; flyerFrame = 1 - flyerFrame; }

    if (banner) {
      banner.x -= speed * dt * 0.5;
      if (banner.x < -450) banner = null;
    }

    clouds.forEach(cl => {
      cl.x -= speed * dt * 0.3;
      if (cl.x < -60) {
        cl.x = W + Math.random() * 100;
        cl.y = 30 + Math.random() * 60;
      }
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
      if (player.runTimer > 100) {
        player.runTimer = 0;
        player.runFrame = 1 - player.runFrame;
      }
    }

    // 障害物の出現（加速中とクリア直前は出さない）
    if (si.dIn >= SPAWN_START && si.dIn <= SPAWN_END && distance > nextObstacleAt) {
      spawnForStage(si.cfg);
      const gap = si.cfg.dense ? (240 + Math.random() * 280) : (420 + Math.random() * 520);
      nextObstacleAt = distance + gap;
    }

    obstacles.forEach(ob => { ob.x -= speed * dt; });
    obstacles = obstacles.filter(ob => ob.x + ob.w > -10);

    // このステージのハートを出す
    if (!stageHeartDone && distance > stageHeartSpawnAt) {
      stageHeartDone = true;
      heartItem = { x: W + 20, y: HEART_ITEM_Y };
    }

    // ハートの移動と取得判定
    if (heartItem) {
      heartItem.x -= speed * dt;
      const hx1 = heartItem.x, hx2 = heartItem.x + HEART_ITEM_W;
      const hy1 = heartItem.y, hy2 = heartItem.y + HEART_ITEM_H;
      const bx1 = player.x, bx2 = player.x + CHAR_W;
      const by1 = player.y, by2 = player.y + CHAR_H;
      if (bx2 > hx1 && bx1 < hx2 && by2 > hy1 && by1 < hy2) {
        if (lives < MAX_LIVES) lives++;
        heartItem = null;
      } else if (heartItem.x + HEART_ITEM_W < -10) {
        heartItem = null;
      }
    }

    if (hurtTimer <= 0 && hitsObstacle()) {
      lives--;
      if (lives <= 0) {
        endGame();
        return;
      }
      hurtTimer = 1000;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 背景に流れるステージ表示（雲と同じ色）
    if (banner) {
      ctx.fillStyle = COLOR_CLOUD;
      ctx.font = 'bold 90px "Courier New", monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(banner.text, banner.x, 115);
    }

    ctx.fillStyle = COLOR_CLOUD;
    clouds.forEach(cl => {
      ctx.fillRect(cl.x, cl.y, 30, 8);
      ctx.fillRect(cl.x + 6, cl.y - 6, 18, 8);
    });

    ctx.fillStyle = COLOR_GROUND;
    ctx.fillRect(0, GROUND_Y, W, 2);
    for (let x = -groundOffset; x < W; x += 20) {
      ctx.fillRect(x, GROUND_Y + 4, 10, 2);
    }

    obstacles.forEach(ob => {
      if (ob.kind === 'flyer') {
        drawFlyer(ob.x, ob.y);
      } else {
        ctx.fillStyle = COLOR_OBSTACLE;
        ob.parts.forEach(part => {
          ctx.fillRect(ob.x + part.x, GROUND_Y - part.h, part.w, part.h);
        });
      }
    });

    // 流れてくる回復ハート
    if (heartItem) {
      drawHeart(heartItem.x, heartItem.y, true, HEART_ITEM_PIX);
    }

    // 左上にハートを表示
    for (let i = 0; i < MAX_LIVES; i++) {
      drawHeart(14 + i * 26, 14, i < lives);
    }

    let legs;
    if (!player.onGround) {
      legs = LEGS_JUMP;
    } else if (state !== 'running') {
      legs = LEGS_RUN_A;
    } else {
      legs = player.runFrame === 0 ? LEGS_RUN_A : LEGS_RUN_B;
    }

    let drawX = player.x, drawY = player.y;
    let bodyColor = COLOR_BODY;
    let visible = true;
    if (hurtTimer > 0) {
      visible = Math.floor(hurtTimer / 80) % 2 === 0; // 点滅
      if (hurtTimer > 600) {
        bodyColor = COLOR_HURT; // 一瞬赤く
        drawX += (Math.random() - 0.5) * 6; // ブレ
        drawY += (Math.random() - 0.5) * 6;
      }
    }
    if (visible) drawSprite(legs, drawX, drawY, bodyColor);

    // 画面下部のステージ進捗バー
    const baseIdx = Math.max(0, currentStageIndex);
    const prog = Math.min(1, Math.max(0, (distance - baseIdx * STAGE_LEN) / STAGE_LEN));
    const barY = H - 5;
    ctx.fillStyle = COLOR_HEART_EMPTY;
    ctx.fillRect(0, barY, W, 3);
    ctx.fillStyle = COLOR_BODY;
    ctx.fillRect(0, barY, W * prog, 3);
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

  // iOSのダブルタップ／連続タップによるズームを抑止
  document.addEventListener('touchend', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());

  resetGame();
})();
