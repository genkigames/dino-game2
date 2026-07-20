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

  const HIGH_SCORE_KEY = 'orange-jump-highscore';

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

  const PIX = 5; // pixel size for the character sprite
  const CHAR_COLS = 9;
  const CHAR_ROWS_BODY = BODY_ROWS.length;
  const CHAR_W = CHAR_COLS * PIX;
  const CHAR_H = (CHAR_ROWS_BODY + 2) * PIX;

  function drawSprite(rows2, x, y) {
    const rows = BODY_ROWS.concat(rows2);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '1') {
          const isEye = r === 2 && (c === 2 || c === 6);
          ctx.fillStyle = isEye ? COLOR_DARK : COLOR_BODY;
          ctx.fillRect(x + c * PIX, y + r * PIX, PIX, PIX);
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
    player.y = GROUND_Y - CHAR_H;
    player.vy = 0;
    player.onGround = true;
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
    if (state === 'running' && player.onGround) {
      player.vy = player.jumpVel;
      player.onGround = false;
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

    const px1 = player.x + 4, px2 = player.x + CHAR_W - 4;
    const py1 = player.y + 4, py2 = player.y + CHAR_H;
    for (const ob of obstacles) {
      for (const part of ob.parts) {
        const ox1 = ob.x + part.x;
        const ox2 = ox1 + part.w;
        const oy1 = GROUND_Y - part.h;
        const oy2 = GROUND_Y;
        if (px2 > ox1 && px1 < ox2 && py2 > oy1 && py1 < oy2) {
          endGame();
          return;
        }
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

    let legs;
    if (!player.onGround) {
      legs = LEGS_JUMP;
    } else if (state !== 'running') {
      legs = LEGS_RUN_A;
    } else {
      legs = player.runFrame === 0 ? LEGS_RUN_A : LEGS_RUN_B;
    }
    drawSprite(legs, player.x, player.y);
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
