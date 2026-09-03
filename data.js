(function() {
  const defaultLevels = {
    1: [{x: 3, y: 0, type: 'station'}], // Level 1: Just go straight (3 steps)
    2: [{x: 2, y: 2, type: 'station'}], // Level 2: One turn (straight, straight, right, straight)
    3: [{x: 4, y: 4, type: 'station'}], // Level 3: Multiple turns (zigzag)
    4: [{x: 2, y: 0, type: 'station'}, {x: 2, y: 2, type: 'station'}], // Level 4: Multiple passengers
    5: [{x: 2, y: 0, type: 'boulder'}, {x: 4, y: 0, type: 'station'}], // Level 5: Obstacle introduced (must detour)
    6: [{x: 2, y: 0, type: 'boulder'}, {x: 2, y: 2, type: 'boulder'}, {x: 0, y: 3, type: 'station'}, {x: 4, y: 4, type: 'station'}] // Level 6: Complex obstacles & multiple passengers
  };

  const advancedLevels = {
    1: [{x: 6, y: 0, type: 'station'}], // Level 1: Long straight line (use loop)
    2: [{x: 4, y: 4, type: 'station'}, {x: 1, y: 0, type: 'boulder'}, {x: 2, y: 1, type: 'boulder'}, {x: 3, y: 2, type: 'boulder'}], // Level 2: Staircase pattern around boulders (looping pattern)
    3: [{x: 7, y: 0, type: 'station'}, {x: 7, y: 7, type: 'station'}], // Level 3: Multiple far stations
    4: [{x: 3, y: 0, type: 'boulder'}, {x: 3, y: 1, type: 'boulder'}, {x: 3, y: 2, type: 'boulder'}, {x: 7, y: 0, type: 'station'}], // Level 4: Wall of boulders (must go around)
    5: [{x: 5, y: 5, type: 'station'}, {x: 2, y: 0, type: 'boulder'}, {x: 4, y: 2, type: 'boulder'}, {x: 5, y: 3, type: 'boulder'}], // Level 5: Scattered boulders (if/else logic)
    6: [{x: 7, y: 0, type: 'station'}, {x: 0, y: 7, type: 'station'}, {x: 7, y: 7, type: 'station'}, {x: 3, y: 3, type: 'boulder'}, {x: 4, y: 4, type: 'boulder'}, {x: 3, y: 4, type: 'boulder'}, {x: 4, y: 3, type: 'boulder'}] // Level 6: Master challenge
  };


  function loadLevels() {
    try {
      const saved = localStorage.getItem('railbot_levels');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading levels from localStorage', e);
    }
    // Return a deep copy of defaultLevels
    return {
      normal: JSON.parse(JSON.stringify(defaultLevels)),
      advanced: JSON.parse(JSON.stringify(advancedLevels))
    };
  }

  const loadedData = loadLevels();
  
  // Backward compatibility: if the old format (just an object of arrays) is found, upgrade it
  if (loadedData['1'] && Array.isArray(loadedData['1'])) {
    window.LEVELS = {
      normal: loadedData,
      advanced: JSON.parse(JSON.stringify(advancedLevels))
    };
  } else {
    window.LEVELS = loadedData;
  }

  window.saveLevels = function() {
    try {
      localStorage.setItem('railbot_levels', JSON.stringify(window.LEVELS));
    } catch (e) {
      console.error('Error saving levels to localStorage', e);
    }
  };

  window.resetLevelsToDefault = function() {
    window.LEVELS = {
      normal: JSON.parse(JSON.stringify(defaultLevels)),
      advanced: JSON.parse(JSON.stringify(advancedLevels))
    };
    window.saveLevels();
  };

  window.CONFIG = {
    CELL_SIZE: 80,
    GAP_SIZE: 4,
    STEP: 84, // CELL_SIZE + GAP_SIZE
    TRAIN_SIZE_MULT: 0.6
  };

  window.ASSETS = {
    ICONS: {
      'straight': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20V4m-5 5l5-5 5 5"/></svg>',
      'left': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 10L5 6l4-4"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 6h8a6 6 0 016 6v7"/></svg>',
      'right': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4-4-4-4"/><path stroke-linecap="round" stroke-linejoin="round" d="M19 6h-8a6 6 0 00-6 6v7"/></svg>'
    },
    STATION_SVG: `<svg viewBox="0 0 80 80" width="100%" height="100%">
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
      <rect x="20" y="16" width="8" height="8" fill="#78350f" stroke="#451a03" stroke-width="1"/>
    </svg>`,
    BOULDER_SVG: `<svg viewBox="0 0 80 80" width="100%" height="100%">
      <!-- Boulder 1 -->
      <path d="M 20 60 Q 30 30 50 50 Q 70 70 40 75 Q 15 70 20 60 Z" fill="#64748b" stroke="#475569" stroke-width="2"/>
      <!-- Boulder 2 -->
      <path d="M 40 55 Q 50 20 70 40 Q 80 65 60 70 Q 30 65 40 55 Z" fill="#94a3b8" stroke="#64748b" stroke-width="2"/>
      <!-- Boulder 3 -->
      <path d="M 10 50 Q 20 20 40 35 Q 30 60 15 55 Z" fill="#475569" stroke="#334155" stroke-width="2"/>
    </svg>`,
    TRACK_PATHS: {
      'straight': `
        <path d="M 0 40 L 80 40" stroke="#78350f" stroke-width="20" stroke-dasharray="6 8" fill="none" />
        <path d="M 0 32 L 80 32 M 0 48 L 80 48" stroke="#9ca3af" stroke-width="3" fill="none" />
      `,
      'right': `
        <path d="M 80 40 C 58 40, 40 22, 40 0" stroke="#78350f" stroke-width="20" stroke-dasharray="6 8" fill="none" />
        <path d="M 80 32 C 62.4 32, 48 17.6, 48 0 M 80 48 C 53.5 48, 32 26.5, 32 0" stroke="#9ca3af" stroke-width="3" fill="none" />
      `,
      'left': `
        <path d="M 80 40 C 58 40, 40 58, 40 80" stroke="#78350f" stroke-width="20" stroke-dasharray="6 8" fill="none" />
        <path d="M 80 48 C 62.4 48, 48 62.4, 48 80 M 80 32 C 53.5 32, 32 53.5, 32 80" stroke="#9ca3af" stroke-width="3" fill="none" />
      `
    }
  };
})();
