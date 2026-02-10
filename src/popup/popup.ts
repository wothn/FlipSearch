/**
 * Popup 页面逻辑
 */
import { EngineManager } from '../core/engine-manager';
import { StorageManager } from '../core/storage';
import { setupIconWithFallback } from '../utils/icons';
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

    // 绑定搜索词输入框
    this.bindQueryInput();

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

    this.updateQueryInput();
    this.renderEngines();
  }

  private updateQueryInput(): void {
    const queryInput = document.getElementById('query-input') as HTMLInputElement;
    if (queryInput) {
      queryInput.value = this.currentQuery;
    }
  }

  private bindQueryInput(): void {
    const queryInput = document.getElementById('query-input') as HTMLInputElement;
    if (!queryInput) return;

    // 失去焦点时保存
    queryInput.addEventListener('blur', () => {
      const newQuery = queryInput.value.trim();
      if (newQuery) {
        this.currentQuery = newQuery;
      }
    });

    // 回车时保存并移除焦点
    queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        queryInput.blur();
      }
    });
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
      // 页面在 popup/ 子目录中，parentDepth = 1
      setupIconWithFallback(img, engine.icon, 1);

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
    // 如果没有搜索词，跳转到搜索引擎主页
    const targetUrl = this.currentQuery
      ? this.manager.buildSearchUrl(engine.id, this.currentQuery)
      : this.manager.getHomepageUrl(engine.id);

    if (this.openInNewTab) {
      await chrome.tabs.create({ url: targetUrl });
    } else {
      await chrome.tabs.update({ url: targetUrl });
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
