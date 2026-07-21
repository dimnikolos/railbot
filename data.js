(function() {
  const defaultLevels = {
    1: [{x: 0, y: 1, type: 'station'}, {x: 3, y: 1, type: 'station'}],
    2: [{x: 1, y: 2, type: 'station'}, {x: 4, y: 0, type: 'station'}],
    3: [{x: 2, y: 2, type: 'station'}, {x: 4, y: 4, type: 'station'}],
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
    return JSON.parse(JSON.stringify(defaultLevels));
  }

  window.LEVELS = loadLevels();

  window.saveLevels = function() {
    try {
      localStorage.setItem('railbot_levels', JSON.stringify(window.LEVELS));
    } catch (e) {
      console.error('Error saving levels to localStorage', e);
    }
  };
})();
