/**
 * Options 设置页面逻辑
 */
import { EngineManager } from '../core/engine-manager';
import { StorageManager } from '../core/storage';
import { extractDomain, getFaviconUrl } from '../utils/url';
import type { SearchEngine, EngineRuntimeConfig } from '../types';

class OptionsController {
  private manager!: EngineManager;
  private draggedKey: string | null = null;
  private editingEngineId: string | null = null;

  async init(): Promise<void> {
    this.manager = await EngineManager.initialize();
    this.renderEngines();
    this.bindEvents();
    
    // 加载新标签页设置
    const prefs = await StorageManager.get('userPreferences');
    const checkbox = document.getElementById('new-tab-checkbox') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = prefs.openInNewTab;
    }
  }

  private bindEvents(): void {
    // 添加/保存搜索引擎
    document.getElementById('add-engine-btn')?.addEventListener('click', () => {
      this.saveEngine();
    });

    // 取消编辑
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
      this.cancelEdit();
    });

    // 重置设置
    document.getElementById('reset-btn')?.addEventListener('click', () => {
      this.resetSettings();
    });

    // 新标签页选项
    const newTabCheckbox = document.getElementById('new-tab-checkbox') as HTMLInputElement;
    if (newTabCheckbox) {
      newTabCheckbox.addEventListener('change', async () => {
        await StorageManager.set('userPreferences', { openInNewTab: newTabCheckbox.checked });
        this.showStatus('设置已保存');
      });
    }
  }

  private renderEngines(): void {
    const container = document.getElementById('engine-list');
    if (!container) return;

    container.innerHTML = '';

    const engines = this.manager.getAllEnginesWithOrder();

    engines.forEach(({ engine, config }) => {
      const item = this.createEngineItem(engine, config);
      container.appendChild(item);
    });
  }

  private createEngineItem(
    engine: SearchEngine, 
    config: EngineRuntimeConfig
  ): HTMLElement {
    const item = document.createElement('div');
    item.className = 'engine-item';
    item.draggable = true;
    item.dataset.engineKey = engine.id;
    item.dataset.order = config.order.toString();

    if (!config.enabled) {
      item.style.opacity = '0.5';
    }

    // 拖拽手柄
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '≡';
    dragHandle.style.cursor = config.enabled ? 'move' : 'not-allowed';

    // 引擎信息
    const engineInfo = document.createElement('div');
    engineInfo.className = 'engine-info';

    const img = document.createElement('img');
    img.className = 'engine-icon';
    // 页面在 options/ 子目录中，图标在 icons/ 目录，需要 ../ 前缀
    img.src = engine.icon.startsWith('icons/') ? `../${engine.icon}` : engine.icon;
    img.onerror = () => {
      // 防止循环触发，只在第一次失败时替换
      if (!img.src.endsWith('icons/logo.png')) {
        img.src = '../icons/logo.png';
      }
    };

    const details = document.createElement('div');
    details.className = 'engine-details';
    details.innerHTML = `
      <h3>${engine.name}</h3>
      <p>${engine.url.replace('%s', '[搜索词]')}</p>
    `;

    engineInfo.appendChild(img);
    engineInfo.appendChild(details);

    // 操作按钮区域
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'engine-actions';

    if (engine.isBuiltIn) {
      // 内置引擎：启用/禁用按钮
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'toggle-btn';
      toggleBtn.textContent = config.enabled ? '禁用' : '启用';
      toggleBtn.className += config.enabled ? ' disable-btn' : ' enable-btn';
      toggleBtn.onclick = () => this.toggleEngine(engine.id, !config.enabled);
      actionsDiv.appendChild(toggleBtn);
    } else {
      // 自定义引擎：编辑和删除按钮
      const editBtn = document.createElement('button');
      editBtn.className = 'toggle-btn enable-btn';
      editBtn.textContent = '编辑';
      editBtn.onclick = () => this.startEdit(engine.id);
      actionsDiv.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'toggle-btn disable-btn';
      deleteBtn.textContent = '删除';
      deleteBtn.onclick = () => this.removeEngine(engine.id);
      actionsDiv.appendChild(deleteBtn);
    }

    item.appendChild(dragHandle);
    item.appendChild(engineInfo);
    item.appendChild(actionsDiv);

    // 绑定拖拽事件（仅启用的引擎可拖拽）
    if (config.enabled) {
      item.addEventListener('dragstart', this.handleDragStart.bind(this));
      item.addEventListener('dragover', this.handleDragOver.bind(this));
      item.addEventListener('drop', this.handleDrop.bind(this));
      item.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    return item;
  }

  private handleDragStart(e: DragEvent): void {
    const target = e.currentTarget as HTMLElement;
    this.draggedKey = target.dataset.engineKey ?? null;
    target.classList.add('dragging');
    e.dataTransfer?.setData('text/plain', this.draggedKey ?? '');
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
  }

  private async handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    
    const target = (e.currentTarget as HTMLElement)?.closest('.engine-item') as HTMLElement;
    if (!target || !this.draggedKey) return;

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
      const domain = extractDomain(url);
      icon = domain ? getFaviconUrl(domain) : '../icons/logo.png';
    }

    try {
      if (this.editingEngineId) {
        // 编辑模式：更新现有引擎
        await this.manager.updateEngine(this.editingEngineId, {
          name,
          url,
          searchParam,
          icon,
        });
        this.showStatus('搜索引擎已更新');
      } else {
        // 添加模式：添加新引擎
        await this.manager.addCustomEngine({
          name,
          url,
          searchParam,
          icon,
        });
        this.showStatus('搜索引擎已添加');
      }

      // 清空表单并退出编辑模式
      this.cancelEdit();
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

    // 填充表单
    const nameInput = document.getElementById('engine-name') as HTMLInputElement;
    const urlInput = document.getElementById('engine-url') as HTMLInputElement;
    const paramInput = document.getElementById('engine-param') as HTMLInputElement;
    const iconInput = document.getElementById('engine-icon') as HTMLInputElement;
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('add-engine-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');

    nameInput.value = engine.name;
    urlInput.value = engine.url;
    paramInput.value = engine.searchParam;
    iconInput.value = engine.icon || '';

    if (formTitle) formTitle.textContent = '编辑搜索引擎';
    if (submitBtn) submitBtn.textContent = '保存修改';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    // 滚动到表单区域
    nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nameInput.focus();
  }

  private cancelEdit(): void {
    this.editingEngineId = null;

    // 清空表单
    const nameInput = document.getElementById('engine-name') as HTMLInputElement;
    const urlInput = document.getElementById('engine-url') as HTMLInputElement;
    const paramInput = document.getElementById('engine-param') as HTMLInputElement;
    const iconInput = document.getElementById('engine-icon') as HTMLInputElement;
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('add-engine-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');

    nameInput.value = '';
    urlInput.value = '';
    paramInput.value = '';
    iconInput.value = '';

    if (formTitle) formTitle.textContent = '添加搜索引擎';
    if (submitBtn) submitBtn.textContent = '添加搜索引擎';
    if (cancelBtn) cancelBtn.style.display = 'none';
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
