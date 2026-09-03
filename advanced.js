document.addEventListener('DOMContentLoaded', () => {
  // Config for Advanced Mode (8x8)
  const GRID_SIZE = 8;
  const { CELL_SIZE, GAP_SIZE, STEP, TRAIN_SIZE_MULT } = window.CONFIG;

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

  const BOULDER_SVG = window.ASSETS.BOULDER_SVG;

  // Init grid visuals
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    grid.appendChild(cell);
  }

  // --- BLOCKLY WORKSPACE SETUP ---

  // Custom Blocks Definition
  Blockly.Blocks['move_straight'] = {
    init: function () {
      this.jsonInit({
        "type": "move_straight",
        "message0": "⬆️",
        "previousStatement": null,
        "nextStatement": null,
        "colour": 230,
        "tooltip": "Move Forward"
      });
    }
  };

  Blockly.Blocks['turn_left'] = {
    init: function () {
      this.jsonInit({
        "type": "turn_left",
        "message0": "⬅️",
        "previousStatement": null,
        "nextStatement": null,
        "colour": 230,
        "tooltip": "Turn Left"
      });
    }
  };

  Blockly.Blocks['turn_right'] = {
    init: function () {
      this.jsonInit({
        "type": "turn_right",
        "message0": "➡️",
        "previousStatement": null,
        "nextStatement": null,
        "colour": 230,
        "tooltip": "Turn Right"
      });
    }
  };

  Blockly.Blocks['action_sound'] = {
    init: function () {
      this.jsonInit({
        "type": "action_sound",
        "message0": "🚂🎵",
        "previousStatement": null,
        "nextStatement": null,
        "colour": 330,
        "tooltip": "Whistle"
      });
    }
  };

  Blockly.Blocks['event_start'] = {
    init: function () {
      this.jsonInit({
        "type": "event_start",
        "message0": "▶️ Start",
        "nextStatement": null,
        "colour": 120,
        "tooltip": "Attach blocks here to play"
      });
      this.setDeletable(false);
    }
  };

  Blockly.Blocks['controls_if_boulder'] = {
    init: function () {
      this.jsonInit({
        "type": "controls_if_boulder",
        "message0": "🪨❓",
        "message1": "%1",
        "args1": [{ "type": "input_statement", "name": "DO" }],
        "message2": "🚫🪨",
        "message3": "%1",
        "args3": [{ "type": "input_statement", "name": "ELSE" }],
        "previousStatement": null,
        "nextStatement": null,
        "colour": 30,
        "tooltip": "If Boulder Ahead, Else"
      });
    }
  };

  const toolboxConfig = {
    "kind": "categoryToolbox",
    "contents": [
      {
        "kind": "category",
        "name": "Movement",
        "colour": "230",
        "contents": [
          { "kind": "block", "type": "move_straight" },
          { "kind": "block", "type": "turn_left" },
          { "kind": "block", "type": "turn_right" }
        ]
      },
      {
        "kind": "category",
        "name": "Actions",
        "colour": "330",
        "contents": [
          { "kind": "block", "type": "action_sound" }
        ]
      },
      {
        "kind": "category",
        "name": "Loops",
        "colour": "120",
        "contents": [
          {
            "kind": "block",
            "type": "controls_repeat_ext",
            "inputs": {
              "TIMES": {
                "shadow": {
                  "type": "math_number",
                  "fields": { "NUM": 3 }
                }
              }
            }
          }
        ]
      },
      {
        "kind": "category",
        "name": "Logic",
        "colour": "30",
        "hidden": "true",
        "contents": [
          { "kind": "block", "type": "controls_if_boulder" }
        ]
      }
    ]
  };

  const workspace = Blockly.inject('blocklyDiv', {
    toolbox: toolboxConfig,
    renderer: 'zelos',
    horizontalLayout: false,    // Κάθετη διάταξη toolbox
    toolboxPosition: 'start'    // Toolbox στα αριστερά
  });

  function createStartBlock() {
    const startBlock = workspace.newBlock('event_start');
    startBlock.initSvg();
    startBlock.render();
    startBlock.moveBy(20, 20);
  }

  createStartBlock();

  function clearWorkspace() {
    workspace.clear();
    createStartBlock();
  }

  function generateASTFromBlock(block) {
    let nodes = [];
    while (block) {
      if (block.type === 'move_straight') nodes.push({ type: 'straight', el: block.id });
      else if (block.type === 'turn_left') nodes.push({ type: 'left', el: block.id });
      else if (block.type === 'turn_right') nodes.push({ type: 'right', el: block.id });
      else if (block.type === 'action_sound') nodes.push({ type: 'sound', el: block.id });
      else if (block.type === 'controls_repeat_ext' || block.type === 'controls_repeat') {
        let times = 3;
        const timesInput = block.getInputTargetBlock('TIMES');
        if (timesInput && timesInput.type === 'math_number') {
          times = parseInt(timesInput.getFieldValue('NUM'), 10) || 3;
        }
        let bodyBlock = block.getInputTargetBlock('DO');
        let body = bodyBlock ? generateASTFromBlock(bodyBlock) : [];
        nodes.push({ type: 'loop', times: times, body: body, el: block.id });
      }
      else if (block.type === 'controls_if_boulder') {
        let thenBlock = block.getInputTargetBlock('DO');
        let elseBlock = block.getInputTargetBlock('ELSE');
        let thenBranch = thenBlock ? generateASTFromBlock(thenBlock) : [];
        let elseBranch = elseBlock ? generateASTFromBlock(elseBlock) : [];
        nodes.push({ type: 'if', condition: 'boulder_ahead', thenBranch: thenBranch, elseBranch: elseBranch, el: block.id });
      }
      block = block.getNextBlock();
    }
    return nodes;
  }

  function generateASTFromWorkspace() {
    let ast = [];
    const topBlocks = workspace.getTopBlocks(false);
    const startBlock = topBlocks.find(b => b.type === 'event_start');

    if (startBlock) {
      ast = generateASTFromBlock(startBlock.getNextBlock());
    }
    return ast;
  }

  // Update Toolbox for logic category visibility
  function updateToolboxVisibility() {
    toolboxConfig.contents[3].hidden = !isLogicOn ? "true" : "false";
    workspace.updateToolbox(toolboxConfig);
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
    p.innerHTML = window.ASSETS.STATION_SVG;
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

  async function runProgram() {
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

    function checkBoulderAhead() {
      let nextX = trainState.x;
      let nextY = trainState.y;
      if (trainState.dir === 0) nextY -= 1;
      else if (trainState.dir === 1) nextX += 1;
      else if (trainState.dir === 2) nextY += 1;
      else if (trainState.dir === 3) nextX -= 1;
      return boulders.some(b => b.x === nextX && b.y === nextY);
    }

    async function executeNode(node) {
      if (isStopped) return;

      if (node.el) workspace.highlightBlock(node.el, true);

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

      if (node.el) workspace.highlightBlock(node.el, false);
    }

    // Run interpreter
    function stopProgram() {
      isStopped = true;
      isPlaying = false;
      btnPlay.style.display = 'flex';
      btnStop.style.display = 'none';
      if (audioMove) audioMove.pause();

      // Clean up any left-over execution highlights
      workspace.highlightBlock(null);

      setupLevel();
    }
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
          level = (level + 1) % 6;
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

  btnPlay.addEventListener('click', runProgram);

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
        updateToolboxVisibility();
      });
    }

    if (btnLogicOff) {
      btnLogicOff.addEventListener('click', () => {
        isLogicOn = false;
        btnLogicOff.classList.add('active');
        btnLogicOn.classList.remove('active');
        updateToolboxVisibility();
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

  // Coordinates labels
  const labelLayer = document.createElement('div');
  labelLayer.id = 'labelLayer';
  labelLayer.className = 'overlay-layer';
  labelLayer.style.display = 'none'; // Hidden by default
  document.querySelector('.board-container').appendChild(labelLayer);

  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
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
    if (!gameContainer) return;
    const minWidth = 1408;
    const minHeight = 900;
    const padding = 60;
    const scaleX = window.innerWidth / (minWidth + padding);
    const scaleY = window.innerHeight / (minHeight + padding);
    let scale = Math.min(scaleX, scaleY, 1);
    
    window.__appScale = scale;

    // DO NOT scale the entire game container with CSS transform.
    // This allows Blockly to remain in a 1:1 screen mapping environment, eliminating all popup coordinate bugs!
    gameContainer.style.transform = `translateX(-50%)`;
    gameContainer.style.transformOrigin = 'top center';
    
    // 1. Manually scale Left Panel (Queue)
    const panelLeft = document.querySelector('.panel-left');
    if (panelLeft) {
      panelLeft.style.transform = `scale(${scale})`;
      panelLeft.style.transformOrigin = 'top left';
      // Collapse the layout gap left by visually shrinking the element
      const w = panelLeft.offsetWidth || 350;
      panelLeft.style.marginRight = `-${w * (1 - scale)}px`;
    }

    // 2. Manually scale Right Panel (Board)
    const panelRight = document.querySelector('.panel-right');
    if (panelRight) {
      panelRight.style.transform = `scale(${scale})`;
      panelRight.style.transformOrigin = 'top right';
      // Collapse the layout gap
      const w = panelRight.offsetWidth || 720;
      panelRight.style.marginLeft = `-${w * (1 - scale)}px`;
    }

    // 3. Native Blockly scaling! (Flawless, handles all popups and internal math correctly)
    if (workspace) {
      workspace.setScale(scale);
    }
    
    // 4. Manually scale Toolbox (since it's HTML)
    const toolbox = document.querySelector('.blocklyToolboxDiv');
    if (toolbox) {
      toolbox.style.transform = `scale(${scale})`;
      toolbox.style.transformOrigin = 'top left';
      // The injection div (blocks workspace) needs to shift left to cover the gap left by the scaled toolbox
      const injectionDiv = document.querySelector('.injectionDiv');
      if (injectionDiv) {
        const tw = toolbox.offsetWidth || 150;
        // Shift it left, but not via flex margin because it's absolute positioned by Blockly inside the container
        injectionDiv.style.marginLeft = `-${tw * (1 - scale)}px`;
      }
    }
  }

  window.addEventListener('resize', () => {
    adjustScale();
    if (workspace) {
      Blockly.svgResize(workspace);
    }
  });

  adjustScale();
  setTimeout(adjustScale, 100);
  setTimeout(adjustScale, 500);

  // Override Blockly's text input editor to simulate "unscale -> click -> scale"
  // This completely bypasses Blockly's CTM and SVG hidden bounding box bugs!
  if (Blockly && Blockly.FieldTextInput && Blockly.FieldTextInput.prototype) {
    const originalShowEditor = Blockly.FieldTextInput.prototype.showEditor_;
    
  }
});
