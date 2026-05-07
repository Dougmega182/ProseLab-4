export class AIPanel extends Component {
  constructor(props) {
    super(props);
    this.messages = [];
    this.isLoading = false;
    this.activeTab = 'chat';
  }

  template() {
    return `
      <div class="ai-panel">
        <div class="ai-panel-header">
          <div class="ai-panel-tabs">
            <button class="ai-tab ${this.activeTab === 'chat' ? 'active' : ''}" data-tab="chat">Chat</button>
            <button class="ai-tab ${this.activeTab === 'suggest' ? 'active' : ''}" data-tab="suggest">Suggest</button>
            <button class="ai-tab ${this.activeTab === 'analyze' ? 'active' : ''}" data-tab="analyze">Analyze</button>
          </div>
          <button class="btn-icon btn-sm" id="btn-close-ai">✕</button>
        </div>
        <div class="ai-panel-body" id="ai-panel-body">
          ${this.renderTabContent()}
        </div>
      </div>
    `;
  }

  renderTabContent() {
    switch (this.activeTab) {
      case 'chat':
        return this.renderChatTab();
      case 'suggest':
        return this.renderSuggestTab();
      case 'analyze':
        return this.renderAnalyzeTab();
      default:
        return '';
    }
  }

  renderChatTab() {
    return `
      <div class="ai-messages" id="ai-messages">
        ${this.messages.length === 0 ? `
          <div class="ai-welcome">
            <p>👋 I'm your writing assistant. I can help with:</p>
            <ul>
              <li>Continuing your story</li>
              <li>Character development</li>
              <li>Plot suggestions</li>
              <li>Editing and feedback</li>
              <li>World-building ideas</li>
            </ul>
            <p>Select text in the editor for context-aware help, or just ask me anything.</p>
          </div>
        ` : this.messages.map(msg => `
          <div class="ai-message ai-message-${msg.role}">
            <div class="ai-message-avatar">${msg.role === 'user' ? '👤' : '🤖'}</div>
            <div class="ai-message-content">
              <div class="ai-message-text">${this.formatMessage(msg.content)}</div>
              ${msg.role === 'assistant' ? `
                <div class="ai-message-actions">
                  <button class="btn-xs btn-ghost" data-action="insert" data-index="${this.messages.indexOf(msg)}">Insert at cursor</button>
                  <button class="btn-xs btn-ghost" data-action="replace" data-index="${this.messages.indexOf(msg)}">Replace selection</button>
                  <button class="btn-xs btn-ghost" data-action="copy" data-index="${this.messages.indexOf(msg)}">Copy</button>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
        ${this.isLoading ? `
          <div class="ai-message ai-message-assistant">
            <div class="ai-message-avatar">🤖</div>
            <div class="ai-message-content">
              <div class="ai-typing"><span></span><span></span><span></span></div>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="ai-input-area">
        <div class="ai-quick-actions">
          <button class="btn-xs btn-outline" data-quick="continue">Continue writing</button>
          <button class="btn-xs btn-outline" data-quick="improve">Improve selection</button>
          <button class="btn-xs btn-outline" data-quick="dialogue">Write dialogue</button>
          <button class="btn-xs btn-outline" data-quick="describe">Describe scene</button>
        </div>
        <div class="ai-input-row">
          <textarea class="ai-input" id="ai-input" placeholder="Ask your writing assistant..." rows="2"></textarea>

          <button class="btn btn-primary btn-sm" id="btn-ai-send" ${this.isLoading ? 'disabled' : ''}>
            Send
          </button>
        </div>
      </div>
    `;
  }

  renderSuggestTab() {
    return `
      <div class="ai-suggest-panel">
        <p class="ai-suggest-desc">Get AI-powered suggestions for your writing.</p>
        <div class="ai-suggest-options">
          <button class="btn btn-outline btn-full ai-suggest-btn" data-suggest="plot">
            <span class="suggest-icon">📖</span>
            <span class="suggest-label">Plot Ideas</span>
            <span class="suggest-desc">Generate plot twists and story directions</span>
          </button>
          <button class="btn btn-outline btn-full ai-suggest-btn" data-suggest="character">
            <span class="suggest-icon">👤</span>
            <span class="suggest-label">Character Ideas</span>
            <span class="suggest-desc">Develop character traits, backstories, arcs</span>
          </button>
          <button class="btn btn-outline btn-full ai-suggest-btn" data-suggest="dialogue">
            <span class="suggest-icon">💬</span>
            <span class="suggest-label">Dialogue</span>
            <span class="suggest-desc">Generate realistic dialogue between characters</span>
          </button>
          <button class="btn btn-outline btn-full ai-suggest-btn" data-suggest="worldbuilding">
            <span class="suggest-icon">🌍</span>
            <span class="suggest-label">World Building</span>
            <span class="suggest-desc">Flesh out settings, cultures, and lore</span>
          </button>
          <button class="btn btn-outline btn-full ai-suggest-btn" data-suggest="names">
            <span class="suggest-icon">🏷️</span>
            <span class="suggest-label">Name Generator</span>
            <span class="suggest-desc">Generate character and place names</span>
          </button>
        </div>
        <div class="ai-suggest-result" id="ai-suggest-result"></div>
      </div>
    `;
  }

  renderAnalyzeTab() {
    return `
      <div class="ai-analyze-panel">
        <p class="ai-analyze-desc">Analyze your current chapter or selected text.</p>
        <div class="ai-analyze-options">
          <button class="btn btn-outline btn-full ai-analyze-btn" data-analyze="pacing">
            <span class="analyze-icon">⏱️</span>
            <span>Pacing Analysis</span>
          </button>
          <button class="btn btn-outline btn-full ai-analyze-btn" data-analyze="tone">
            <span class="analyze-icon">🎭</span>
            <span>Tone & Mood</span>
          </button>
          <button class="btn btn-outline btn-full ai-analyze-btn" data-analyze="consistency">
            <span class="analyze-icon">🔍</span>
            <span>Consistency Check</span>
          </button>
          <button class="btn btn-outline btn-full ai-analyze-btn" data-analyze="readability">
            <span class="analyze-icon">📊</span>
            <span>Readability Score</span>
          </button>
          <button class="btn btn-outline btn-full ai-analyze-btn" data-analyze="feedback">
            <span class="analyze-icon">✍️</span>
            <span>General Feedback</span>
          </button>
        </div>
        <div class="ai-analyze-result" id="ai-analyze-result"></div>
      </div>
    `;
  }

  afterMount() {
    // Tab switching
    this.on(this.el, 'click', (e) => {
      const tab = e.target.closest('.ai-tab');
      if (tab) {
        this.activeTab = tab.dataset.tab;
        this.refresh();
      }
    });

    // Close button
    this.on(this.el, 'click', (e) => {
      if (e.target.closest('#btn-close-ai')) {
        this.emit('ai-panel-toggle');
      }
    });

    // Send message
    const sendBtn = this.$('#btn-ai-send');
    if (sendBtn) {
      this.on(sendBtn, 'click', () => this.sendMessage());
    }

    // Input enter key
    const input = this.$('#ai-input');
    if (input) {
      this.on(input, 'keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // Quick actions
    this.on(this.el, 'click', (e) => {
      const quick = e.target.closest('[data-quick]');
      if (quick) this.handleQuickAction(quick.dataset.quick);

      const suggest = e.target.closest('[data-suggest]');
      if (suggest) this.handleSuggest(suggest.dataset.suggest);

      const analyze = e.target.closest('[data-analyze]');
      if (analyze) this.handleAnalyze(analyze.dataset.analyze);

      const action = e.target.closest('[data-action]');
      if (action) this.handleMessageAction(action.dataset.action, parseInt(action.dataset.index));
    });
  }

  refresh() {
    const body = this.$('#ai-panel-body');
    if (body) {
      body.innerHTML = this.renderTabContent();
      // Re-bind input events
      const      // Re-bind input events

      const sendBtn = this.$('#btn-ai-send');
      if (sendBtn) {
        this.on(sendBtn, 'click', () => this.sendMessage());
      }
      const input = this.$('#ai-input');
      if (input) {
        this.on(input, 'keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
          }
        });
      }
    }
  }

  formatMessage(text) {
    // Basic markdown-like formatting
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  getEditorContext() {
    const editor = this.props.editor;
    if (!editor) return {};

    const content = editor.getContent();
    const selection = editor.getSelection();
    const project = this.props.store?.currentProject;

    return {
      fullText: content,
      selectedText: selection?.text || '',
      hasSelection: selection && selection.start !== selection.end,
      projectTitle: project?.title || '',
      genre: project?.genre || '',
      characters: project?.characters || [],
      notes: project?.notes || [],
    };
  }

  async sendMessage() {
    const input = this.$('#ai-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text || this.isLoading) return;

    input.value = '';

    this.messages.push({ role: 'user', content: text });
    this.isLoading = true;
    this.refresh();
    this.scrollMessages();

    try {
      const context = this.getEditorContext();
      const response = await this.props.assistant.chat(text, context, this.messages.slice(0, -1));

      this.messages.push({ role: 'assistant', content: response });
    } catch (err) {
      this.messages.push({
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}. Please check your API key in settings.`,
      });
    }

    this.isLoading = false;
    this.refresh();
    this.scrollMessages();
  }

  async handleQuickAction(action) {
    const context = this.getEditorContext();
    let prompt = '';

    switch (action) {
      case 'continue':
        prompt = 'Continue writing from where the text left off. Match the existing style and tone. Write 2-3 paragraphs.';
        if (context.fullText) {
          prompt += `\n\nHere's the current text:\n\n${context.fullText.slice(-2000)}`;
        }
        break;
      case 'improve':
        if (!context.hasSelection) {
          this.messages.push({
            role: 'assistant',
            content: 'Please select some text in the editor first, then I can help improve it.',
          });
          this.refresh();
          return;
        }
        prompt = `Improve the following text. Enhance the prose, fix any issues, and make it more engaging while keeping the same meaning:\n\n"${context.selectedText}"`;
        break;
      case 'dialogue':
        prompt = 'Write a dialogue scene that fits the current story context.';
        if (context.characters.length > 0) {
          prompt += ` Available characters: ${context.characters.map(c => c.name).join(', ')}.`;
        }
        if (context.fullText) {
          prompt += `\n\nRecent context:\n\n${context.fullText.slice(-1000)}`;
        }
        break;
      case 'describe':
        prompt = 'Write a vivid scene description that fits the current story context. Focus on sensory details.';
        if (context.fullText) {
          prompt += `\n\nRecent context:\n\n${context.fullText.slice(-1000)}`;
        }
        break;
    }

    this.messages.push({ role: 'user', content: prompt });
    this.isLoading = true;
    this.refresh();
    this.scrollMessages();

    try {
      const response = await this.props.assistant.chat(prompt, context, this.messages.slice(0, -1));
      this.messages.push({ role: 'assistant', content: response });
    } catch (err) {
      this.messages.push({
        role: 'assistant',
        content: `Error: ${err.message}`,
      });
    }

    this.isLoading = false;
    this.refresh();
    this.scrollMessages();
  }

  async handleSuggest(type) {
    const context = this.getEditorContext();
    const resultEl = this.$('#ai-suggest-result');
    if (resultEl) resultEl.innerHTML = '<div class="ai-loading">Generating suggestions...</div>';

    let prompt = '';
    switch (type) {
      case 'plot':
        prompt = `Based on the following story, suggest 3 interesting plot directions or twists:\n\nTitle: ${context.projectTitle}\nGenre: ${context.genre}\n\n${context.fullText?.slice(-2000) || 'No content yet.'}`;
        break;
      case 'character':
        prompt = `Suggest character development ideas. Current characters: ${context.characters.map(c => `${c.name} (${c.role || 'unknown role'})`).join(', ') || 'None yet'}.\n\nStory context:\n${context.fullText?.slice(-1500) || 'No content yet.'}`;

        break;
      case 'dialogue':
        prompt = `Write a sample dialogue exchange that could fit this story.\n\nCharacters: ${context.characters.map(c => c.name).join(', ') || 'Not defined yet'}.\n\nContext:\n${context.fullText?.slice(-1500) || 'No content yet.'}`;
        break;
      case 'worldbuilding':
        prompt = `Suggest world-building details for this story.\n\nTitle: ${context.projectTitle}\nGenre: ${context.genre}\n\nContext:\n${context.fullText?.slice(-1500) || 'No content yet.'}`;
        break;
      case 'names':
        prompt = `Generate 10 character names and 5 place names that would fit this story.\n\nGenre: ${context.genre || 'General fiction'}\nTitle: ${context.projectTitle}`;
        break;
    }

    try {
      const response = await this.props.assistant.chat(prompt, context, []);
      if (resultEl) {
        resultEl.innerHTML = `
          <div class="ai-suggest-response">
            <div class="ai-message-text">${this.formatMessage(response)}</div>
            <div class="ai-message-actions">
              <button class="btn-xs btn-ghost" onclick="navigator.clipboard.writeText(${JSON.stringify(response).replace(/"/g, '&quot;')})">Copy</button>
            </div>
          </div>
        `;
      }
    } catch (err) {
      if (resultEl) {
        resultEl.innerHTML = `<div class="ai-error">Error: ${err.message}</div>`;
      }
    }
  }

  async handleAnalyze(type) {
    const context = this.getEditorContext();
    const text = context.hasSelection ? context.selectedText : context.fullText;
    const resultEl = this.$('#ai-analyze-result');

    if (!text || text.trim().length < 10) {
      if (resultEl) resultEl.innerHTML = '<div class="ai-error">Please write some text first or select text to analyze.</div>';
      return;
    }

    if (resultEl) resultEl.innerHTML = '<div class="ai-loading">Analyzing...</div>';

    let prompt = '';
    switch (type) {
      case 'pacing':
        prompt = `Analyze the pacing of the following text. Identify areas that feel too fast, too slow, or well-paced. Provide specific suggestions:\n\n${text.slice(-3000)}`;
        break;
      case 'tone':
        prompt = `Analyze the tone and mood of the following text. Describe the emotional atmosphere and whether it's consistent:\n\n${text.slice(-3000)}`;
        break;
      case 'consistency':
        prompt = `Check the following text for consistency issues - character behavior, timeline, setting details, point of view shifts, tense changes:\n\n${text.slice(-3000)}`;
        break;
      case 'readability':
        prompt = `Analyze the readability of the following text. Comment on sentence length variety, vocabulary level, paragraph structure, and overall clarity. Provide a rough readability assessment:\n\n${text.slice(-3000)}`;
        break;
      case 'feedback':
        prompt = `Provide constructive writing feedback on the following text. Cover strengths, weaknesses, and specific suggestions for improvement:\n\n${text.slice(-3000)}`;
        break;
    }

    try {
      const response = await this.props.assistant.chat(prompt, context, []);
      if (resultEl) {
        resultEl.innerHTML = `
          <div class="ai-analyze-response">
            <div class="ai-message-text">${this.formatMessage(response)}</div>
          </div>
        `;
      }
    } catch (err) {
      if (resultEl) {
        resultEl.innerHTML = `<div class="ai-error">Error: ${err.message}</div>`;
      }
    }
  }

  handleMessageAction(action, index) {
    const msg = this.messages[index];
    if (!msg || msg.role !== 'assistant') return;

    switch (action) {
      case 'insert':
        this.props.editor?.insertAtCursor(msg.content);
        break;
      case 'replace':
        this.props.editor?.replaceSelection(msg.content);
        break;
      case 'copy':
        navigator.clipboard.writeText(msg.content).catch(() => {});
        break;
    }
  }

  scrollMessages() {
    requestAnimationFrame(() => {
      const container = this.$('#ai-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
}
