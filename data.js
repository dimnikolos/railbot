(function() {
  const defaultLevels = {
    1: [{x: 0, y: 1, type: 'station'}, {x: 3, y: 1, type: 'station'}],
    2: [{x: 1, y: 2, type: 'station'}, {x: 4, y: 0, type: 'station'}],
    3: [{x: 2, y: 2, type: 'station'}, {x: 4, y: 4, type: 'station'}],
    4: [],
    5: [],
    6: []
  };

  const advancedLevels = {
    1: [{x: 2, y: 2, type: 'station'}, {x: 5, y: 2, type: 'station'}, {x: 7, y: 7, type: 'station'}],
    2: [{x: 1, y: 1, type: 'station'}, {x: 6, y: 6, type: 'station'}],
    3: [],
    4: [],
    5: [],
    6: []
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
})();
