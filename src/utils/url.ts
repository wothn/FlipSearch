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
 * 支持 site: 出现在查询词的任意位置：
 *   - "site:v2ex.com/t 测试" → "测试"
 *   - "测试 site:v2ex.com/t" → "测试"
 *   - "前缀 site:v2ex.com/t 后缀" → "前缀 后缀"
 * @param query - 原始查询词
 * @returns 处理后的查询词和是否为站点搜索
 */
export function parseSiteSearch(query: string): { query: string; isSiteSearch: boolean } {
  const siteMatch = query.match(/site:[^\s]+/);
  if (siteMatch) {
    // 移除 site:xxx 部分，合并多余空格
    const cleanQuery = query.replace(/\s*site:[^\s]+\s*/g, ' ').trim();
    return { query: cleanQuery, isSiteSearch: true };
  }
  return { query, isSiteSearch: false };
}

/**
 * 从 URL 模板中提取 site: 过滤器的域名
 * 用于自动获取正确的 favicon
 * 例如 "https://www.google.com/search?q=site:v2ex.com/t+%s" → "v2ex.com"
 * @param urlTemplate - 包含 %s 占位符的 URL 模板
 * @returns site 过滤器的域名，无则返回 null
 */
export function extractSiteFilterDomain(urlTemplate: string): string | null {
  const match = urlTemplate.match(/site:([^+&%\s]+)/);
  if (match) {
    // 提取纯域名部分（去掉路径，如 v2ex.com/t → v2ex.com）
    return match[1].split('/')[0];
  }
  return null;
}

/**
 * 从 URL 模板中提取搜索参数值的静态前缀（%s 之前的部分）
 * 用于精确区分同域名的不同搜索引擎（如 Google vs 基于 Google 的 site-search）
 * 例如 "https://www.google.com/search?q=site:v2ex.com/t+%s"
 *   → searchParam='q' 的前缀为 "site:v2ex.com/t "
 * @param urlTemplate - 包含 %s 占位符的 URL 模板
 * @param searchParam - 搜索参数名
 * @returns 前缀字符串，无前缀返回空字符串
 */
export function extractSearchParamPrefix(urlTemplate: string, searchParam: string): string {
  try {
    const placeholder = '__FLIPSEARCH_PH__';
    const testUrl = urlTemplate.replace('%s', encodeURIComponent(placeholder));
    const urlObj = new URL(testUrl);
    const paramValue = urlObj.searchParams.get(searchParam);
    if (!paramValue) return '';

    const idx = paramValue.indexOf(placeholder);
    if (idx <= 0) return '';

    return paramValue.substring(0, idx);
  } catch {
    return '';
  }
}
