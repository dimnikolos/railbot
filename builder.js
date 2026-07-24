document.addEventListener('DOMContentLoaded', () => {
  const settingsModal = document.getElementById('settingsModal');
  const boardContainer = document.querySelector('.board-container');
  const passengerLayer = document.getElementById('passengerLayer');
  const grid = document.getElementById('grid');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const btnClear = document.getElementById('btnClear');
  
  const playControls = document.getElementById('playControls');
  const builderControls = document.getElementById('builderControls');
  const btnSaveBuilder = document.getElementById('btnSaveBuilder');
  const btnCancelBuilder = document.getElementById('btnCancelBuilder');
  const editLevelBtns = document.querySelectorAll('.edit-level-btn');
  const levelDisplay = document.getElementById('levelDisplay');
  
  let isBuilderActive = false;
  let customObjects = [];
  let currentBuilderLevel = 1;
  
  const CELL_SIZE = 80;
  const GAP_SIZE = 4;
  const STEP = CELL_SIZE + GAP_SIZE;

  // Listen to pencil icons
  editLevelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentBuilderLevel = parseInt(e.target.dataset.level);
      startBuilderMode();
    });
  });

  function startBuilderMode() {
    isBuilderActive = true;
    
    // UI changes
    settingsModal.classList.remove('show');
    boardContainer.classList.add('builder-mode');
    playControls.style.display = 'none';
    builderControls.style.display = 'block';
    levelDisplay.textContent = currentBuilderLevel;
    
    // Clear and load existing level objects
    passengerLayer.innerHTML = '';
    customObjects = [];
    
    const existingData = window.LEVELS.normal[currentBuilderLevel] || [];
    existingData.forEach(obj => {
      const type = obj.type || 'station';
      setCellState(obj.x, obj.y, type);
    });
    
    showToast(`Editing Level ${currentBuilderLevel}. Click grid to place objects.`, true);
  }

  function stopBuilderMode(saved) {
    isBuilderActive = false;
    
    // UI changes
    boardContainer.classList.remove('builder-mode');
    playControls.style.display = 'block';
    builderControls.style.display = 'none';
    
    if (saved) {
      showToast(`Level ${currentBuilderLevel} saved!`, true);
      // Switch the game to the newly saved level
      if (window.setCurrentLevel) {
        window.setCurrentLevel(currentBuilderLevel);
      }
    } else {
      showToast(`Builder cancelled.`, false);
      // Reset by clicking clear if we cancel, so it reloads the current game state
      if (btnClear) btnClear.click();
    }
  }

  window.addEventListener('levelChanged', (e) => {
    if (isBuilderActive) {
      currentBuilderLevel = e.detail;
      startBuilderMode();
    }
  });

  btnSaveBuilder.addEventListener('click', () => {
    // Check if level has at least one station (objective)
    const hasStation = customObjects.some(obj => obj.type === 'station');
    if (!hasStation) {
      showToast("The level must have at least one passenger!", false);
      return; // prevent saving
    }

    // Save to global data
    const newLevelData = customObjects.map(obj => ({x: obj.x, y: obj.y, type: obj.type}));
    window.LEVELS.normal[currentBuilderLevel] = newLevelData;
    if (window.saveLevels) {
      window.saveLevels();
    }
    stopBuilderMode(true);
  });

  btnCancelBuilder.addEventListener('click', () => {
    stopBuilderMode(false);
  });

  // Handle grid clicks via delegation
  grid.addEventListener('click', (e) => {
    if (!isBuilderActive) return;
    
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;
    
    const cells = Array.from(grid.querySelectorAll('.grid-cell'));
    const index = cells.indexOf(cell);
    if (index === -1) return;
    
    const x = index % 5;
    const y = Math.floor(index / 5);
    
    cycleCellState(x, y);
  });

  const STATION_SVG = `<svg viewBox="0 0 80 80" width="100%" height="100%">
    <!-- Platform -->
    <rect x="4" y="24" width="40" height="6" rx="2" fill="#94a3b8" stroke="#64748b" stroke-width="1"/>
    <!-- Main Building -->
    <rect x="8" y="12" width="32" height="12" fill="#fef08a" stroke="#ca8a04" stroke-width="1.5"/>
    <!-- Roof -->
    <path d="M 4 12 L 24 2 L 44 12 Z" fill="#dc2626" stroke="#991b1b" stroke-width="1.5" stroke-linejoin="round"/>
    <!-- Clock -->
    <circle cx="24" cy="8" r="2.5" fill="#ffffff" stroke="#991b1b" stroke-width="1"/>
    <line x1="24" y1="8" x2="24" y2="6.5" stroke="#991b1b" stroke-width="0.5"/>
    <line x1="24" y1="8" x2="25.5" y2="8" stroke="#991b1b" stroke-width="0.5"/>
    <!-- Door -->
    <rect x="20" y="16" width="8" height="8" rx="1" fill="#78350f"/>
    <!-- Windows -->
    <rect x="12" y="16" width="5" height="5" rx="1" fill="#bae6fd" stroke="#0284c7" stroke-width="1"/>
    <rect x="31" y="16" width="5" height="5" rx="1" fill="#bae6fd" stroke="#0284c7" stroke-width="1"/>
  </svg>`;

  const BOULDER_SVG = `<svg viewBox="0 0 80 80" width="100%" height="100%">
    <!-- Boulder 1 -->
    <path d="M 20 60 Q 30 30 50 50 Q 70 70 40 75 Q 15 70 20 60 Z" fill="#64748b" stroke="#475569" stroke-width="2"/>
    <!-- Boulder 2 -->
    <path d="M 40 55 Q 50 20 70 40 Q 80 65 60 70 Q 30 65 40 55 Z" fill="#94a3b8" stroke="#64748b" stroke-width="2"/>
    <!-- Boulder 3 -->
    <path d="M 10 50 Q 20 20 40 35 Q 30 60 15 55 Z" fill="#475569" stroke="#334155" stroke-width="2"/>
  </svg>`;

  function setCellState(x, y, type) {
    // Remove if exists
    const existingIndex = customObjects.findIndex(obj => obj.x === x && obj.y === y);
    if (existingIndex > -1) {
      const obj = customObjects[existingIndex];
      if (obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
      customObjects.splice(existingIndex, 1);
    }

    if (type === 'blank') return;

    // Add new
    const el = document.createElement('div');
    el.className = 'passenger builder-passenger';
    el.innerHTML = type === 'station' ? STATION_SVG : BOULDER_SVG;
    el.style.transform = `translate(${x * STEP}px, ${y * STEP}px)`;
    el.style.pointerEvents = 'none';
    passengerLayer.appendChild(el);
    
    customObjects.push({ x, y, type, el });
  }

  function cycleCellState(x, y) {
    const existingIndex = customObjects.findIndex(obj => obj.x === x && obj.y === y);
    let currentType = 'blank';
    if (existingIndex > -1) {
      currentType = customObjects[existingIndex].type;
    }

    let nextType = 'blank';
    if (currentType === 'blank') nextType = 'station';
    else if (currentType === 'station') nextType = 'boulder';
    else if (currentType === 'boulder') nextType = 'blank';

    setCellState(x, y, nextType);
  }

  function showToast(msg, isSuccess) {
    toastMsg.textContent = msg;
    if (isSuccess) {
      toast.classList.add('builder-active-toast');
    } else {
      toast.classList.remove('builder-active-toast');
    }
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
});
