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

  // 9x8 pixel grid for the character body (top part, shared by all frames)
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

  const PIX = 5; // pixel size for the character sprite
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

  function drawHeart(x, y, filled) {
    const p = 3;
    ctx.fillStyle = filled ? COLOR_HURT : COLOR_HEART_EMPTY;
    for (let r = 0; r < HEART.length; r++) {
      for (let c = 0; c < HEART[r].length; c++) {
        if (HEART[r][c] === '1') {
          ctx.fillRect(x + c * p, y + r * p, p, p);
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
  let speed = 0.42; // px per ms
  const baseSpeed = 0.42;
  let distance = 0;
  let state = 'waiting'; // waiting | running | over
  let lastTime = null;
  let nextObstacleAt = 0;
  let lives = MAX_LIVES;
  let hurtTimer = 0; // >0の間は無敵＆点滅
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);

  bestEl.textContent = 'HI ' + String(highScore).padStart(5, '0');

  function resetGame() {
    obstacles = [];
    clouds = [];
    for (let i = 0; i < 3; i++) {
      clouds.push({ x: Math.random() * W, y: 30 + Math.random() * 60 });
    }
    groundOffset = 0;
    speed = baseSpeed;
    distance = 0;
    lives = MAX_LIVES;
    hurtTimer = 0;
    player.y = GROUND_Y - CHAR_H;
    player.vy = 0;
    player.onGround = true;
    player.jumpsLeft = 2;
    nextObstacleAt = 600 + Math.random() * 400;
    scoreEl.textContent = '00000';
  }

  function spawnObstacle() {
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
    obstacles.push({ x: W + 20, w: totalW, parts, passed: false });
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
    speed = baseSpeed + distance * 0.00002;
    scoreEl.textContent = String(Math.floor(distance / 10)).padStart(5, '0');

    groundOffset = (groundOffset + speed * dt) % 20;

    if (hurtTimer > 0) hurtTimer -= dt;

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

    if (distance > nextObstacleAt) {
      spawnObstacle();
      nextObstacleAt = distance + 400 + Math.random() * 500;
    }

    obstacles.forEach(ob => { ob.x -= speed * dt; });
    obstacles = obstacles.filter(ob => ob.x + ob.w > -10);

    if (hurtTimer <= 0) {
      const px1 = player.x + HITBOX_MX;
      const px2 = player.x + CHAR_W - HITBOX_MX;
      const py1 = player.y + HITBOX_TOP;
      const py2 = player.y + CHAR_H - HITBOX_BOTTOM;
      let hit = false;
      for (const ob of obstacles) {
        for (const part of ob.parts) {
          const ox1 = ob.x + part.x;
          const ox2 = ox1 + part.w;
          const oy1 = GROUND_Y - part.h;
          const oy2 = GROUND_Y;
          if (px2 > ox1 && px1 < ox2 && py2 > oy1 && py1 < oy2) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) {
        lives--;
        if (lives <= 0) {
          endGame();
          return;
        }
        hurtTimer = 1000;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

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

    ctx.fillStyle = COLOR_OBSTACLE;
    obstacles.forEach(ob => {
      ob.parts.forEach(part => {
        ctx.fillRect(ob.x + part.x, GROUND_Y - part.h, part.w, part.h);
      });
    });

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
