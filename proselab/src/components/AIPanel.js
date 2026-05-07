import { BaseComponent } from './BaseComponent.js';
import { TokenEstimator } from '../llm/tokenEstimator.js';

export class AIPanel extends BaseComponent {
  constructor(appContext) {
    super(appContext);
    this.currentMode = 'write'; // write | continue | rewrite | brainstorm | edit | chat
    this.isGenerating = false;
    this.streamedContent = '';
    this.lastResult = null;
    this.selectedText = '';
    this.chatHistory = [];
  }

  render() {
    const container = document.createElement('div');
    container.className = 'ai-panel';

    container.innerHTML = `
      <div class="ai-panel-header">
        <h3>AI Assistant</h3>
        <div class="ai-panel-controls">
          <button class="ai-settings-btn icon-btn" title="AI Settings">⚙️</button>
          <button class="ai-close-btn icon-btn" title="Close">✕</button>
        </div>
      </div>

      <div class="ai-mode-tabs">
        <button class="ai-mode-tab active" data-mode="write">Write</button>
        <button class="ai-mode-tab" data-mode="continue">Continue</button>
        <button class="ai-mode-tab" data-mode="rewrite">Rewrite</button>
        <button class="ai-mode-tab" data-mode="brainstorm">Brainstorm</button>
        <button class="ai-mode-tab" data-mode="edit">Feedback</button>
        <button class="ai-mode-tab" data-mode="chat">Chat</button>
      </div>

      <div class="ai-panel-body">
        <div class="ai-input-area">
          <textarea class="ai-instruction-input" placeholder="${this.getPlaceholder()}" rows="3"></textarea>
          <div class="ai-options-row">
            <label class="ai-option">
              <span>Temp:</span>
              <input type="range" class="ai-temperature" min="0" max="2" step="0.1" value="0.8">
              <span class="ai-temp-value">0.8</span>
            </label>
            <label class="ai-option ai-stream-option">
              <input type="checkbox" class="ai-stream-toggle" checked>
              <span>Stream</span>
            </label>
          </div>
          <div class="ai-action-row">
            <button class="ai-generate-btn primary-btn">Generate</button>
            <button class="ai-cancel-btn danger-btn" style="display:none;">Cancel</button>
            <span class="ai-token-estimate"></span>
          </div>
        </div>

        <div class="ai-output-area" style="display:none;">
          <div class="ai-output-header">
            <span class="ai-output-label">Output</span>
            <div class="ai-output-actions">
              <button class="ai-copy-btn icon-btn" title="Copy">📋</button>
              <button class="ai-insert-btn icon-btn" title="Insert into editor">📥</button>
              <button class="ai-replace-btn icon-btn" title="Replace selection" style="display:none;">🔄</button>
              <button class="ai-clear-btn icon-btn" title="Clear output">🗑️</button>
            </div>
          </div>
          <div class="ai-output-content"></div>
          <div class="ai-output-meta">
            <span class="ai-model-info"></span>
            <span class="ai-usage-info"></span>
          </div>
        </div>
      </div>

      <div class="ai-status-bar">
        <span class="ai-status-text">Ready</span>
        <span class="ai-connection-status"></span>
      </div>
    `;

    this.bindEvents(container);
    this.updateConnectionStatus(container);

    return container;
  }

