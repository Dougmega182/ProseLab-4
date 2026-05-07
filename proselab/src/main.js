// src/main.js
import { App } from './ui/App.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('ProseLab V4 - Initializing Vanilla Engine...');
  const app = new App();
  app.init().catch(err => {
    console.error('ProseLab V4 - Initialization Failed:', err);
  });
});
