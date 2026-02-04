/**
 * 搜索引擎管理器 - 统一处理引擎的增删改查
 */
import type { SearchEngine, EngineRuntimeConfig, ExtractedSearch } from '../types';
import { StorageManager } from './storage';
import { DEFAULT_ENGINES, DEFAULT_ENGINE_ORDER, DEFAULT_ENGINE_DOMAINS } from '../common';
import { COMMON_SEARCH_PARAMS, parseSiteSearch, extractDomain } from '../utils/url';
import { migrateIfNeeded } from './migration';

export class EngineManager {
  private engines: Map<string, SearchEngine> = new Map();
  private configs: Map<string, EngineRuntimeConfig> = new Map();
  private initialized = false;

  /**
   * 初始化管理器（必须首先调用）
   */
  static async initialize(): Promise<EngineManager> {
    const manager = new EngineManager();
    await manager.load();
    return manager;
  }

  /**
   * 从存储加载数据
   */
  private async load(): Promise<void> {
    // 首先检查并执行数据迁移
    await migrateIfNeeded();

    const data = await StorageManager.getAll();
    
    this.engines.clear();
    this.configs.clear();

    // 加载所有引擎
    for (const [id, engine] of Object.entries(data.engines)) {
      this.engines.set(id, engine);
    }

    // 加载运行时配置
    for (const [id, config] of Object.entries(data.runtimeConfigs)) {
      this.configs.set(id, config);
    }

    // 如果存储为空，初始化默认数据
    if (this.engines.size === 0) {
      await this.initializeDefaultEngines();
    }

    this.initialized = true;
  }

  /**
   * 初始化默认引擎
   */
  private async initializeDefaultEngines(): Promise<void> {
    for (let i = 0; i < DEFAULT_ENGINE_ORDER.length; i++) {
      const id = DEFAULT_ENGINE_ORDER[i];
      const engine = DEFAULT_ENGINES[id];
      
      this.engines.set(id, {
        ...engine,
        id,
        isBuiltIn: true,
      });
      
      this.configs.set(id, {
        enabled: true,
        order: i,
      });
    }

    await this.save();
  }

  /**
   * 保存到存储
   */
  private async save(): Promise<void> {
    const engines: Record<string, SearchEngine> = {};
    const runtimeConfigs: Record<string, EngineRuntimeConfig> = {};

    for (const [id, engine] of this.engines) {
      engines[id] = engine;
    }

    for (const [id, config] of this.configs) {
      runtimeConfigs[id] = config;
    }

    await StorageManager.setMultiple({
      engines,
      runtimeConfigs,
    });
  }

  /**
   * 获取所有启用的引擎（按 order 排序）
   */
  getEnabledEngines(): SearchEngine[] {
    this.checkInitialized();
    
    const enabled: Array<{ engine: SearchEngine; order: number }> = [];
    
    for (const [id, engine] of this.engines) {
      const config = this.configs.get(id);
      if (config?.enabled) {
        enabled.push({ engine, order: config.order });
      }
    }

    return enabled
      .sort((a, b) => a.order - b.order)
      .map(item => item.engine);
  }

  /**
   * 获取所有引擎（用于设置页面）
   */
  getAllEnginesWithOrder(): Array<{ engine: SearchEngine; config: EngineRuntimeConfig }> {
    this.checkInitialized();
    
    const result: Array<{ engine: SearchEngine; config: EngineRuntimeConfig }> = [];
    
    for (const [id, engine] of this.engines) {
      const config = this.configs.get(id);
      if (config) {
        result.push({ engine, config });
      }
    }

    return result.sort((a, b) => a.config.order - b.config.order);
  }

