export class ThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.customProperties = {};
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem('storyforge-theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.currentTheme = parsed.theme || 'dark';
        this.customProperties = parsed.customProperties || {};
      }
    } catch {
      // Use defaults
    }
    this.apply();
  }

  save() {
    localStorage.setItem('storyforge-theme', JSON.stringify({
      theme: this.currentTheme,
      customProperties: this.customProperties,
    }));
  }

  apply() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    for (const [key, value] of Object.entries(this.customProperties)) {
      document.documentElement.style.setProperty(key, value);
    }
  }

  setTheme(theme) {
    this.currentTheme = theme;
    this.apply();
    this.save();
  }

  setProperty(key, value) {
    this.customProperties[key] = value;
    document.documentElement.style.setProperty(key, value);
    this.save();
  }

  getThemes() {
    return [
      { id: 'dark', name: 'Dark', description: 'Easy on the eyes for late-night writing' },
      { id: 'light', name: 'Light', description: 'Clean and bright' },
      { id: 'sepia', name: 'Sepia', description: 'Warm, paper-like tones' },
      { id: 'midnight', name: 'Midnight', description: 'Deep blue-black for focus' },
      { id: 'forest', name: 'Forest', description: 'Calming green tones' },
    ];
  }
}
