/**
 * Options 设置页面逻辑
 */
import { EngineManager } from '../core/engine-manager';
import { StorageManager } from '../core/storage';
import { extractDomain, getFaviconUrl, extractSiteFilterDomain } from '../utils/url';
import type { SearchEngine, EngineRuntimeConfig, Theme } from '../types';

class OptionsController {
  private manager!: EngineManager;
  private draggedKey: string | null = null;
  private editingEngineId: string | null = null;
  private currentTheme: Theme = 'light';

  async init(): Promise<void> {
    this.manager = await EngineManager.initialize();
    
    // 加载用户偏好设置
    const prefs = await StorageManager.get('userPreferences');
    this.currentTheme = prefs.theme ?? 'light';
    
    // 应用主题
    this.applyTheme(this.currentTheme);
    
    this.renderEngines();
    this.updateStats();
    this.bindEvents();
    
    // 加载新标签页设置
    const checkbox = document.getElementById('new-tab-checkbox') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = prefs.openInNewTab;
    }
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
    
    // 更新主题选择器状态（新样式 .theme-card）
    document.querySelectorAll('.theme-card').forEach(option => {
      option.classList.toggle('active', option.getAttribute('data-theme') === theme);
    });
    
    // 兼容旧样式
    document.querySelectorAll('.theme-option').forEach(option => {
      option.classList.toggle('active', option.getAttribute('data-theme') === theme);
    });
  }

  private async handleThemeChange(theme: Theme): Promise<void> {
    this.currentTheme = theme;
    this.applyTheme(theme);
    
    await StorageManager.set('userPreferences', {
      openInNewTab: (document.getElementById('new-tab-checkbox') as HTMLInputElement)?.checked ?? false,
      theme,
    });
    
    this.showStatus('主题已切换');
  }

  private bindEvents(): void {
    // 侧边导航切换
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = (e.currentTarget as HTMLElement).dataset.section;
        if (section) {
          this.switchSection(section);
        }
      });
    });

    // 添加/保存搜索引擎
    document.getElementById('add-engine-btn')?.addEventListener('click', () => {
      this.saveEngine();
    });

    // 取消编辑
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
      this.closeModal();
    });

    // 模态框关闭按钮
    document.getElementById('modal-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    // 点击遮罩关闭模态框
    document.getElementById('engine-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeModal();
      }
    });

    // 浮动添加按钮
    document.getElementById('fab-add-engine')?.addEventListener('click', () => {
      this.openModal();
    });

    // 重置设置
    document.getElementById('reset-btn')?.addEventListener('click', () => {
      this.resetSettings();
    });

    // 新标签页选项
    const newTabCheckbox = document.getElementById('new-tab-checkbox') as HTMLInputElement;
    if (newTabCheckbox) {
      newTabCheckbox.addEventListener('change', async () => {
        await StorageManager.set('userPreferences', {
          openInNewTab: newTabCheckbox.checked,
          theme: this.currentTheme,
        });
        this.showStatus('设置已保存');
      });
    }

    // 主题选择器（新样式 .theme-card）
    document.querySelectorAll('.theme-card').forEach(option => {
      option.addEventListener('click', () => {
        const theme = option.getAttribute('data-theme') as Theme;
        this.handleThemeChange(theme);
      });
    });
  }

  private switchSection(section: string): void {
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', (item as HTMLElement).dataset.section === section);
    });

    // 更新内容区
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `${section}-section`);
    });

    // 更新页面标题
    const titles: Record<string, { title: string; desc: string }> = {
      general: { title: '通用设置', desc: '配置扩展的基本行为' },
      appearance: { title: '主题外观', desc: '个性化你的界面风格' },
      engines: { title: '搜索引擎', desc: '管理和配置搜索源' },
    };

    const titleEl = document.getElementById('page-title');
    const descEl = document.getElementById('page-desc');
    if (titleEl) titleEl.textContent = titles[section].title;
    if (descEl) descEl.textContent = titles[section].desc;

    // 显示/隐藏浮动按钮
    const fab = document.getElementById('fab-add-engine');
    if (fab) {
      fab.style.display = section === 'engines' ? 'flex' : 'none';
    }
  }

  private openModal(): void {
    this.editingEngineId = null;
    this.resetForm();
    
    const modalTitle = document.getElementById('modal-title');
    const submitBtn = document.getElementById('add-engine-btn');
    
    if (modalTitle) modalTitle.textContent = '添加搜索引擎';
    if (submitBtn) submitBtn.textContent = '添加';
    
    document.getElementById('engine-modal')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  private closeModal(): void {
    document.getElementById('engine-modal')?.classList.remove('active');
    document.body.style.overflow = '';
    this.cancelEdit();
  }

  private updateStats(): void {
    const engines = this.manager.getAllEnginesWithOrder();
    const total = engines.length;
    const enabled = engines.filter(e => e.config.enabled).length;
    const custom = engines.filter(e => !e.engine.isBuiltIn).length;

    const totalEl = document.getElementById('total-engines');
    const enabledEl = document.getElementById('enabled-engines');
    const customEl = document.getElementById('custom-engines');

    if (totalEl) totalEl.textContent = total.toString();
    if (enabledEl) enabledEl.textContent = enabled.toString();
    if (customEl) customEl.textContent = custom.toString();
  }

  private renderEngines(): void {
    const container = document.getElementById('engine-list');
    if (!container) return;

    container.innerHTML = '';

    const engines = this.manager.getAllEnginesWithOrder();

    engines.forEach(({ engine, config }, index) => {
      const item = this.createEngineCard(engine, config, index);
      container.appendChild(item);
    });
    
    this.updateStats();
  }

  private createEngineCard(
    engine: SearchEngine, 
    config: EngineRuntimeConfig,
    index: number
  ): HTMLElement {
    const card = document.createElement('div');
    card.className = 'engine-card';
    card.draggable = config.enabled;
    card.dataset.engineKey = engine.id;
    card.dataset.order = config.order.toString();

    if (!config.enabled) {
      card.classList.add('disabled');
    }

    // 序号
    const orderNum = document.createElement('div');
    orderNum.className = 'engine-order-number';
    orderNum.textContent = (index + 1).toString();

    // 拖拽手柄
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="12" r="1"></circle>
        <circle cx="9" cy="5" r="1"></circle>
        <circle cx="9" cy="19" r="1"></circle>
        <circle cx="15" cy="12" r="1"></circle>
        <circle cx="15" cy="5" r="1"></circle>
        <circle cx="15" cy="19" r="1"></circle>
      </svg>
    `;
    dragHandle.style.cursor = config.enabled ? 'grab' : 'not-allowed';

    // 引擎图标
    const img = document.createElement('img');
    img.className = 'engine-card-icon';
    img.src = engine.icon.startsWith('icons/') ? `../${engine.icon}` : engine.icon;
    img.onerror = () => {
      if (!img.src.endsWith('icons/logo.png')) {
        img.src = '../icons/logo.png';
      }
    };

    // 引擎信息
    const info = document.createElement('div');
    info.className = 'engine-card-info';
    info.innerHTML = `
      <h4 class="engine-card-name">${engine.name}</h4>
      <p class="engine-card-url">${engine.url.replace('%s', '[搜索词]').substring(0, 45)}${engine.url.length > 45 ? '...' : ''}</p>
    `;

    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'engine-card-actions';

    // 启用/禁用开关
    const toggle = document.createElement('div');
    toggle.className = `engine-toggle ${config.enabled ? 'enabled' : ''}`;
    toggle.title = config.enabled ? '点击禁用' : '点击启用';
    toggle.onclick = () => this.toggleEngine(engine.id, !config.enabled);
    actions.appendChild(toggle);

    // 编辑按钮（仅自定义引擎）
    if (!engine.isBuiltIn) {
      const editBtn = document.createElement('button');
      editBtn.className = 'engine-btn';
      editBtn.title = '编辑';
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.onclick = () => this.startEdit(engine.id);
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'engine-btn delete';
      deleteBtn.title = '删除';
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.onclick = () => this.removeEngine(engine.id);
      actions.appendChild(deleteBtn);
    }

    card.appendChild(orderNum);
    card.appendChild(dragHandle);
    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(actions);

    // 绑定拖拽事件（仅启用的引擎可拖拽）
    if (config.enabled) {
      card.addEventListener('dragstart', this.handleDragStart.bind(this));
      card.addEventListener('dragenter', this.handleDragEnter.bind(this));
      card.addEventListener('dragover', this.handleDragOver.bind(this));
      card.addEventListener('dragleave', this.handleDragLeave.bind(this));
      card.addEventListener('drop', this.handleDrop.bind(this));
      card.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    return card;
  }

  private handleDragStart(e: DragEvent): void {
    const target = e.currentTarget as HTMLElement;
    this.draggedKey = target.dataset.engineKey ?? null;
    target.classList.add('dragging');
    e.dataTransfer?.setData('text/plain', this.draggedKey ?? '');
    e.dataTransfer!.effectAllowed = 'move';
  }

  private handleDragEnter(e: DragEvent): void {
    e.preventDefault();
    const target = (e.currentTarget as HTMLElement)?.closest('.engine-card') as HTMLElement;
    if (!target || target.dataset.engineKey === this.draggedKey) return;
    
    // 添加悬停效果
    target.style.borderColor = 'var(--color-primary)';
    target.style.backgroundColor = 'var(--color-primary-light)';
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  }

  private handleDragLeave(e: DragEvent): void {
    const target = (e.currentTarget as HTMLElement)?.closest('.engine-card') as HTMLElement;
    if (!target) return;
    
    // 移除悬停效果
    target.style.borderColor = '';
    target.style.backgroundColor = '';
  }

  private async handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    
    const target = (e.currentTarget as HTMLElement)?.closest('.engine-card') as HTMLElement;
    if (!target || !this.draggedKey) return;

    // 清除悬停效果
    target.style.borderColor = '';
    target.style.backgroundColor = '';

    const targetKey = target.dataset.engineKey;
    if (!targetKey || targetKey === this.draggedKey) return;

    try {
      await this.manager.reorderEngine(this.draggedKey, parseInt(target.dataset.order ?? '0'));
      this.renderEngines();
      this.showStatus('排序已更新');
    } catch (error) {
      console.error('Reorder failed:', error);
      this.showStatus('排序失败', 'error');
    }
  }

  private handleDragEnd(e: DragEvent): void {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('dragging');
    this.draggedKey = null;
    
    // 清除所有悬停效果
    document.querySelectorAll('.engine-card').forEach(card => {
      (card as HTMLElement).style.borderColor = '';
      (card as HTMLElement).style.backgroundColor = '';
    });
  }

  private async toggleEngine(id: string, enabled: boolean): Promise<void> {
    try {
      await this.manager.toggleEngine(id, enabled);
      this.renderEngines();
      this.showStatus(enabled ? '引擎已启用' : '引擎已禁用');
    } catch (error) {
      console.error('Toggle engine failed:', error);
      this.showStatus('操作失败', 'error');
    }
  }

  private async removeEngine(id: string): Promise<void> {
    try {
      await this.manager.removeCustomEngine(id);
      this.renderEngines();
      this.showStatus('搜索引擎已删除');
    } catch (error) {
      console.error('Remove engine failed:', error);
      this.showStatus('删除失败', 'error');
    }
  }

  private async saveEngine(): Promise<void> {
    const nameInput = document.getElementById('engine-name') as HTMLInputElement;
    const urlInput = document.getElementById('engine-url') as HTMLInputElement;
    const paramInput = document.getElementById('engine-param') as HTMLInputElement;
    const iconInput = document.getElementById('engine-icon') as HTMLInputElement;

    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    const searchParam = paramInput.value.trim();
    let icon = iconInput.value.trim();

    // 验证
    if (!name || !url || !searchParam) {
      this.showStatus('请填写所有必填字段', 'error');
      return;
    }

    if (!url.includes('%s')) {
      this.showStatus('URL模板必须包含 %s 作为搜索词占位符', 'error');
      return;
    }

    // 自动获取图标
    if (!icon) {
      const siteDomain = extractSiteFilterDomain(url);
      if (siteDomain) {
        icon = getFaviconUrl(siteDomain);
      } else {
        const domain = extractDomain(url);
        icon = domain ? getFaviconUrl(domain) : '../icons/logo.png';
      }
    }

    try {
      if (this.editingEngineId) {
        await this.manager.updateEngine(this.editingEngineId, {
          name,
          url,
          searchParam,
          icon,
        });
        this.showStatus('搜索引擎已更新');
      } else {
        await this.manager.addCustomEngine({
          name,
          url,
          searchParam,
          icon,
        });
        this.showStatus('搜索引擎已添加');
      }

      this.closeModal();
      this.renderEngines();
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        this.showStatus('搜索引擎已存在', 'error');
      } else {
        console.error('Save engine failed:', error);
        this.showStatus(this.editingEngineId ? '更新失败' : '添加失败', 'error');
      }
    }
  }

  private startEdit(engineId: string): void {
    const engine = this.manager.getEngineById(engineId);
    if (!engine) return;

    this.editingEngineId = engineId;

    const nameInput = document.getElementById('engine-name') as HTMLInputElement;
    const urlInput = document.getElementById('engine-url') as HTMLInputElement;
    const paramInput = document.getElementById('engine-param') as HTMLInputElement;
    const iconInput = document.getElementById('engine-icon') as HTMLInputElement;
    const modalTitle = document.getElementById('modal-title');
    const submitBtn = document.getElementById('add-engine-btn');

    nameInput.value = engine.name;
    urlInput.value = engine.url;
    paramInput.value = engine.searchParam;
    iconInput.value = engine.icon || '';

    if (modalTitle) modalTitle.textContent = '编辑搜索引擎';
    if (submitBtn) submitBtn.textContent = '保存';

    document.getElementById('engine-modal')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  private resetForm(): void {
    const nameInput = document.getElementById('engine-name') as HTMLInputElement;
    const urlInput = document.getElementById('engine-url') as HTMLInputElement;
    const paramInput = document.getElementById('engine-param') as HTMLInputElement;
    const iconInput = document.getElementById('engine-icon') as HTMLInputElement;

    nameInput.value = '';
    urlInput.value = '';
    paramInput.value = '';
    iconInput.value = '';
  }

  private cancelEdit(): void {
    this.editingEngineId = null;
    this.resetForm();
  }

  private async resetSettings(): Promise<void> {
    if (confirm('确定要还原到默认设置吗？这将删除所有自定义搜索引擎并恢复默认排序。')) {
      try {
        await this.manager.resetToDefaults();
        this.renderEngines();
        this.showStatus('已还原为默认设置');
      } catch (error) {
        console.error('Reset failed:', error);
        this.showStatus('还原失败', 'error');
      }
    }
  }

  private showStatus(message: string, type: 'success' | 'error' = 'success'): void {
    const statusDiv = document.getElementById('status-message');
    if (!statusDiv) return;

    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;

    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = 'status-message';
    }, 3000);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const controller = new OptionsController();
  controller.init().catch(console.error);
});
