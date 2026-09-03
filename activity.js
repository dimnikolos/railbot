document.addEventListener('DOMContentLoaded', () => {
  // Config
  const GRID_SIZE = 5;
  const { CELL_SIZE, GAP_SIZE, STEP, TRAIN_SIZE_MULT } = window.CONFIG;

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
  const btnStop = document.getElementById('btnStop');
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
  const audioMove = document.getElementById('audioMove');
  const audioWhistle = document.getElementById('audioWhistle');
  const btnDeleteSingleOff = document.getElementById('btnDeleteSingleOff');
  const btnDeleteSingleOn = document.getElementById('btnDeleteSingleOn');

  // Game State
  let queue = [];
  let isPlaying = false;
  let isStopped = false;
  let level = 1;
  let isFast = false;
  let isSoundOn = false;
  let isDeleteSingleOn = false;

  window.setCurrentLevel = function (lvl) {
    level = lvl;
    levelDisplay.textContent = level;
    stopAndReset(); // this stops any playing and calls setupLevel()
    window.dispatchEvent(new CustomEvent('levelChanged', { detail: level }));
  };

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
  let boulders = []; // array of {x, y, el}

  // Icons for Queue
  const ICONS = window.ASSETS.ICONS;

  const BOULDER_SVG = window.ASSETS.BOULDER_SVG;

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
    boulders = [];

    // Add passengers from global level data
    const levelData = window.LEVELS.normal[level] || [];
    levelData.forEach(item => {
      const type = item.type || 'station';
      if (type === 'station') {
        addPassenger(item.x, item.y);
      } else if (type === 'boulder') {
        addBoulder(item.x, item.y);
      }
    });
  }

  function addPassenger(x, y) {
    const p = document.createElement('div');
    p.className = 'passenger';
    p.innerHTML = window.ASSETS.STATION_SVG;
    p.style.transform = `translate(${x * STEP}px, ${y * STEP}px)`;
    passengerLayer.appendChild(p);
    passengers.push({ x, y, el: p, collected: false });
  }

  function addBoulder(x, y) {
    const b = document.createElement('div');
    b.className = 'passenger boulder'; // reuse passenger class for positioning
    b.innerHTML = BOULDER_SVG;
    b.style.transform = `translate(${x * STEP}px, ${y * STEP}px)`;
    passengerLayer.appendChild(b);
    boulders.push({ x, y, el: b });
  }

  function getAbsPos(x, y, dir) {
    const trainSize = CELL_SIZE * TRAIN_SIZE_MULT;
    const halfSize = trainSize / 2;
    const center = CELL_SIZE / 2;

    let cx, cy;
    if (dir === 0) { cx = center; cy = CELL_SIZE; }
    else if (dir === 1) { cx = 0; cy = center; }
    else if (dir === 2) { cx = center; cy = 0; }
    else if (dir === 3) { cx = CELL_SIZE; cy = center; }

    const offsetX = cx - halfSize;
    const offsetY = cy - halfSize;

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
          if (dir === 0) { cx = tx * STEP + CELL_SIZE; cy = ty * STEP + CELL_SIZE; }
          else if (dir === 1) { cx = tx * STEP; cy = ty * STEP + CELL_SIZE; }
          else if (dir === 2) { cx = tx * STEP; cy = ty * STEP; }
          else if (dir === 3) { cx = tx * STEP + CELL_SIZE; cy = ty * STEP; }
        } else {
          if (dir === 0) { cx = tx * STEP; cy = ty * STEP + CELL_SIZE; }
          else if (dir === 1) { cx = tx * STEP; cy = ty * STEP; }
          else if (dir === 2) { cx = tx * STEP + CELL_SIZE; cy = ty * STEP; }
          else if (dir === 3) { cx = tx * STEP + CELL_SIZE; cy = ty * STEP + CELL_SIZE; }
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

  function simulateQueueTo(targetIndex) {
    if (isPlaying) return;
    setupLevel(); // Reset everything

    const allItems = queueDisplay.querySelectorAll('.queue-item');
    allItems.forEach(item => {
      item.classList.remove('executed');
      item.classList.remove('active');
    });

    for (let i = 0; i <= targetIndex; i++) {
      if (i >= queue.length) break;
      const cmd = queue[i];

      // Spawn track at CURRENT position
      spawnTrack(trainState.x, trainState.y, trainState.rotation, cmd);

      let nextX = trainState.x;
      let nextY = trainState.y;
      let nextDir = trainState.dir;
      let nextRotation = trainState.rotation;

      if (cmd === 'left') {
        nextDir = (trainState.dir + 3) % 4;
        nextRotation -= 90;
      } else if (cmd === 'right') {
        nextDir = (trainState.dir + 1) % 4;
        nextRotation += 90;
      }

      if (nextDir === 0) nextY -= 1;
      else if (nextDir === 1) nextX += 1;
      else if (nextDir === 2) nextY += 1;
      else if (nextDir === 3) nextX -= 1;

      trainState.x = nextX;
      trainState.y = nextY;
      trainState.dir = nextDir;
      trainState.rotation = nextRotation;

      if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
        showError("Derailment! Out of rails!");
        trainEl.classList.add('error');
        updateQueueActive(i);
        updateTrainTransform(0);
        return; // STOP simulation
      }

      if (boulders.some(b => b.x === nextX && b.y === nextY)) {
        showError("Crashed into boulders! 💥");
        trainEl.classList.add('error');
        updateQueueActive(i);
        updateTrainTransform(0);
        return; // STOP simulation
      }

      checkPassengers();
      if (allItems[i]) allItems[i].classList.add('executed');
    }

    updateQueueActive(targetIndex);
    updateTrainTransform(0);
  }

  // Queue logic
  function addToQueue(cmd) {
    if (isPlaying) return;
    queue.push(cmd);

    const q = document.createElement('div');
    q.className = 'queue-item';
    q.innerHTML = ICONS[cmd];

    const delBtn = document.createElement('span');
    delBtn.className = 'delete-x';
    delBtn.innerHTML = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent simulateQueueTo
      const currentItems = Array.from(queueDisplay.querySelectorAll('.queue-item'));
      const idx = currentItems.indexOf(q);
      if (idx > -1) {
        queue.splice(idx, 1);
        q.remove();
        // Re-simulate to the item before the deleted one
        simulateQueueTo(idx - 1);
      }
    });
    q.appendChild(delBtn);

    q.addEventListener('click', () => {
      const currentItems = Array.from(queueDisplay.querySelectorAll('.queue-item'));
      const idx = currentItems.indexOf(q);
      simulateQueueTo(idx);
    });

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
    isStopped = false;

    if (isSoundOn && audioMove) {
      audioMove.play().catch(e => console.log('Audio blocked:', e));
    }

    // Reset executed items
    const allItems = queueDisplay.querySelectorAll('.queue-item');
    allItems.forEach(item => item.classList.remove('executed'));

    setupLevel(); // clean start before execution

    // Slight pause before starting
    await delay(300);

    for (let i = 0; i < queue.length; i++) {
      if (isStopped) {
        isStopped = false;
        setupLevel();
        const allItems = queueDisplay.querySelectorAll('.queue-item');
        allItems.forEach(item => {
          item.classList.remove('executed');
          item.classList.remove('active');
        });
        break;
      }
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

      // Update state
      trainState.x = nextX;
      trainState.y = nextY;
      trainState.dir = nextDir;
      trainState.rotation = nextRotation;

      // Animate smoothly
      const animSpeed = isFast ? 300 : 1000;
      await animateTrain(startState, trainState, cmd, animSpeed);

      // Boundary check AFTER moving
      if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
        showError("Derailment! Out of rails!");
        trainEl.classList.add('error');
        isPlaying = false;
        updateQueueActive(-1);
        return; // STOP execution
      }

      // Boulder check AFTER moving
      if (boulders.some(b => b.x === nextX && b.y === nextY)) {
        showError("Crashed into boulders! 💥");
        trainEl.classList.add('error');
        isPlaying = false;
        updateQueueActive(-1);
        return; // STOP execution
      }

      // Collect Passengers
      checkPassengers();

      // Mark as executed
      const items = queueDisplay.querySelectorAll('.queue-item');
      if (items[i]) items[i].classList.add('executed');

      // Tiny gap between commands
      const gapSpeed = isFast ? 30 : 100;
      await delay(gapSpeed);
    }

    // Finished loop
    updateQueueActive(-1);
    isPlaying = false;
    if (audioMove) audioMove.pause();

    // Check if won
    const remaining = passengers.filter(p => !p.collected).length;
    if (remaining === 0) {
      showError("Level completed! 🎉");
      level = (level + 1) % 6;
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

    let svgPath = window.ASSETS.TRACK_PATHS[cmd] || '';

    tInner.innerHTML = `<svg viewBox="0 0 80 80" width="100%" height="100%">${svgPath}</svg>`;
    t.appendChild(tInner);
    trackLayer.appendChild(t);
  }

  function checkPassengers() {
    passengers.forEach(p => {
      if (!p.collected && p.x === trainState.x && p.y === trainState.y) {
        p.collected = true;
        p.el.classList.add('collected');
        if (isSoundOn && audioWhistle) {
          audioWhistle.currentTime = 0;
          audioWhistle.play().catch(e => console.log('Audio blocked:', e));
        }
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

  function stopAndReset() {
    isStopped = true;
    if (audioMove) audioMove.pause();
    if (!isPlaying) {
      setupLevel();
      const allItems = queueDisplay.querySelectorAll('.queue-item');
      allItems.forEach(item => {
        item.classList.remove('executed');
        item.classList.remove('active');
      });
    }
  }

  btnStop.addEventListener('click', stopAndReset);

  // Settings Event Listeners
  btnSettings.addEventListener('click', () => settingsModal.classList.add('show'));
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.remove('show'));

  const btnResetLevels = document.getElementById('btnResetLevels');
  if (btnResetLevels) {
    btnResetLevels.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset levels to their initial settings?')) {
        if (window.resetLevelsToDefault) {
          window.resetLevelsToDefault();
          location.reload();
        }
      }
    });
  }

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
    if (audioMove) audioMove.pause();
  });

  btnSoundOn.addEventListener('click', () => {
    isSoundOn = true;
    btnSoundOn.classList.add('active');
    btnSoundOff.classList.remove('active');
    audioTrack.play().catch(e => console.log('Audio playback blocked:', e));
  });

  btnDeleteSingleOff.addEventListener('click', () => {
    isDeleteSingleOn = false;
    btnDeleteSingleOff.classList.add('active');
    btnDeleteSingleOn.classList.remove('active');
    document.body.classList.remove('delete-single-mode');
  });

  btnDeleteSingleOn.addEventListener('click', () => {
    isDeleteSingleOn = true;
    btnDeleteSingleOn.classList.add('active');
    btnDeleteSingleOff.classList.remove('active');
    document.body.classList.add('delete-single-mode');
  });

  const btnPrevLevel = document.getElementById('btnPrevLevel');
  if (btnPrevLevel) {
    btnPrevLevel.addEventListener('click', () => {
      level = level > 1 ? level - 1 : 6;
      window.setCurrentLevel(level);
    });
  }

  const btnNextLevel = document.getElementById('btnNextLevel');
  if (btnNextLevel) {
    btnNextLevel.addEventListener('click', () => {
      level = level < 6 ? level + 1 : 1;
      window.setCurrentLevel(level);
    });
  }

  // Coordinates labels
  const labelLayer = document.createElement('div');
  labelLayer.id = 'labelLayer';
  labelLayer.className = 'overlay-layer';
  labelLayer.style.display = 'none'; // Hidden by default
  document.querySelector('.board-container').appendChild(labelLayer);

  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      const lbl = document.createElement('div');
      lbl.className = 'grid-coord-label';
      lbl.style.width = CELL_SIZE + 'px';
      lbl.style.height = CELL_SIZE + 'px';
      lbl.style.left = (x * STEP) + 'px';
      lbl.style.top = (y * STEP) + 'px';
      lbl.textContent = cols[x] + (GRID_SIZE - y);
      labelLayer.appendChild(lbl);
    }
  }

  const btnToggleLabels = document.getElementById('btnToggleLabels');
  if (btnToggleLabels) {
    btnToggleLabels.addEventListener('click', () => {
      if (labelLayer.style.display === 'none') {
        labelLayer.style.display = 'block';
        btnToggleLabels.classList.add('active');
      } else {
        labelLayer.style.display = 'none';
        btnToggleLabels.classList.remove('active');
      }
    });
  }

  // Init
  setupLevel();

  // Responsive Scaling Logic
  const gameContainer = document.querySelector('.game-container');
  function adjustScale() {
    // Determine the minimum width and height needed by the game container un-scaled
    const minWidth = 1408; // Unified app width
    const minHeight = 900; // Unified app height

    const padding = 60; // safe area margin
    const scaleX = window.innerWidth / (minWidth + padding);
    const scaleY = window.innerHeight / (minHeight + padding);
    let scale = Math.min(scaleX, scaleY, 1); // Scale down if needed, but not up above 1

    // Apply transform visually
    gameContainer.style.zoom = scale;
    if (getComputedStyle(gameContainer).zoom === undefined) {
      gameContainer.style.transform = `translateX(-50%) scale(${scale})`;
      gameContainer.style.transformOrigin = 'top center';
    } else {
      gameContainer.style.transform = `translateX(-50%)`;
    }
  }

  window.addEventListener('resize', adjustScale);
  // Call once immediately and once slightly later to account for any font/layout shifts
  adjustScale();
  setTimeout(adjustScale, 100);
});
