document.addEventListener('DOMContentLoaded', () => {
  // Config
  const GRID_SIZE = 5;
  const CELL_SIZE = 80;
  const GAP_SIZE = 4;
  const STEP = CELL_SIZE + GAP_SIZE; // Total pixels per tile jump
  const TRAIN_SIZE_MULT = 0.3; // Train size relative to CELL_SIZE (was 0.1)

  // DOM Elements
  const grid = document.getElementById('grid');
  const trackLayer = document.getElementById('trackLayer');
  const passengerLayer = document.getElementById('passengerLayer');
  const trainEl = document.getElementById('train');
  const queueDisplay = document.getElementById('queueDisplay');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  const btnStraight = document.getElementById('btnStraight');
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnPlay = document.getElementById('btnPlay');
  const btnClear = document.getElementById('btnClear');
  const levelDisplay = document.getElementById('levelDisplay');

  // Settings DOM
  const btnSettings = document.getElementById('btnSettings');
  const settingsModal = document.getElementById('settingsModal');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnTurtle = document.getElementById('btnTurtle');
  const btnHare = document.getElementById('btnHare');
  const btnSoundOff = document.getElementById('btnSoundOff');
  const btnSoundOn = document.getElementById('btnSoundOn');
  const audioTrack = document.getElementById('audioTrack');

  // Game State
  let queue = [];
  let isPlaying = false;
  let level = 1;
  let isFast = false;
  let isSoundOn = false;

  // Directions: 0=Up, 1=Right, 2=Down, 3=Left
  // Wait, in standard 2D top-down CSS, Up is -Y.
  // The train starts at bottom-left (0, 4) facing Right (1) or Up (0)?
  // Let's start at bottom-left facing Up (0).
  let trainState = {
    x: 0,
    y: 4,
    dir: 0, // 0: up, 1: right, 2: down, 3: left
    rotation: 0 // continuous rotation for smooth tweening
  };

  let passengers = []; // array of {x, y, el}

  // Icons for Queue
  const ICONS = {
    'straight': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20V4m-5 5l5-5 5 5"/></svg>',
    'left': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 10L5 6l4-4"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 6h8a6 6 0 016 6v7"/></svg>',
    'right': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4-4-4-4"/><path stroke-linecap="round" stroke-linejoin="round" d="M19 6h-8a6 6 0 00-6 6v7"/></svg>'
  };

  // Init grid visuals
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    grid.appendChild(cell);
  }

  // Setup Level
  function setupLevel() {
    trainState = { x: 0, y: 4, dir: 0, rotation: 0 };
    updateTrainTransform(0);
    trainEl.classList.remove('error');

    trackLayer.innerHTML = '';
    passengerLayer.innerHTML = '';
    passengers = [];

    // Add some passengers depending on level (placeholder positions)
    if (level === 1) {
      addPassenger(0, 1);
      addPassenger(3, 1);
    } else if (level === 2) {
      addPassenger(1, 2);
      addPassenger(4, 0);
    } else {
      addPassenger(2, 2);
      addPassenger(4, 4);
    }
  }

  function addPassenger(x, y) {
    const p = document.createElement('div');
    p.className = 'passenger';
    p.textContent = '🧍';
    p.style.transform = `translate(${x * STEP}px, ${y * STEP}px)`;
    passengerLayer.appendChild(p);
    passengers.push({ x, y, el: p, collected: false });
  }

  function getAbsPos(x, y, dir) {
    const trainSize = CELL_SIZE * TRAIN_SIZE_MULT;
    const centerOffset = (CELL_SIZE - trainSize) / 2;
    let offsetX = 0, offsetY = 0;
    if (dir === 0) { offsetX = centerOffset; offsetY = CELL_SIZE - trainSize; }
    else if (dir === 1) { offsetX = 0; offsetY = centerOffset; }
    else if (dir === 2) { offsetX = centerOffset; offsetY = 0; }
    else if (dir === 3) { offsetX = CELL_SIZE - trainSize; offsetY = centerOffset; }
    return { x: x * STEP + offsetX, y: y * STEP + offsetY };
  }

  function updateTrainTransform(animDurationMs = 0) {
    trainEl.style.transition = animDurationMs > 0 ? `transform ${animDurationMs}ms ease-in-out` : 'none';
    const pos = getAbsPos(trainState.x, trainState.y, trainState.dir);
    trainEl.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${trainState.rotation}deg)`;
  }

  function animateTrain(startState, endState, cmd, durationMs) {
    return new Promise(resolve => {
      trainEl.style.transition = 'none'; // Disable CSS transitions for JS animation
      const trainSize = CELL_SIZE * TRAIN_SIZE_MULT;
      const startAbs = getAbsPos(startState.x, startState.y, startState.dir);
      const endAbs = getAbsPos(endState.x, endState.y, endState.dir);
      const startRot = startState.rotation;
      const endRot = endState.rotation;

      let cx, cy, startAngle, endAngle, R;
      const tx = startState.x;
      const ty = startState.y;
      const dir = startState.dir;

      if (cmd === 'right' || cmd === 'left') {
        if (cmd === 'right') {
          if (dir === 0) { cx = tx * STEP + STEP; cy = ty * STEP + STEP; }
          else if (dir === 1) { cx = tx * STEP; cy = ty * STEP + STEP; }
          else if (dir === 2) { cx = tx * STEP; cy = ty * STEP; }
          else if (dir === 3) { cx = tx * STEP + STEP; cy = ty * STEP; }
        } else {
          if (dir === 0) { cx = tx * STEP; cy = ty * STEP + STEP; }
          else if (dir === 1) { cx = tx * STEP; cy = ty * STEP; }
          else if (dir === 2) { cx = tx * STEP + STEP; cy = ty * STEP; }
          else if (dir === 3) { cx = tx * STEP + STEP; cy = ty * STEP + STEP; }
        }
        const sxCenter = startAbs.x + trainSize / 2;
        const syCenter = startAbs.y + trainSize / 2;
        startAngle = Math.atan2(syCenter - cy, sxCenter - cx);
        endAngle = cmd === 'right' ? startAngle + Math.PI / 2 : startAngle - Math.PI / 2;
        R = Math.hypot(sxCenter - cx, syCenter - cy);
      }

      const startTime = performance.now();

      function step(currentTime) {
        const elapsed = currentTime - startTime;
        let t = elapsed / durationMs;
        if (t > 1) t = 1;

        // ease-in-out curve
        const pt = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        let curX, curY;
        if (cmd === 'straight') {
          curX = startAbs.x + (endAbs.x - startAbs.x) * pt;
          curY = startAbs.y + (endAbs.y - startAbs.y) * pt;
        } else {
          const currentAngle = startAngle + (endAngle - startAngle) * pt;
          curX = cx + R * Math.cos(currentAngle) - trainSize / 2;
          curY = cy + R * Math.sin(currentAngle) - trainSize / 2;
        }

        const curRot = startRot + (endRot - startRot) * pt;
        trainEl.style.transform = `translate(${curX}px, ${curY}px) rotate(${curRot}deg)`;

        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  // Queue logic
  function addToQueue(cmd) {
    if (isPlaying) return;
    queue.push(cmd);

    const q = document.createElement('div');
    q.className = 'queue-item';
    q.innerHTML = ICONS[cmd];
    queueDisplay.appendChild(q);
    queueDisplay.scrollLeft = queueDisplay.scrollWidth;
  }

  function clearQueue() {
    if (isPlaying) return;
    queue = [];
    queueDisplay.innerHTML = '';
    setupLevel(); // Reset train position
  }

  function updateQueueActive(activeIndex) {
    const items = queueDisplay.querySelectorAll('.queue-item');
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    if (activeIndex > -1 && items[activeIndex]) {
      // Scroll the active item into view
      const itemLeft = items[activeIndex].offsetLeft;
      queueDisplay.scrollLeft = itemLeft - queueDisplay.clientWidth / 2;
    }
  }

  // Delay promise
  const delay = ms => new Promise(res => setTimeout(res, ms));

  // The Game Engine Loop
  async function playQueue() {
    if (queue.length === 0 || isPlaying) return;
    isPlaying = true;
    setupLevel(); // clean start before execution

    // Slight pause before starting
    await delay(300);

    for (let i = 0; i < queue.length; i++) {
      const cmd = queue[i];
      updateQueueActive(i); // highlight active

      // Spawn track at CURRENT position
      spawnTrack(trainState.x, trainState.y, trainState.rotation, cmd);

      // Save old state
      const startState = { x: trainState.x, y: trainState.y, dir: trainState.dir, rotation: trainState.rotation };

      // Calculate next state
      let nextX = trainState.x;
      let nextY = trainState.y;
      let nextDir = trainState.dir;
      let nextRotation = trainState.rotation;

      // Arc mechanics: change direction first
      if (cmd === 'left') {
        nextDir = (trainState.dir + 3) % 4; // -1 wrapping
        nextRotation -= 90;
      } else if (cmd === 'right') {
        nextDir = (trainState.dir + 1) % 4;
        nextRotation += 90;
      }

      // Move Forward based on NEW direction (creating the arc)
      if (nextDir === 0) nextY -= 1;      // Up
      else if (nextDir === 1) nextX += 1; // Right
      else if (nextDir === 2) nextY += 1; // Down
      else if (nextDir === 3) nextX -= 1; // Left

      // Boundary check BEFORE moving
      if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
        showError("Έξοδος από τις ράγες!");
        trainEl.classList.add('error');
        isPlaying = false;
        updateQueueActive(-1);
        return; // STOP execution
      }

      // Update state
      trainState.x = nextX;
      trainState.y = nextY;
      trainState.dir = nextDir;
      trainState.rotation = nextRotation;

      // Animate smoothly
      const animSpeed = isFast ? 300 : 1000;
      await animateTrain(startState, trainState, cmd, animSpeed);

      // Collect Passengers
      checkPassengers();
      
      // Tiny gap between commands
      const gapSpeed = isFast ? 30 : 100;
      await delay(gapSpeed); 
    }

    // Finished loop
    updateQueueActive(-1);
    isPlaying = false;

    // Check if won
    const remaining = passengers.filter(p => !p.collected).length;
    if (remaining === 0) {
      showError("Επίπεδο Ολοκληρώθηκε! 🎉");
      level++;
      levelDisplay.textContent = level;
      setTimeout(() => clearQueue(), 2000);
    }
  }

  function spawnTrack(x, y, rot, cmd) {
    // Fade all existing tracks
    const existingTracks = trackLayer.querySelectorAll('.track');
    existingTracks.forEach(tr => tr.classList.add('faded'));

    const t = document.createElement('div');
    t.className = 'track';
    // Offset rotation by 90 so 0 (Up) becomes vertical.
    t.style.transform = `translate(${x * STEP}px, ${y * STEP}px) rotate(${rot + 90}deg)`;
    const tInner = document.createElement('div');
    tInner.className = 'track-inner';

    let svgPath = '';
    if (cmd === 'straight') {
      svgPath = `
        <path d="M 0 40 L 80 40" stroke="#78350f" stroke-width="20" stroke-dasharray="6 8" fill="none" />
        <path d="M 0 32 L 80 32 M 0 48 L 80 48" stroke="#9ca3af" stroke-width="3" fill="none" />
      `;
    } else if (cmd === 'right') {
      svgPath = `
        <path d="M 80 40 C 58 40, 40 22, 40 0" stroke="#78350f" stroke-width="20" stroke-dasharray="6 8" fill="none" />
        <path d="M 80 32 C 62.4 32, 48 17.6, 48 0 M 80 48 C 53.5 48, 32 26.5, 32 0" stroke="#9ca3af" stroke-width="3" fill="none" />
      `;
    } else if (cmd === 'left') {
      svgPath = `
        <path d="M 80 40 C 58 40, 40 58, 40 80" stroke="#78350f" stroke-width="20" stroke-dasharray="6 8" fill="none" />
        <path d="M 80 48 C 62.4 48, 48 62.4, 48 80 M 80 32 C 53.5 32, 32 53.5, 32 80" stroke="#9ca3af" stroke-width="3" fill="none" />
      `;
    }

    tInner.innerHTML = `<svg viewBox="0 0 80 80" width="100%" height="100%">${svgPath}</svg>`;
    t.appendChild(tInner);
    trackLayer.appendChild(t);
  }

  function checkPassengers() {
    passengers.forEach(p => {
      if (!p.collected && p.x === trainState.x && p.y === trainState.y) {
        p.collected = true;
        p.el.classList.add('collected');
      }
    });
  }

  function showError(msg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // Event Listeners
  btnStraight.addEventListener('click', () => addToQueue('straight'));
  btnLeft.addEventListener('click', () => addToQueue('left'));
  btnRight.addEventListener('click', () => addToQueue('right'));
  btnClear.addEventListener('click', clearQueue);
  btnPlay.addEventListener('click', playQueue);

  // Settings Event Listeners
  btnSettings.addEventListener('click', () => settingsModal.classList.add('show'));
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.remove('show'));

  btnTurtle.addEventListener('click', () => {
    isFast = false;
    btnTurtle.classList.add('active');
    btnHare.classList.remove('active');
  });

  btnHare.addEventListener('click', () => {
    isFast = true;
    btnHare.classList.add('active');
    btnTurtle.classList.remove('active');
  });

  btnSoundOff.addEventListener('click', () => {
    isSoundOn = false;
    btnSoundOff.classList.add('active');
    btnSoundOn.classList.remove('active');
    audioTrack.pause();
    audioTrack.currentTime = 0;
  });

  btnSoundOn.addEventListener('click', () => {
    isSoundOn = true;
    btnSoundOn.classList.add('active');
    btnSoundOff.classList.remove('active');
    audioTrack.play().catch(e => console.log('Audio playback blocked:', e));
  });

  // Init
  setupLevel();

  // Responsive Scaling Logic
  const gameContainer = document.querySelector('.game-container');
  function adjustScale() {
    // Determine the minimum width and height needed by the game container un-scaled
    const minWidth = 480;  // 416 board + padding
    const minHeight = 650; // header + board + controls + padding
    
    const padding = 20; // safe area margin
    const scaleX = window.innerWidth / (minWidth + padding);
    const scaleY = window.innerHeight / (minHeight + padding);
    let scale = Math.min(scaleX, scaleY, 1); // Scale down if needed, but not up above 1
    
    // Apply transform visually
    gameContainer.style.transform = `scale(${scale})`;
  }

  window.addEventListener('resize', adjustScale);
  // Call once immediately and once slightly later to account for any font/layout shifts
  adjustScale();
  setTimeout(adjustScale, 100);
});
