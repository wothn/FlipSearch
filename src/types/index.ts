/**
 * FlipSearch - 核心类型定义
 */

/** 搜索引擎定义 */
export interface SearchEngine {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly icon: string;
  readonly searchParam: string;
  readonly isBuiltIn: boolean;
}

/** 引擎运行时配置（启停+排序） */
export interface EngineRuntimeConfig {
  enabled: boolean;
  order: number;
}

/** 主题类型 */
export type Theme = 'light' | 'dark' | 'minimal';

/** 用户偏好设置 */
export interface UserPreferences {
  openInNewTab: boolean;
  theme: Theme;
}

/** 存储 Schema v1 */
export interface StorageSchema {
  schemaVersion: number;
  engines: Record<string, SearchEngine>;
  runtimeConfigs: Record<string, EngineRuntimeConfig>;
  userPreferences: UserPreferences;
}

/** 搜索提取结果 */
export interface ExtractedSearch {
  engineId: string | null;
  query: string | null;
  isSiteSearch: boolean;
}

/** Chrome Storage 类型封装 */
export type StorageKeys = keyof StorageSchema;

/** 旧版存储结构（用于迁移） */
export interface LegacyStorage {
  searchEngines?: Record<string, Omit<SearchEngine, 'isBuiltIn' | 'id'>>;
  engineOrder?: string[];
  openInNewTab?: boolean;
}
