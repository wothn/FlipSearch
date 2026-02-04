/**
 * 数据迁移模块 - 处理从旧版数据结构到新结构的迁移
 */
import type { StorageSchema, SearchEngine, EngineRuntimeConfig, LegacyStorage } from '../types';
import { StorageManager } from './storage';
import { DEFAULT_ENGINES, DEFAULT_ENGINE_ORDER } from '../common';

/**
 * 检查是否需要迁移并执行
 */
export async function migrateIfNeeded(): Promise<void> {
  const schemaVersion = await StorageManager.get('schemaVersion');
  
  // schemaVersion 为 0 或不存在表示是旧数据
  if (schemaVersion === 0 || schemaVersion === undefined) {
    await migrateFromLegacy();
  }
}

/**
 * 从旧版数据结构迁移
 * 旧格式: { searchEngines: {...}, engineOrder: [...], openInNewTab: boolean }
 * 新格式: { schemaVersion: 1, engines: {...}, runtimeConfigs: {...}, userPreferences: {...} }
 */
async function migrateFromLegacy(): Promise<void> {
  console.log('[FlipSearch] 开始数据迁移...');

  try {
    // 1. 读取旧格式数据
    const legacyData = await chrome.storage.sync.get([
      'searchEngines',
      'engineOrder',
      'openInNewTab',
    ]) as LegacyStorage;

    // 2. 构建新的数据结构
    const newSchema: StorageSchema = {
      schemaVersion: 1,
      engines: {},
      runtimeConfigs: {},
      userPreferences: {
        openInNewTab: legacyData.openInNewTab ?? false,
      },
    };

    // 3. 转换内置引擎
    const oldOrder = legacyData.engineOrder ?? DEFAULT_ENGINE_ORDER;
    
    for (const [id, engine] of Object.entries(DEFAULT_ENGINES)) {
      newSchema.engines[id] = {
        ...engine,
        id,
        isBuiltIn: true,
      };
      
      newSchema.runtimeConfigs[id] = {
        enabled: oldOrder.includes(id),
        order: oldOrder.indexOf(id) >= 0 ? oldOrder.indexOf(id) : 999,
      };
    }

    // 4. 转换自定义引擎
    if (legacyData.searchEngines) {
      for (const [id, engine] of Object.entries(legacyData.searchEngines)) {
        newSchema.engines[id] = {
          ...engine,
          id,
          isBuiltIn: false,
        };
        
        newSchema.runtimeConfigs[id] = {
          enabled: oldOrder.includes(id),
          order: oldOrder.indexOf(id) >= 0 ? oldOrder.indexOf(id) : 999,
        };
      }
    }

    // 5. 写入新结构
    await StorageManager.setMultiple({
      schemaVersion: newSchema.schemaVersion,
      engines: newSchema.engines,
      runtimeConfigs: newSchema.runtimeConfigs,
      userPreferences: newSchema.userPreferences,
    });

    // 6. 清理旧数据
    await StorageManager.remove(['searchEngines', 'engineOrder']);

    console.log('[FlipSearch] 数据迁移完成');
  } catch (error) {
    console.error('[FlipSearch] 数据迁移失败:', error);
    // 迁移失败时初始化默认数据
    await initializeDefaultData();
  }
}

/**
 * 初始化默认数据（用于新用户或迁移失败）
 */
async function initializeDefaultData(): Promise<void> {
  const engines: Record<string, SearchEngine> = {};
  const runtimeConfigs: Record<string, EngineRuntimeConfig> = {};

  for (let i = 0; i < DEFAULT_ENGINE_ORDER.length; i++) {
    const id = DEFAULT_ENGINE_ORDER[i];
    const engine = DEFAULT_ENGINES[id];
    
    engines[id] = {
      ...engine,
      id,
      isBuiltIn: true,
    };
    
    runtimeConfigs[id] = {
      enabled: true,
      order: i,
    };
  }

  await StorageManager.setMultiple({
    schemaVersion: 1,
    engines,
    runtimeConfigs,
    userPreferences: {
      openInNewTab: false,
    },
  });
}
