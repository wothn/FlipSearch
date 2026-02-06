/**
 * Popup 页面逻辑
 */
import { EngineManager } from '../core/engine-manager';
import { StorageManager } from '../core/storage';
import type { SearchEngine } from '../types';

class PopupController {
  private manager!: EngineManager;
  private currentQuery = '';
  private currentEngineId: string | null = null;
  private openInNewTab = false;

  async init(): Promise<void> {
    this.manager = await EngineManager.initialize();

    // 加载用户偏好设置
    const prefs = await StorageManager.get('userPreferences');
    this.openInNewTab = prefs.openInNewTab;

    // 应用主题
    const theme = prefs.theme ?? 'light';
    document.documentElement.setAttribute('data-theme', theme);

    // 设置新标签页复选框状态
    const checkbox = document.getElementById('new-tab-checkbox') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = this.openInNewTab;
      checkbox.addEventListener('change', this.handleNewTabChange.bind(this));
    }

    // 绑定设置按钮
    document.getElementById('options-btn')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 绑定搜索词编辑功能
    this.bindQueryEditEvents();

    // 提取并显示当前搜索
    await this.extractCurrentSearch();
  }

  private async extractCurrentSearch(): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (currentTab?.url) {
      const result = this.manager.extractSearchFromUrl(currentTab.url);
      this.currentQuery = result.query ?? '';
      this.currentEngineId = result.engineId;
    }

    this.updateQueryDisplay();
    this.renderEngines();
  }

  private updateQueryDisplay(): void {
    const queryText = document.getElementById('query-text');
    if (queryText) {
      queryText.textContent = this.currentQuery 
        ? `当前搜索: ${this.currentQuery}` 
        : '当前未在搜索';
    }
  }

  private bindQueryEditEvents(): void {
    const queryDisplay = document.getElementById('query-display');
    const queryInput = document.getElementById('query-input') as HTMLInputElement;

    if (!queryDisplay || !queryInput) return;

    // 点击进入编辑模式
    queryDisplay.addEventListener('click', (e) => {
      if (e.target !== queryInput && queryInput.style.display === 'none' && this.currentQuery) {
        this.enableQueryEdit();
      }
    });

    // 回车保存，ESC 取消
    queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveQueryEdit();
      } else if (e.key === 'Escape') {
        this.cancelQueryEdit();
      }
    });

    // 失去焦点时保存
    queryInput.addEventListener('blur', () => {
      this.saveQueryEdit();
    });
  }

  private enableQueryEdit(): void {
    const queryDisplay = document.getElementById('query-display');
    const queryText = document.getElementById('query-text');
    const queryInput = document.getElementById('query-input') as HTMLInputElement;

    if (!queryDisplay || !queryText || !queryInput) return;

    queryDisplay.classList.add('editing');
    queryText.style.display = 'none';
    queryInput.style.display = 'block';
    queryInput.value = this.currentQuery;
    queryInput.focus();
    queryInput.select();
  }

  private saveQueryEdit(): void {
    const queryDisplay = document.getElementById('query-display');
    const queryText = document.getElementById('query-text');
    const queryInput = document.getElementById('query-input') as HTMLInputElement;

    if (!queryDisplay || !queryText || !queryInput) return;

    const newQuery = queryInput.value.trim();
    if (newQuery) {
      this.currentQuery = newQuery;
    }

    queryDisplay.classList.remove('editing');
    queryInput.style.display = 'none';
    queryText.style.display = 'inline';
    this.updateQueryDisplay();
  }

  private cancelQueryEdit(): void {
    const queryDisplay = document.getElementById('query-display');
    const queryText = document.getElementById('query-text');
    const queryInput = document.getElementById('query-input') as HTMLInputElement;

    if (!queryDisplay || !queryText || !queryInput) return;

    queryDisplay.classList.remove('editing');
    queryInput.style.display = 'none';
    queryText.style.display = 'inline';
  }

  private renderEngines(): void {
    const container = document.getElementById('engines-container');
    if (!container) return;

    container.innerHTML = '';

    const engines = this.manager.getEnabledEngines();

    engines.forEach((engine) => {
      const item = document.createElement('div');
      item.className = engine.id === this.currentEngineId 
        ? 'engine-item current-engine' 
        : 'engine-item';

      const img = document.createElement('img');
      img.className = 'engine-icon';
      // 页面在 popup/ 子目录中，图标在 icons/ 目录，需要 ../ 前缀
      img.src = engine.icon.startsWith('icons/') ? `../${engine.icon}` : engine.icon;
      img.onerror = () => {
        // 防止循环触发，只在第一次失败时替换
        if (!img.src.endsWith('icons/logo.png')) {
          img.src = '../icons/logo.png';
        }
      };

      const name = document.createElement('span');
      name.className = 'engine-name';
      name.textContent = engine.name;

      item.appendChild(img);
      item.appendChild(name);

      item.addEventListener('click', () => this.handleEngineClick(engine));

      container.appendChild(item);
    });
  }

  private async handleEngineClick(engine: SearchEngine): Promise<void> {
    if (!this.currentQuery) return;

    const searchUrl = this.manager.buildSearchUrl(engine.id, this.currentQuery);

    if (this.openInNewTab) {
      await chrome.tabs.create({ url: searchUrl });
    } else {
      await chrome.tabs.update({ url: searchUrl });
      window.close();
    }
  }

  private async handleNewTabChange(e: Event): Promise<void> {
    const checkbox = e.target as HTMLInputElement;
    this.openInNewTab = checkbox.checked;
    const currentTheme = document.documentElement.getAttribute('data-theme') ?? 'light';
    await StorageManager.set('userPreferences', {
      openInNewTab: this.openInNewTab,
      theme: currentTheme as import('../types').Theme,
    });
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const controller = new PopupController();
  controller.init().catch(console.error);
});
