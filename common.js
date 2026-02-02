/**
 * 搜索引擎切换器 - 共享模块
 * 包含默认搜索引擎配置和通用工具函数
 */

/**
 * 默认搜索引擎配置
 * @type {Object.<string, {name: string, url: string, icon: string, searchParam: string}>}
 */
const defaultEngines = {
    google: {
        name: "Google",
        url: "https://www.google.com/search?q=%s",
        icon: "icons/google.png",
        searchParam: "q"
    },
    baidu: {
        name: "百度",
        url: "https://www.baidu.com/s?wd=%s",
        icon: "icons/baidu.png",
        searchParam: "wd"
    },
    bing: {
        name: "Bing",
        url: "https://www.bing.com/search?q=%s",
        icon: "icons/bing.png",
        searchParam: "q"
    },
    duckduckgo: {
        name: "DuckDuckGo",
        url: "https://duckduckgo.com/?q=%s",
        icon: "icons/ddg.png",
        searchParam: "q"
    },
    yandex: {
        name: "Yandex",
        url: "https://yandex.com/search/?text=%s",
        icon: "icons/yandex.png",
        searchParam: "text"
    }
};

/**
 * 默认引擎顺序
 * @type {string[]}
 */
const defaultEngineOrder = Object.keys(defaultEngines);

/**
 * 常见的搜索参数名称列表
 * 用于当URL不匹配已知搜索引擎时的回退检测
 * @type {string[]}
 */
const commonSearchParams = ['q', 'query', 'search', 'text', 'wd', 'keyword'];

/**
 * 从URL中提取域名（去除www前缀）
 * @param {string} url - 完整的URL字符串
 * @returns {string|null} - 处理后的域名，解析失败返回null
 */
function extractDomain(url) {
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
 * @param {string} domain - 域名
 * @param {number} size - 图标尺寸（默认32）
 * @returns {string} - favicon URL
 */
function getFaviconUrl(domain, size = 32) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

/**
 * 预解析的默认引擎域名映射
 * 用于快速匹配搜索引擎
 * @type {Object.<string, string>}
 */
const defaultEngineDomains = Object.fromEntries(
    Object.entries(defaultEngines).map(([key, engine]) => {
        const domain = extractDomain(engine.url);
        return [key, domain];
    })
);
