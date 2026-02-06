/**
 * Chrome Storage 封装管理器
 */
import type { StorageSchema, StorageKeys } from '../types';

const DEFAULT_SCHEMA: StorageSchema = {
  schemaVersion: 1,
  engines: {},
  runtimeConfigs: {},
  userPreferences: {
    openInNewTab: false,
    theme: 'light',
  },
};

export class StorageManager {
  /**
   * 获取单个存储项
   */
  static async get<K extends StorageKeys>(key: K): Promise<StorageSchema[K]> {
    const result = await chrome.storage.sync.get(key);
    return result[key] ?? DEFAULT_SCHEMA[key];
  }

  /**
   * 设置单个存储项
   */
  static async set<K extends StorageKeys>(
    key: K,
    value: StorageSchema[K]
  ): Promise<void> {
    await chrome.storage.sync.set({ [key]: value });
  }

  /**
   * 获取所有存储数据
   */
  static async getAll(): Promise<StorageSchema> {
    const keys = Object.keys(DEFAULT_SCHEMA) as StorageKeys[];
    const result = await chrome.storage.sync.get(keys);
    return { ...DEFAULT_SCHEMA, ...result } as StorageSchema;
  }

  /**
   * 批量设置存储数据
   */
  static async setMultiple(data: Partial<StorageSchema>): Promise<void> {
    await chrome.storage.sync.set(data);
  }

  /**
   * 删除存储项
   */
  static async remove(keys: string | string[]): Promise<void> {
    await chrome.storage.sync.remove(keys);
  }

  /**
   * 清空所有存储
   */
  static async clear(): Promise<void> {
    await chrome.storage.sync.clear();
  }
}
