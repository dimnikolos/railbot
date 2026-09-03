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
  const blocklyDiv = document.getElementById('blocklyDiv');
  const btnHeaderBack = document.getElementById('btnHeaderBack');
  
  const isAdvanced = blocklyDiv !== null;
  const GRID_SIZE = isAdvanced ? 8 : 5;
  const levelKey = isAdvanced ? 'advanced' : 'normal';

  let isBuilderActive = false;
  let customObjects = [];
  let currentBuilderLevel = 1;
  
  const { CELL_SIZE, GAP_SIZE, STEP } = window.CONFIG;

  if (editLevelBtns) {
    editLevelBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentBuilderLevel = parseInt(e.target.dataset.level);
        startBuilderMode();
      });
    });
  }

  function startBuilderMode() {
    isBuilderActive = true;
    
    // UI changes
    if (settingsModal) settingsModal.classList.remove('show');
    if (boardContainer) boardContainer.classList.add('builder-mode');
    if (playControls) playControls.style.display = 'none';
    if (builderControls) builderControls.style.display = 'flex';
    if (levelDisplay) levelDisplay.textContent = currentBuilderLevel;
    
    // Normal mode specific logic
    if (!isAdvanced) {
      const panelMiddle = document.querySelector('.panel-middle');
      if (panelMiddle) panelMiddle.style.display = 'none';
      const panelLeft = document.querySelector('.panel-left');
      if (panelLeft) {
        panelLeft.style.flex = '1';
        panelLeft.style.justifyContent = 'center';
      }
    } else {
      if (blocklyDiv) blocklyDiv.style.visibility = 'hidden';
    }
    
    // Clear and load existing level objects
    if (passengerLayer) passengerLayer.innerHTML = '';
    customObjects = [];
    
    const existingData = window.LEVELS[levelKey][currentBuilderLevel] || [];
    existingData.forEach(obj => {
      const type = obj.type || 'station';
      setCellState(obj.x, obj.y, type);
    });
    
    showToast(`Editing Level ${currentBuilderLevel}. Click grid to place objects.`, true);
  }

  function stopBuilderMode(saved) {
    isBuilderActive = false;
    
    // UI changes
    if (boardContainer) boardContainer.classList.remove('builder-mode');
    if (playControls) playControls.style.display = 'flex';
    if (builderControls) builderControls.style.display = 'none';
    
    if (!isAdvanced) {
      const panelMiddle = document.querySelector('.panel-middle');
      if (panelMiddle) panelMiddle.style.display = '';
      const panelLeft = document.querySelector('.panel-left');
      if (panelLeft) {
        panelLeft.style.flex = '';
        panelLeft.style.justifyContent = '';
      }
    } else {
      if (blocklyDiv) blocklyDiv.style.visibility = 'visible';
    }
    
    if (saved) {
      showToast(`Level ${currentBuilderLevel} saved!`, true);
      if (isAdvanced) {
        window.dispatchEvent(new Event('reloadAdvancedLevel'));
      } else {
        if (window.setCurrentLevel) {
          window.setCurrentLevel(currentBuilderLevel);
        }
      }
    } else {
      showToast(`Builder cancelled.`, false);
      if (isAdvanced) {
        window.dispatchEvent(new Event('reloadAdvancedLevel'));
      } else {
        if (btnClear) btnClear.click();
      }
    }
  }

  window.addEventListener('levelChanged', (e) => {
    if (isBuilderActive) {
      currentBuilderLevel = e.detail;
      startBuilderMode();
    }
  });

  if (btnSaveBuilder) {
    btnSaveBuilder.addEventListener('click', () => {
      const hasStation = customObjects.some(obj => obj.type === 'station');
      if (!hasStation) {
        showToast("The level must have at least one passenger!", false);
        return; 
      }

      const newLevelData = customObjects.map(obj => ({x: obj.x, y: obj.y, type: obj.type}));
      window.LEVELS[levelKey][currentBuilderLevel] = newLevelData;
      if (window.saveLevels) {
        window.saveLevels();
      }
      stopBuilderMode(true);
    });
  }

  if (btnCancelBuilder) {
    btnCancelBuilder.addEventListener('click', () => {
      stopBuilderMode(false);
    });
  }

  if (btnHeaderBack) {
    btnHeaderBack.addEventListener('click', (e) => {
      if (isBuilderActive) {
        e.preventDefault();
        stopBuilderMode(false);
      }
    });
  }

  if (grid) {
    grid.addEventListener('click', (e) => {
      if (!isBuilderActive) return;
      
      const cell = e.target.closest('.grid-cell');
      if (!cell) return;
      
      const cells = Array.from(grid.querySelectorAll('.grid-cell'));
      const index = cells.indexOf(cell);
      if (index === -1) return;
      
      const x = index % GRID_SIZE;
      const y = Math.floor(index / GRID_SIZE);
      
      cycleCellState(x, y);
    });
  }

  const STATION_SVG = window.ASSETS.STATION_SVG;
  const BOULDER_SVG = window.ASSETS.BOULDER_SVG;

  function setCellState(x, y, type) {
    const existingIndex = customObjects.findIndex(obj => obj.x === x && obj.y === y);
    if (existingIndex > -1) {
      const obj = customObjects[existingIndex];
      if (obj.el && obj.el.parentNode) obj.el.parentNode.removeChild(obj.el);
      customObjects.splice(existingIndex, 1);
    }

    if (type === 'blank') return;

    const el = document.createElement('div');
    el.className = 'passenger builder-passenger';
    el.innerHTML = type === 'station' ? STATION_SVG : BOULDER_SVG;
    el.style.transform = `translate(${x * STEP}px, ${y * STEP}px)`;
    el.style.pointerEvents = 'none';
    if (passengerLayer) passengerLayer.appendChild(el);
    
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
    if (!toastMsg || !toast) return;
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
