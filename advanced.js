document.addEventListener('DOMContentLoaded', () => {
  // Config for Advanced Mode (8x8)
  const GRID_SIZE = 8;
  const CELL_SIZE = 80;
  const GAP_SIZE = 4;
  const STEP = CELL_SIZE + GAP_SIZE; // Total pixels per tile jump
  const TRAIN_SIZE_MULT = 0.6; // Train size relative to CELL_SIZE

  // DOM Elements
  const grid = document.getElementById('grid');
  const trackLayer = document.getElementById('trackLayer');
  const passengerLayer = document.getElementById('passengerLayer');
  const trainEl = document.getElementById('train');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const levelDisplay = document.getElementById('levelDisplay');

  const btnPlay = document.getElementById('btnPlay');
  const btnStop = document.getElementById('btnStop');
  const btnClear = document.getElementById('btnClear');
  
  const audioMove = document.getElementById('audioMove');
  const audioWhistle = document.getElementById('audioWhistle');

  const btnSettings = document.getElementById('btnSettings');
  const settingsModal = document.getElementById('settingsModal');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnTurtle = document.getElementById('btnTurtle');
  const btnHare = document.getElementById('btnHare');
  const btnSoundOff = document.getElementById('btnSoundOff');
  const btnSoundOn = document.getElementById('btnSoundOn');

  const btnLogicOff = document.getElementById('btnLogicOff');
  const btnLogicOn = document.getElementById('btnLogicOn');

  // Game State
  let queue = [];
  let isPlaying = false;
  let isStopped = false;
  let level = 1;
  let isFast = false;
  let isSoundOn = true;
  let isLogicOn = false;

  // Directions: 0=Up, 1=Right, 2=Down, 3=Left
  let trainState = {
    x: 0,
    y: 7, // Bottom left of 8x8 is (0,7)
    dir: 0, // facing up
    rotation: 0 
  };

  let passengers = [];
  let boulders = [];

  const BOULDER_SVG = `<svg viewBox="0 0 80 80" width="100%" height="100%">
    <path d="M 20 60 Q 30 30 50 50 Q 70 70 40 75 Q 15 70 20 60 Z" fill="#64748b" stroke="#475569" stroke-width="2"/>
    <path d="M 40 55 Q 50 20 70 40 Q 80 65 60 70 Q 30 65 40 55 Z" fill="#94a3b8" stroke="#64748b" stroke-width="2"/>
    <path d="M 10 50 Q 20 20 40 35 Q 30 60 15 55 Z" fill="#475569" stroke="#334155" stroke-width="2"/>
  </svg>`;

  // Init grid visuals
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    grid.appendChild(cell);
  }

  // --- HORIZONTAL WORKSPACE SETUP ---
  const hwSequenceContainer = document.getElementById('hwSequenceContainer');
  const hwPlaceholder = document.getElementById('hwPlaceholder');
  const paletteCategories = document.querySelectorAll('.hw-category-palette');
  const logicCategory = document.getElementById('logicCategory');

  function updatePlaceholder() {
    const hasBlocks = Array.from(hwSequenceContainer.children).some(child => child.classList.contains('seq-block'));
    if (!hasBlocks) {
      hwPlaceholder.style.display = 'block';
    } else {
      hwPlaceholder.style.display = 'none';
    }
  }

  function clearWorkspace() {
    Array.from(hwSequenceContainer.children).forEach(child => {
      if (child.id !== 'hwPlaceholder') child.remove();
    });
    updatePlaceholder();
  }

  // Initialize Sortable on Palette Categories
  paletteCategories.forEach(category => {
    new Sortable(category, {
      group: {
        name: 'shared',
        pull: 'clone',
        put: false
      },
      sort: false,
      animation: 150
    });
  });

  // Initialize Sortable on Main Workspace and nested wrappers
  function initSortable(container) {
    new Sortable(container, {
      group: 'shared',
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      filter: '.editable-num',
      preventOnFilter: false,
      onAdd: function (evt) {
        const item = evt.item;
        item.classList.remove('palette-block');
        item.classList.add('seq-block');
        item.removeAttribute('title');
        
        // If the item is a loop wrapper, we need to initialize Sortable on its internal container
        if (item.classList.contains('loop-wrapper-block')) {
          const innerContainer = item.querySelector('.nested-sortable');
          if (innerContainer) {
            initSortable(innerContainer);
          }
        }
        
        updatePlaceholder();
      },
      onRemove: updatePlaceholder,
      onUpdate: updatePlaceholder
    });
  }

  initSortable(hwSequenceContainer);

  // Handle block deletion on click
  hwSequenceContainer.addEventListener('click', (e) => {
    // Do not trigger delete if clicking directly on the drop zone empty space or editable number
    if (e.target.classList.contains('nested-sortable')) return;
    if (e.target.classList.contains('editable-num')) return;
    
    const block = e.target.closest('.seq-block');
    if (!block) return;
    
    // If it's a loop block, only delete if clicking the header 
    if (block.classList.contains('loop-wrapper-block')) {
       if (e.target.classList.contains('loop-header') || e.target === block) {
         block.remove();
         updatePlaceholder();
       }
    } else {
       block.remove();
       updatePlaceholder();
    }
  });

  // Extract AST from custom horizontal workspace
  function generateASTFromWorkspace() {
    
    function parseContainer(container) {
      let nodes = [];
      const blocks = Array.from(container.children);
      
      for (let block of blocks) {
        if (!block.classList.contains('seq-block')) continue;
        
        let type = block.dataset.type;
        
        if (type === 'straight') nodes.push({ type: 'straight' });
        else if (type === 'left') nodes.push({ type: 'left' });
        else if (type === 'right') nodes.push({ type: 'right' });
        else if (type === 'sound') nodes.push({ type: 'sound' });
        else if (type === 'loop_wrapper') {
          let times = 3; 
          const numEl = block.querySelector('.editable-num');
          if (numEl) {
             const parsed = parseInt(numEl.textContent, 10);
             if (!isNaN(parsed)) times = parsed;
          }
          const innerContainer = block.querySelector('.nested-sortable');
          let loopBody = innerContainer ? parseContainer(innerContainer) : [];
          nodes.push({ type: 'loop', times: times, body: loopBody });
        }
        else if (type === 'if_boulder') {
          let condition = 'boulder_ahead';
          const innerContainer = block.querySelector('.nested-sortable');
          let thenBranch = innerContainer ? parseContainer(innerContainer) : [];
          nodes.push({ type: 'if', condition: condition, thenBranch: thenBranch, elseBranch: [] });
        }
      }
      return nodes;
    }

    return parseContainer(hwSequenceContainer);
  }

  // --- GAME LOGIC ---

  function setupLevel() {
    trainState = { x: 0, y: GRID_SIZE - 1, dir: 0, rotation: 0 };
    updateTrainTransform(0);
    trainEl.classList.remove('error');

    trackLayer.innerHTML = '';
    passengerLayer.innerHTML = '';
    passengers = [];
    boulders = [];

    const levelData = window.LEVELS.advanced[level] || [];
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
    p.innerHTML = `<svg viewBox="0 0 80 80" width="100%" height="100%">
      <rect x="4" y="24" width="40" height="6" rx="2" fill="#94a3b8" stroke="#64748b" stroke-width="1"/>
      <rect x="8" y="12" width="32" height="12" fill="#fef08a" stroke="#ca8a04" stroke-width="1.5"/>
      <path d="M 4 12 L 24 2 L 44 12 Z" fill="#dc2626" stroke="#991b1b" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="24" cy="8" r="2.5" fill="#ffffff" stroke="#991b1b" stroke-width="1"/>
      <line x1="24" y1="8" x2="24" y2="6.5" stroke="#991b1b" stroke-width="0.5"/>
      <line x1="24" y1="8" x2="25.5" y2="8" stroke="#991b1b" stroke-width="0.5"/>
      <rect x="20" y="16" width="8" height="8" rx="1" fill="#78350f"/>
      <rect x="12" y="16" width="5" height="5" rx="1" fill="#bae6fd" stroke="#0284c7" stroke-width="1"/>
      <rect x="31" y="16" width="5" height="5" rx="1" fill="#bae6fd" stroke="#0284c7" stroke-width="1"/>
    </svg>`;
    p.style.transform = `translate(${x * STEP}px, ${y * STEP}px)`;
    passengerLayer.appendChild(p);
    passengers.push({ x, y, el: p, collected: false });
  }

  function addBoulder(x, y) {
    const b = document.createElement('div');
    b.className = 'passenger boulder'; 
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
      trainEl.style.transition = 'none'; 
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

  const delay = ms => new Promise(res => setTimeout(res, ms));

  async function playQueue() {
    const ast = generateASTFromWorkspace();
    
    if (ast.length === 0 || isPlaying) return;
    isPlaying = true;
    isStopped = false;

    if (isSoundOn && audioMove) {
      audioMove.play().catch(e => console.log('Audio blocked:', e));
    }

    setupLevel(); // clean start before execution
    await delay(300);

    async function executeMovement(cmd) {
      spawnTrack(trainState.x, trainState.y, trainState.rotation, cmd);

      const startState = { x: trainState.x, y: trainState.y, dir: trainState.dir, rotation: trainState.rotation };

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

      const animSpeed = isFast ? 300 : 1000;
      await animateTrain(startState, trainState, cmd, animSpeed);

      if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
        showError("Derailment! Out of rails!");
        trainEl.classList.add('error');
        isStopped = true;
        return; 
      }

      if (boulders.some(b => b.x === nextX && b.y === nextY)) {
        showError("Crashed into boulders! 💥");
        trainEl.classList.add('error');
        isStopped = true;
        return; 
      }

      checkPassengers();
      const gapSpeed = isFast ? 30 : 100;
      await delay(gapSpeed);
    }

    async function executeSound() {
        const pos = getAbsPos(trainState.x, trainState.y, trainState.dir);
        trainEl.style.transition = 'transform 0.15s ease-out';
        trainEl.style.transform = `translate(${pos.x}px, ${pos.y - 15}px) rotate(${trainState.rotation}deg)`;
        setTimeout(() => {
          if (!isStopped) {
            trainEl.style.transition = 'transform 0.15s ease-in';
            trainEl.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${trainState.rotation}deg)`;
          }
        }, 150);

        if (isSoundOn && audioWhistle) {
          audioWhistle.currentTime = 0;
          await new Promise(resolve => {
            audioWhistle.onended = () => { audioWhistle.onended = null; resolve(); };
            audioWhistle.play().catch(e => { console.log('Audio blocked:', e); resolve(); });
            setTimeout(() => { audioWhistle.onended = null; resolve(); }, isFast ? 800 : 2500); 
          });
        } else {
          await delay(isFast ? 300 : 800);
        }
        await delay(100);
    }

    async function executeNode(node) {
      if (isStopped) return;
      
      if (node.type === 'straight' || node.type === 'left' || node.type === 'right') {
         await executeMovement(node.type);
      } else if (node.type === 'sound') {
         await executeSound();
      } else if (node.type === 'loop') {
         for (let i = 0; i < node.times; i++) {
            if (isStopped) break;
            for (let child of node.body) {
               if (isStopped) break;
               await executeNode(child);
            }
         }
      } else if (node.type === 'if') {
         let conditionMet = false;
         if (node.condition === 'boulder_ahead') {
            conditionMet = checkBoulderAhead();
         }
         
         if (conditionMet) {
            for (let child of node.thenBranch) {
               if (isStopped) break;
               await executeNode(child);
            }
         } else if (node.elseBranch && node.elseBranch.length > 0) {
            for (let child of node.elseBranch) {
               if (isStopped) break;
               await executeNode(child);
            }
         }
      }
    }

    // Run interpreter
    for (let node of ast) {
      if (isStopped) break;
      await executeNode(node);
    }

    isPlaying = false;
    if (audioMove) audioMove.pause();

    if (isStopped) {
      isStopped = false;
      setupLevel();
    } else {
      if (!trainEl.classList.contains('error')) {
        const remaining = passengers.filter(p => !p.collected).length;
        if (remaining === 0) {
          showError("Level completed! 🎉");
          level++;
          if (level > 6) level = 1;
          levelDisplay.textContent = level;
          setTimeout(() => setupLevel(), 2000);
        }
      }
    }
  }

  function spawnTrack(x, y, rot, cmd) {
    const existingTracks = trackLayer.querySelectorAll('.track');
    existingTracks.forEach(tr => tr.classList.add('faded'));

    const t = document.createElement('div');
    t.className = 'track';
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

  btnPlay.addEventListener('click', playQueue);
  
  btnStop.addEventListener('click', () => {
    isStopped = true;
    if (audioMove) audioMove.pause();
    if (!isPlaying) {
      setupLevel();
    }
  });

  btnClear.addEventListener('click', () => {
    clearWorkspace();
  });

  // Settings Event Listeners
  if (btnSettings) {
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
      const audioTrack = document.getElementById('audioTrack');
      if (audioTrack) {
        audioTrack.pause();
        audioTrack.currentTime = 0;
      }
      if (audioMove) audioMove.pause();
    });

    btnSoundOn.addEventListener('click', () => {
      isSoundOn = true;
      btnSoundOn.classList.add('active');
      btnSoundOff.classList.remove('active');
      const audioTrack = document.getElementById('audioTrack');
      if (audioTrack) {
        audioTrack.play().catch(e => console.log('Audio playback blocked:', e));
      }
    });

    if (btnLogicOn) {
      btnLogicOn.addEventListener('click', () => {
        isLogicOn = true;
        btnLogicOn.classList.add('active');
        btnLogicOff.classList.remove('active');
        if (logicCategory) logicCategory.style.display = 'flex';
      });
    }

    if (btnLogicOff) {
      btnLogicOff.addEventListener('click', () => {
        isLogicOn = false;
        btnLogicOff.classList.add('active');
        btnLogicOn.classList.remove('active');
        if (logicCategory) logicCategory.style.display = 'none';
      });
    }

    const levelBtns = document.querySelectorAll('.edit-level-btn');
    levelBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        level = parseInt(e.target.dataset.level, 10);
        levelDisplay.textContent = level;
        settingsModal.classList.remove('show');
        clearWorkspace();
        setupLevel();
        window.dispatchEvent(new CustomEvent('levelChanged', { detail: level }));
      });
    });

    const btnPrevLevel = document.getElementById('btnPrevLevel');
    if (btnPrevLevel) {
      btnPrevLevel.addEventListener('click', () => {
        level = level > 1 ? level - 1 : 6;
        levelDisplay.textContent = level;
        clearWorkspace();
        setupLevel();
        window.dispatchEvent(new CustomEvent('levelChanged', { detail: level }));
      });
    }

    const btnNextLevel = document.getElementById('btnNextLevel');
    if (btnNextLevel) {
      btnNextLevel.addEventListener('click', () => {
        level = level < 6 ? level + 1 : 1;
        levelDisplay.textContent = level;
        clearWorkspace();
        setupLevel();
        window.dispatchEvent(new CustomEvent('levelChanged', { detail: level }));
      });
    }
  }

  window.addEventListener('reloadAdvancedLevel', () => {
    setupLevel();
  });

  // Init
  setupLevel();
});
