export class App extends Component {
  constructor() {
    super();
    this.store = new ProjectStore();
    this.assistant = new WritingAssistant(this.store);
    this.theme = new ThemeManager();
    this.router = new Router();

    this.loadSettings();
  }

  async loadSettings() {
    const settings = await this.store.db.getSetting('llm-config');
    if (settings) {
      try {
        this.assistant.configure(settings);
      } catch (e) {
        console.warn('Failed to configure LLM from saved settings:', e);

      }
    }
  }

  async init() {
    await this.store.init();

    this.router.addRoute('/', () => this.showProjects());
    this.router.addRoute('/project/:id', (params) => this.showEditor(params.id));
    this.router.addRoute('/settings', () => this.showSettings());

    this.render();
    this.router.start();
  }

  render() {
    const container = document.getElementById('app');
    container.innerHTML = '';
    container.className = 'app-container';

    container.innerHTML = `
      <header class="header-bar" id="header"></header>
      <div class="app-body">
        <aside class="sidebar" id="sidebar"></aside>
        <main class="main-content" id="main-content"></main>
      </div>
    `;

    this.headerBar = new HeaderBar({
      store: this.store,
      router: this.router,
      onMenuToggle: () => this.toggleSidebar(),
    });
    this.headerBar.mount(document.getElementById('header'));

    this.sidebar = new Sidebar({
      store: this.store,
      router: this.router,
      assistant: this.assistant,
    });
    this.sidebar.mount(document.getElementById('sidebar'));
  }

  showProjects() {
    this.headerBar.update({ view: 'projects' });
    this.sidebar.update({ view: 'projects' });
    const view = new ProjectsView({
      store: this.store,
      router: this.router,
    });
    view.mount(document.getElementById('main-content'));
  }

  showEditor(projectId) {
    this.store.loadProject(projectId).then(() => {
      this.headerBar.update({ view: 'editor', project: this.store.currentProject });
      this.sidebar.update({ view: 'editor', project: this.store.currentProject });
      const view = new EditorView({
        store: this.store,
        assistant: this.assistant,
        router: this.router,
      });
      view.mount(document.getElementById('main-content'));
    });
  }

  showSettings() {
    this.headerBar.update({ view: 'settings' });
    this.sidebar.update({ view: 'settings' });
    const view = new SettingsView({
      store: this.store,
      assistant: this.assistant,
      theme: this.theme,
    });
    view.mount(document.getElementById('main-content'));
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
  }
}
