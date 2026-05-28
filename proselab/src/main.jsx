import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initServices } from './services/initServices.js'

const container = document.getElementById('root');
const root = createRoot(container);

initServices()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch((err) => {
    console.error("Critical Service Initialization Failed:", err);
    container.innerHTML = `
      <div style="
        background: #120c0c;
        color: #ff6b6b;
        padding: 2.5rem;
        font-family: monospace;
        border: 1px solid #ff3b30;
        border-radius: 8px;
        margin: 3rem auto;
        max-width: 650px;
        box-shadow: 0 8px 32px rgba(255, 59, 48, 0.15);
      ">
        <h2 style="margin-top: 0; color: #ff3b30; font-size: 1.4rem; border-bottom: 1px solid #3a1a1a; padding-bottom: 0.75rem;">
          Critical Startup Failure
        </h2>
        <p style="color: #a0a0a0; font-size: 0.9rem; line-height: 1.6;">
          ProseLab failed to initialize its core local storage or database services. This usually happens if the IndexedDB version is incompatible or if browser storage permissions are blocked.
        </p>
        <div style="background: #1a1010; border-radius: 4px; padding: 1rem; margin-top: 1.5rem; border-left: 3px solid #ff3b30;">
          <strong style="color: #ff6b6b; display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
            Diagnostic Stack Trace
          </strong>
          <pre style="margin: 0; white-space: pre-wrap; font-size: 0.8rem; line-height: 1.5; color: #e0d0d0;">${err.stack || err.message || err}</pre>
        </div>
        <button 
          onclick="window.location.reload()" 
          style="
            margin-top: 1.5rem;
            background: #ff3b30;
            color: white;
            border: none;
            padding: 0.65rem 1.25rem;
            border-radius: 4px;
            font-family: inherit;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
          "
        >
          Retry Startup
        </button>
      </div>
    `;
  });
