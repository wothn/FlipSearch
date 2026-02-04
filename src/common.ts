/**
 * FlipSearch - 共享配置和默认数据
 */
import type { SearchEngine } from './types';

/** 内置搜索引擎配置（不包含 id 和 isBuiltIn，由使用者填充） */
export const DEFAULT_ENGINES: Record<string, Omit<SearchEngine, 'id' | 'isBuiltIn'>> = {
  google: {
    name: 'Google',
    url: 'https://www.google.com/search?q=%s',
    icon: 'icons/google.png',
    searchParam: 'q',
  },
  baidu: {
    name: '百度',
    url: 'https://www.baidu.com/s?wd=%s',
    icon: 'icons/baidu.png',
    searchParam: 'wd',
  },
  bing: {
    name: 'Bing',
    url: 'https://www.bing.com/search?q=%s',
    icon: 'icons/bing.png',
    searchParam: 'q',
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q=%s',
    icon: 'icons/ddg.png',
    searchParam: 'q',
  },
  yandex: {
    name: 'Yandex',
    url: 'https://yandex.com/search/?text=%s',
    icon: 'icons/yandex.png',
    searchParam: 'text',
  },
};

/** 默认引擎顺序 */
export const DEFAULT_ENGINE_ORDER = Object.keys(DEFAULT_ENGINES);

/** 默认引擎域名映射（用于快速匹配） */
export const DEFAULT_ENGINE_DOMAINS: Record<string, string> = Object.fromEntries(
  Object.entries(DEFAULT_ENGINES).map(([key, engine]) => {
    const urlObj = new URL(engine.url);
    const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    return [key, domain];
  })
);
