/**
 * URL 解析工具函数
 */

/** 常见的搜索参数名称列表（用于回退检测） */
export const COMMON_SEARCH_PARAMS = ['q', 'query', 'search', 'text', 'wd', 'keyword'] as const;

/**
 * 从URL中提取域名（去除www前缀）
 * @param url - 完整的URL字符串
 * @returns 处理后的域名，解析失败返回null
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    console.error('解析URL失败:', url, e);
    return null;
  }
}

/**
 * 获取网站的favicon图标URL
 * 使用Google的favicon服务
 * @param domain - 域名
 * @param size - 图标尺寸（默认32）
 * @returns favicon URL
 */
export function getFaviconUrl(domain: string, size = 32): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

/**
 * 检查是否为站点搜索并提取实际搜索词
 * @param query - 原始查询词
 * @returns 处理后的查询词和是否为站点搜索
 */
export function parseSiteSearch(query: string): { query: string; isSiteSearch: boolean } {
  const siteMatch = query.match(/site:[^\s]+\s+(.+)/);
  if (siteMatch) {
    return { query: siteMatch[1], isSiteSearch: true };
  }
  return { query, isSiteSearch: false };
}