  bindEvents(container) {
    // Mode tabs
    container.querySelectorAll('.ai-mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.setMode(tab.dataset.mode, container);
      });
    });

    // Temperature slider
    const tempSlider = container.querySelector('.ai-temperature');
    const tempValue = container.querySelector('.ai-temp-value');
    tempSlider.addEventListener('input', () => {
      tempValue.textContent = tempSlider.value;
    });

    // Generate button
    container.querySelector('.ai-generate-btn').addEventListener('click', () => {
      this.generate(container);
    });

    // Cancel button
    container.querySelector('.ai-cancel-btn').addEventListener('click', () => {
      this.cancel(container);
    });

    // Keyboard shortcut: Ctrl+Enter to generate
    container.querySelector('.ai-instruction-input').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.generate(container);
      }
    });

    // Copy button
    container.querySelector('.ai-copy-btn').addEventListener('click', () => {
      this.copyOutput(container);
    });

    // Insert button
    container.querySelector('.ai-insert-btn').addEventListener('click', () => {
      this.insertIntoEditor(container);
    });

    // Replace button
    container.querySelector('.ai-replace-btn').addEventListener('click', () => {
      this.replaceSelection(container);
    });

    // Clear button
    container.querySelector('.ai-clear-btn').addEventListener('click', () => {
      this.clearOutput(container);
    });

    // Settings button
    container.querySelector('.ai-settings-btn').addEventListener('click', () => {
      this.emit('openSettings');
    });

    // Close button
    container.querySelector('.ai-close-btn').addEventListener('click', () => {
      this.emit('close');
    });
  }

  setMode(mode, container) {
    this.currentMode = mode;

    container.querySelectorAll('.ai-mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    const input = container.querySelector('.ai-instruction-input');
    input.placeholder = this.getPlaceholder();

    // Show/hide replace button based on mode
    const replaceBtn = container.querySelector('.ai-replace-btn');
    replaceBtn.style.display = mode === 'rewrite' ? '' : 'none';

    // Adjust temperature defaults per mode
    const tempSlider = container.querySelector('.ai-temperature');
    const tempValue = container.querySelector('.ai-temp-value');
    const defaults = {
      write: 0.8,
      continue: 0.8,
      rewrite: 0.7,
      brainstorm: 0.9,
      edit: 0.5,
      chat: 0.7
    };
    tempSlider.value = defaults[mode] || 0.7;
    tempValue.textContent = tempSlider.value;
  }

  getPlaceholder() {
    const placeholders = {
      write: 'Describe what should happen in this scene...',
      continue: 'Optional: guidance for how to continue...',
      rewrite: 'How should the selected text be rewritten?',
      brainstorm: 'What would you like to brainstorm about?',
      edit: 'Any specific aspects to focus feedback on?',
      chat: 'Ask anything about your project...'
    };
    return placeholders[this.currentMode] || 'Enter instructions...';
  }

  async generate(container) {
    const aiService = this.appContext.aiService;
    if (!aiService || !aiService.isConfigured()) {
      this.showStatus(container, 'AI not configured. Open settings to add API key.', 'error');
      return;
    }

    if (this.isGenerating) return;

    const instruction = container.querySelector('.ai-instruction-input').value.trim();
    const temperature = parseFloat(container.querySelector('.ai-temperature').value);
    const useStreaming = container.querySelector('.ai-stream-toggle').checked;

    const activeScene = this.appContext.getActiveScene?.();
    const activeProject = this.appContext.getActiveProject?.();

    if (!activeScene && ['write', 'continue', 'rewrite', 'edit'].includes(this.currentMode)) {
      this.showStatus(container, 'No active scene selected.', 'error');
      return;
    }

    this.isGenerating = true;
    this.streamedContent = '';
    this.updateGeneratingUI(container, true);
    this.showOutput(container);

    const outputContent = container.querySelector('.ai-output-content');
    outputContent.textContent = '';

    const options = { temperature };

    try {
      let result;

      switch (this.currentMode) {
        case 'write':
         if (useStreaming) {
            result = await aiService.writeSceneStreaming(
              activeScene.id,
              instruction,
              options,
              (chunk) => this.handleStreamChunk(chunk, outputContent, container)
            );
          } else {
            result = await aiService.writeScene(activeScene.id, instruction, options);
          }
          break;

        case 'continue':
          const editorContent = this.appContext.getEditorContent?.() || '';
          if (useStreaming) {
            result = await aiService.continueSceneStreaming(
              activeScene.id,
              editorContent,
              options,
              (chunk) => this.handleStreamChunk(chunk, outputContent, container)
            );
          } else {
            result = await aiService.continueScene(
              activeScene.id,
              editorContent,
              options
            );
          }
          break;

        case 'rewrite':
          const selectedText = this.appContext.getSelectedText?.() || '';
          if (!selectedText) {
            this.showStatus(container, 'Select text in the editor to rewrite.', 'error');
            this.isGenerating = false;
            this.updateGeneratingUI(container, false);
            return;
          }
          this.selectedText = selectedText;
          if (useStreaming) {
            result = await aiService.rewriteTextStreaming(
              activeScene.id,
              selectedText,
              instruction,
              options,
              (chunk) => this.handleStreamChunk(chunk, outputContent, container)
            );
          } else {
            result = await aiService.rewriteText(
              activeScene.id,
              selectedText,
              instruction,
              options
            );
          }
          break;

        case 'brainstorm':
          if (!instruction) {
            this.showStatus(container, 'Enter a topic to brainstorm about.', 'error');
            this.isGenerating = false;
            this.updateGeneratingUI(container, false);
            return;
          }
          const projectId = activeProject?.id || activeScene?.projectId;
          if (useStreaming) {
            result = await aiService.brainstormStreaming(
              projectId,
              instruction,
              '',
              options,
              (chunk) => this.handleStreamChunk(chunk, outputContent, container)
            );
          } else {
            result = await aiService.brainstorm(projectId, instruction, '', options);
          }
          break;

        case 'edit':
          const textToEdit = this.appContext.getSelectedText?.() || this.appContext.getEditorContent?.() || '';
          if (!textToEdit) {
            this.showStatus(container, 'No text to provide feedback on.', 'error');
            this.isGenerating = false;
            this.updateGeneratingUI(container, false);
            return;
          }
          result = await aiService.getEditorialFeedback(activeScene.id, textToEdit, options);
          if (result.feedback) {
            result.content = result.feedback;
          }
          break;

        case 'chat':
          if (!instruction) {
            this.showStatus(container, 'Enter a message.', 'error');
            this.isGenerating = false;
            this.updateGeneratingUI(container, false);
            return;
          }
          const chatProjectId = activeProject?.id || activeScene?.projectId;
          if (useStreaming) {
            result = await aiService.customChatStreaming(
              chatProjectId,
              null,
              instruction,
              options,
              (chunk) => this.handleStreamChunk(chunk, outputContent, container)
            );
          } else {
            result = await aiService.customChat(chatProjectId, null, instruction, options);
          }
          break;
      }

      this.lastResult = result;

      if (result.cancelled) {
        this.showStatus(container, 'Generation cancelled.', 'warning');
      } else {
        // If not streaming, display the result now
        if (!useStreaming && result.content) {
          outputContent.textContent = result.content;
        }

        this.showResultMeta(container, result);
        this.showStatus(container, 'Generation complete.', 'success');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      this.showStatus(container, `Error: ${error.message}`, 'error');
      outputContent.textContent = `Error: ${error.message}`;
    } finally {
      this.isGenerating = false;
      this.updateGeneratingUI(container, false);
    }
  }

  handleStreamChunk(chunk, outputElement, container) {
    this.streamedContent += chunk;
    outputElement.textContent = this.streamedContent;

    // Auto-scroll to bottom
    const outputArea = container.querySelector('.ai-output-area');
    outputArea.scrollTop = outputArea.scrollHeight;

    // Update token estimate
    const tokenEst = container.querySelector('.ai-token-estimate');
    const words = TokenEstimator.wordCount(this.streamedContent);
    tokenEst.textContent = `~${words} words`;
  }

  cancel(container) {
    const aiService = this.appContext.aiService;
    if (aiService) {
      aiService.cancelAllRequests();
    }
    this.showStatus(container, 'Cancelling...', 'warning');
  }

  updateGeneratingUI(container, generating) {
    const generateBtn = container.querySelector('.ai-generate-btn');
    const cancelBtn = container.querySelector('.ai-cancel-btn');
    const input = container.querySelector('.ai-instruction-input');

    generateBtn.style.display = generating ? 'none' : '';
    cancelBtn.style.display = generating ? '' : 'none';
    generateBtn.disabled = generating;
   input.disabled = generating;

    if (generating) {
      this.showStatus(container, 'Generating...', 'loading');
    }
  }

  showOutput(container) {
    container.querySelector('.ai-output-area').style.display = '';
  }

  clearOutput(container) {
    container.querySelector('.ai-output-area').style.display = 'none';
    container.querySelector('.ai-output-content').textContent = '';
    container.querySelector('.ai-model-info').textContent = '';
    container.querySelector('.ai-usage-info').textContent = '';
    this.lastResult = null;
    this.streamedContent = '';
  }

  showResultMeta(container, result) {
    if (result.model) {
      container.querySelector('.ai-model-info').textContent = `Model: ${result.model}`;
    }
    if (result.usage) {
      const usage = result.usage;
      container.querySelector('.ai-usage-info').textContent =
        `Tokens: ${usage.promptTokens || '?'} → ${usage.completionTokens || '?'} (${usage.totalTokens || '?'} total)`;
    }
  }

  showStatus(container, message, type = 'info') {
    const statusText = container.querySelector('.ai-status-text');
    statusText.textContent = message;
    statusText.className = `ai-status-text ai-status-${type}`;
  }

  updateConnectionStatus(container) {
    const indicator = container.querySelector('.ai-connection-status');
    const aiService = this.appContext.aiService;

    if (!aiService || !aiService.isConfigured()) {
      indicator.textContent = '🔴 Not configured';
      indicator.title = 'AI service not configured';
    } else {
      indicator.textContent = '🟢 Connected';
      indicator.title = `Provider: ${aiService.client.provider}`;
    }
  }

  async copyOutput(container) {
    const content = container.querySelector('.ai-output-content').textContent;
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      this.showStatus(container, 'Copied to clipboard.', 'success');
    } catch (e) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showStatus(container, 'Copied to clipboard.', 'success');
    }
  }

  insertIntoEditor(container) {
    const content = container.querySelector('.ai-output-content').textContent;
    if (!content) return;

    this.emit('insertText', { text: content, position: 'cursor' });
    this.showStatus(container, 'Inserted into editor.', 'success');
  }

  replaceSelection(container) {
    const content = container.querySelector('.ai-output-content').textContent;
    if (!content) return;

    this.emit('replaceSelection', { text: content, original: this.selectedText });
    this.showStatus(container, 'Selection replaced.', 'success');
  }

  // Called externally when editor selection changes
  onSelectionChange(selectedText) {
    this.selectedText = selectedText || '';
  }

  destroy() {
    this.cancel(this.element);
    super.destroy();
  }
}
