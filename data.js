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
})();