  /**
   * 切换引擎启用状态
   */
  async toggleEngine(id: string, enabled: boolean): Promise<void> {
    this.checkInitialized();
    
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`Engine ${id} not found`);
    }

    config.enabled = enabled;
    this.configs.set(id, config);
    await this.save();
  }

  /**
   * 重新排序引擎
   */
  async reorderEngine(id: string, newOrder: number): Promise<void> {
    this.checkInitialized();
    
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`Engine ${id} not found`);
    }

    // 调整其他引擎的顺序
    for (const [otherId, otherConfig] of this.configs) {
      if (otherId === id) continue;
      
      if (newOrder < config.order) {
        // 向前移动：将中间项后移
        if (otherConfig.order >= newOrder && otherConfig.order < config.order) {
          otherConfig.order++;
        }
      } else {
        // 向后移动：将中间项前移
        if (otherConfig.order > config.order && otherConfig.order <= newOrder) {
          otherConfig.order--;
        }
      }
      this.configs.set(otherId, otherConfig);
    }

    config.order = newOrder;
    this.configs.set(id, config);
    await this.save();
  }

  /**
   * 添加自定义搜索引擎
   */
  async addCustomEngine(
    engineData: Omit<SearchEngine, 'id' | 'isBuiltIn'>
  ): Promise<SearchEngine> {
    this.checkInitialized();

    const id = engineData.name.toLowerCase().replace(/\s+/g, '_');

    if (this.engines.has(id)) {
      throw new Error(`Engine ${id} already exists`);
    }

    // 计算新引擎的 order（放在最后）
    let maxOrder = 0;
    for (const config of this.configs.values()) {
      maxOrder = Math.max(maxOrder, config.order);
    }

    const engine: SearchEngine = {
      ...engineData,
      id,
      isBuiltIn: false,
    };

    const config: EngineRuntimeConfig = {
      enabled: true,
      order: maxOrder + 1,
    };

    this.engines.set(id, engine);
    this.configs.set(id, config);
    await this.save();

    return engine;
  }

  /**
   * 删除自定义搜索引擎
   */
  async removeCustomEngine(id: string): Promise<void> {
    this.checkInitialized();

    const engine = this.engines.get(id);
    if (!engine) {
      throw new Error(`Engine ${id} not found`);
    }

    if (engine.isBuiltIn) {
      throw new Error(`Cannot remove built-in engine ${id}`);
    }

    this.engines.delete(id);
    this.configs.delete(id);
    await this.save();
  }

  /**
   * 更新搜索引擎（仅自定义引擎）
   */
  async updateEngine(
    id: string,
    engineData: Omit<SearchEngine, 'id' | 'isBuiltIn'>
  ): Promise<SearchEngine> {
    this.checkInitialized();

    const engine = this.engines.get(id);
    if (!engine) {
      throw new Error(`Engine ${id} not found`);
    }

    if (engine.isBuiltIn) {
      throw new Error(`Cannot update built-in engine ${id}`);
    }

    const updatedEngine: SearchEngine = {
      ...engineData,
      id,
      isBuiltIn: false,
    };

    this.engines.set(id, updatedEngine);
    await this.save();

    return updatedEngine;
  }

  /**
   * 根据ID获取搜索引擎
   */
  getEngineById(id: string): SearchEngine | null {
    this.checkInitialized();
    return this.engines.get(id) ?? null;
  }

  /**
   * 重置为默认设置
   */
  async resetToDefaults(): Promise<void> {
    this.checkInitialized();

    this.engines.clear();
    this.configs.clear();
    await this.initializeDefaultEngines();
  }

  /**
   * 从 URL 识别搜索引擎
   */
  identifyEngineFromUrl(url: string): string | null {
    this.checkInitialized();

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      const params = new URLSearchParams(urlObj.search);

      // 遍历所有引擎进行匹配
      for (const [id, engine] of this.engines) {
        const engineDomain = DEFAULT_ENGINE_DOMAINS[id] ?? extractDomain(engine.url);
        
        if (!engineDomain) continue;

        // 检查域名匹配（支持子域名）
        if (hostname === engineDomain || hostname.endsWith(`.${engineDomain}`)) {
          // 检查搜索参数
          const paramValue = params.get(engine.searchParam);
          if (paramValue) {
            return id;
          }
        }
      }
    } catch (e) {
      console.error('解析URL失败:', e);
    }

    return null;
  }

  /**
   * 从 URL 提取搜索信息
   */
  extractSearchFromUrl(url: string): ExtractedSearch {
    this.checkInitialized();

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      const params = new URLSearchParams(urlObj.search);

      // 首先匹配已知搜索引擎
      for (const [id, engine] of this.engines) {
        const config = this.configs.get(id);
        if (!config?.enabled) continue;

        const engineDomain = DEFAULT_ENGINE_DOMAINS[id] ?? extractDomain(engine.url);
        if (!engineDomain) continue;

        if (hostname === engineDomain || hostname.endsWith(`.${engineDomain}`)) {
          const paramValue = params.get(engine.searchParam);
          if (paramValue) {
            const query = decodeURIComponent(paramValue);
            const { query: parsedQuery, isSiteSearch } = parseSiteSearch(query);
            
            return {
              engineId: id,
              query: parsedQuery,
              isSiteSearch,
            };
          }
        }
      }

      // 回退到通用搜索参数检测
      for (const param of COMMON_SEARCH_PARAMS) {
        const paramValue = params.get(param);
        if (paramValue) {
          const query = decodeURIComponent(paramValue);
          const { query: parsedQuery, isSiteSearch } = parseSiteSearch(query);
          
          return {
            engineId: null,
            query: parsedQuery,
            isSiteSearch,
          };
        }
      }
    } catch (e) {
      console.error('解析URL失败:', e);
    }

    return {
      engineId: null,
      query: null,
      isSiteSearch: false,
    };
  }

  /**
   * 构建搜索 URL
   */
  buildSearchUrl(engineId: string, query: string): string {
    this.checkInitialized();

    const engine = this.engines.get(engineId);
    if (!engine) {
      throw new Error(`Engine ${engineId} not found`);
    }

    return engine.url.replace('%s', encodeURIComponent(query));
  }

  /**
   * 检查初始化状态
   */
  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error('EngineManager not initialized. Call EngineManager.initialize() first.');
    }
  }
}
