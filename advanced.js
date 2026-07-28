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

  // --- BLOCKLY WORKSPACE SETUP ---
  
  // Custom Blocks Definition
  Blockly.Blocks['move_straight'] = {
    init: function() {
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
    init: function() {
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
    init: function() {
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
    init: function() {
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
    init: function() {
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
    init: function() {
      this.jsonInit({
        "type": "controls_if_boulder",
        "message0": "🪨❓",
        "message1": "%1",
        "args1": [{"type": "input_statement", "name": "DO"}],
        "message2": "🚫🪨",
        "message3": "%1",
        "args3": [{"type": "input_statement", "name": "ELSE"}],
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
    renderer: 'zelos',         // Εμφάνιση ακριβώς όπως το Scratch
    horizontalLayout: true,    // Οριζόντια διάταξη
    toolboxPosition: 'bottom'  // Μπάρα εντολών στο κάτω μέρος
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

  // Init
  setupLevel();

  // Responsive Scaling Logic
  const advancedLayout = document.querySelector('.advanced-layout');
  function adjustScale() {
    if (!advancedLayout) return;
    const minWidth = 1150; // approximate width needed for both panels unscaled
    const minHeight = 900; // increased from 750 to account for 8x8 grid (668px) + header + controls + padding
    
    const padding = 60; // visual margin (empty space) around the layout
    const scaleX = window.innerWidth / (minWidth + padding);
    const scaleY = window.innerHeight / (minHeight + padding);
    let scale = Math.min(scaleX, scaleY, 1);
    
    advancedLayout.style.transform = `scale(${scale})`;
    advancedLayout.style.transformOrigin = 'top center';
    Blockly.svgResize(workspace);
  }
  
  window.addEventListener('resize', adjustScale);
  adjustScale();
  setTimeout(adjustScale, 100);
});
