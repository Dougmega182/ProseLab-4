// src/components/AISettingsDialog.js

import { BaseComponent } from './BaseComponent.js';

export class AISettingsDialog extends BaseComponent {
  constructor(appContext) {
    super(appContext);
    this.providers = [
      {
        id: 'openai',
        name: 'OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1'
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        defaultModel: 'claude-sonnet-4-20250514',
        baseUrl: 'https://api.anthropic.com/v1'
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        models: ['auto'],
        defaultModel: 'auto',
        baseUrl: 'https://openrouter.ai/api/v1'
      },
      {
        id: 'local',
        name: 'Local (Ollama/LM Studio)',
        models: [],
        defaultModel: '',
        baseUrl: 'http://localhost:11434/v1'
      }
    ];
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const currentConfig = this.loadConfig();

    overlay.innerHTML = `
      <div class="dialog ai-settings-dialog">
        <div class="dialog-header">
          <h2>AI Settings</h2>
          <button class="dialog-close-btn">✕</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label for="ai-provider">Provider</label>
            <select id="ai-provider" class="form-control">
              ${this.providers.map(p =>
                `<option value="${p.id}" ${currentConfig.provider === p.id ? 'selected' : ''}>${p.name}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="ai-api-key">API Key</label>
            <div class="input-with-toggle">
              <input type="password" id="ai-api-key" class="form-control"
                     value="${currentConfig.apiKey || ''}"
                     placeholder="sk-...">
              <button class="toggle-visibility-btn" title="Show/Hide">👁️</button>
            </div>
            <small class="form-hint">Your key is stored locally in your browser and never sent to our servers.</small>
          </div>

          <div class="form-group">
            <label for="ai-base-url">API Base URL</label>
            <input type="text" id="ai-base-url" class="form-control"
                   value="${currentConfig.baseUrl || ''}"
                   placeholder="https://api.openai.com/v1">
          </div>

          <div class="form-group">
            <label for="ai-model">Model</label>
            <div class="model-input-row">
              <select id="ai-model-select" class="form-control">
                <option value="">-- Select or type custom --</option>
              </select>
              <input type="text" id="ai-model-custom" class="form-control"
                     value="${currentConfig.model || ''}"
                     placeholder="Model name">
            </div>
          </div>

          <div class="form-group">
            <label for="ai-context-window">Context Window (tokens)</label>
            <input type="number" id="ai-context-window" class="form-control"
                   value="${currentConfig.contextWindow || 128000}"
                   min="2048" max="1000000" step="1024">
          </div>

          <div class="form-group">
            <label for="ai-max-output">Max Output Tokens</label>
            <input type="number" id="ai-max-output" class="form-control"
                   value="${currentConfig.maxOutputTokens || 4096}"
                   min="256" max="32000" step="256">
          </div>

          <div class="form-group">
            <label>Writing Style Defaults</label>
            <div class="style-options">
              <label class="checkbox-label">
                <input type="checkbox" id="ai-match-voice" ${currentConfig.matchVoice !== false ? 'checked' : ''}>
                Match author voice from existing text
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="ai-include-context" ${currentConfig.includeContext !== false ? 'checked' : ''}>
                Include project context (characters, plot, etc.)
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="ai-include-recent" ${currentConfig.includeRecent !== false ? 'checked' : ''}>
                Include recent scenes for continuity
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="ai-custom-instructions">Custom System Instructions</label>
            <textarea id="ai-custom-instructions" class="form-control" rows="4"
                      placeholder="Additional instructions to include in every AI request...">${currentConfig.customInstructions || ''}</textarea>
          </div>

          <div class="form-group">
            <button class="ai-test-btn secondary-btn">Test Connection</button>
            <span class="ai-test-result"></span>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="cancel-btn secondary-btn">Cancel</button>
          <button class="save-btn primary-btn">Save Settings</button>
        </div>
      </div>
    `;

    this.bindDialogEvents(overlay, currentConfig);
    this.populateModels(overlay, currentConfig.provider, currentConfig.model);

    return overlay;
  }

  bindDialogEvents(overlay, currentConfig) {
    // Close
    overlay.querySelector('.dialog-close-btn').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.querySelector('.cancel-btn').addEventListener('click', () => {
      overlay.remove();
    });

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Provider change
    overlay.querySelector('#ai-provider').addEventListener('change', (e) => {
      const provider = this.providers.find(p => p.id === e.target.value);
      if (provider) {
        overlay.querySelector('#ai-base-url').value = provider.baseUrl;
        this.populateModels(overlay, provider.id, provider.defaultModel);
        overlay.querySelector('#ai-model-custom').value = provider.defaultModel;
      }
    });

    // Model select change
    overlay.querySelector('#ai-model-select').addEventListener('change', (e) => {
      if (e.target.value) {
        overlay.querySelector('#ai-model-custom').value = e.target.value;
      }
    });

    // Toggle API key visibility
    overlay.querySelector('.toggle-visibility-btn').addEventListener('click', () => {
      const input = overlay.querySelector('#ai-api-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Test connection
    overlay.querySelector('.ai-test-btn').addEventListener('click', () => {
      this.testConnection(overlay);
    });

    // Save
    overlay.querySelector('.save-btn').addEventListener('click', () => {
      this.saveSettings(overlay);
    });
  }

  populateModels(overlay, providerId, selectedModel) {
    const select = overlay.querySelector('#ai-model-select');
    const provider = this.providers.find(p => p.id === providerId);

    select.innerHTML = '<option value="">-- Select or type custom --</option>';

    if (provider && provider.models.length > 0) {
      provider.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        if (model === selectedModel) option.selected = true;
        select.appendChild(option);
      });
    }
  }

  async testConnection(overlay) {
    const resultEl = overlay.querySelector('.ai-test-result');
    const testBtn = overlay.querySelector('.ai-test-btn');

    const config = this.getFormValues(overlay);

    if (!config.apiKey && config.provider !== 'local') {
      resultEl.textContent = '❌ API key required';
      resultEl.className = 'ai-test-result error';
      return;
    }

    testBtn.disabled = true;
    resultEl.textContent = '⏳ Testing...';
    resultEl.className = 'ai-test-result loading';

    try {
      // Create a temporary client to test
      const { LLMClientFactory } = await import('../llm/llmClients.js');
      const client = LLMClientFactory.create(config.provider, {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model
      });

      const response = await client.chat([
        { role: 'user', content: 'Respond with exactly: "Connection successful."' }
      ], {
        max_tokens: 20,
        temperature: 0
      });

      if (response && response.content) {
        resultEl.textContent = `✅ Connected! Model: ${response.model || config.model}`;
        resultEl.className = 'ai-test-result success';
      } else {
        resultEl.textContent = '❌ No response received';
        resultEl.className = 'ai-test-result error';
      }
    } catch (error) {
      resultEl.textContent = `❌ ${error.message}`;
      resultEl.className = 'ai-test-result error';
    } finally {
      testBtn.disabled = false;
    }
  }

  getFormValues(overlay) {
    return {
      provider: overlay.querySelector('#ai-provider').value,
      apiKey: overlay.querySelector('#ai-api-key').value.trim(),
      baseUrl: overlay.querySelector('#ai-base-url').value.trim(),
      model: overlay.querySelector('#ai-model-custom').value.trim(),
      contextWindow: parseInt(overlay.querySelector('#ai-context-window').value) || 128000,
      maxOutputTokens: parseInt(overlay.querySelector('#ai-max-output').value) || 4096,
      matchVoice: overlay.querySelector('#ai-match-voice').checked,
      includeContext: overlay.querySelector('#ai-include-context').checked,
      includeRecent: overlay.querySelector('#ai-include-recent').checked,
      customInstructions: overlay.querySelector('#ai-custom-instructions').value.trim()
    };
  }

  saveSettings(overlay) {
    const config = this.getFormValues(overlay);

    if (!config.apiKey && config.provider !== 'local') {
      alert('API key is required for cloud providers.');
      return;
    }

    if (!config.model) {
      alert('Please specify a model.');
      return;
    }

    this.persistConfig(config);
    this.emit('settingsSaved', config);
    overlay.remove();
  }

  loadConfig() {
    try {
      const stored = localStorage.getItem('storyforge_ai_config');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load AI config:', e);
    }
    return {
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      matchVoice: true,
      includeContext: true,
      includeRecent: true,
      customInstructions: ''
    };
  }

  persistConfig(config) {
    try {
      // Don't store the API key in plain localStorage in production
      // For now, we store it but in a real app you'd use a more secure method
      localStorage.setItem('storyforge_ai_config', JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to persist AI config:', e);
    }
  }
}
