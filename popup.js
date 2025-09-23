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

let engines = {...defaultEngines};
let customEngines = {};
let engineOrder = Object.keys(defaultEngines);
let currentQuery = "";
let currentEngine = "";

/**
 * 从URL中提取搜索参数
 * 
 * 该函数尝试解析给定URL中的搜索关键词和对应的搜索引擎。
 * 首先会检查是否匹配已知搜索引擎的搜索参数，如果没有匹配则尝试通用搜索参数。
 * 
 * @param {string} url - 需要解析的URL地址
 * @returns {Object} 包含engine和query的对象，engine表示搜索引擎标识（未识别时为null），query表示搜索关键词（未识别时为null）
 */
function extractSearchParamFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const params = new URLSearchParams(urlObj.search);

        // 遍历已知搜索引擎配置，检查URL中是否包含对应搜索参数
        for (const [engineKey, engine] of Object.entries(engines)) {
            const paramValue = params.get(engine.searchParam);
            if (paramValue) {
                return {engine: engineKey, query: decodeURIComponent(paramValue)};
            }
        }

        // 如果没有匹配到已知搜索引擎，则尝试常见的搜索参数名称
        const commonParams = ['q', 'query', 'search', 'text', 'wd', 'keyword'];
        for (const param of commonParams) {
            const paramValue = params.get(param);
            if (paramValue) {
                return {engine: null, query: decodeURIComponent(paramValue)};
            }
        }
    } catch (e) {
        console.error("解析URL失败:", e);
    }
    return {engine: null, query: null};
}

/**
 * 提取当前活动标签页中的搜索查询参数
 * 
 * 该函数通过Chrome扩展API获取当前活动的标签页，分析其URL以提取搜索关键词和搜索引擎信息，
 * 并更新用户界面显示当前搜索状态。
 * 
 * @returns {void} 无返回值
 */
function extractSearchQuery() {
    // 获取当前活动的标签页
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
            // 从标签页URL中提取搜索参数
            const result = extractSearchParamFromUrl(tabs[0].url);
            currentQuery = result.query;
            currentEngine = result.engine;

            // 更新页面中显示当前搜索查询的元素
            const queryDiv = document.getElementById('current-query');
            if (currentQuery) {
                queryDiv.textContent = `当前搜索: ${currentQuery}`;
            } else {
                queryDiv.textContent = "当前未在搜索";
            }

            // 渲染搜索引擎列表
            renderEngines();
        }
    });
}

function renderEngines() {
    const container = document.getElementById('engines-container');
    container.innerHTML = '';

    Object.entries(engines).forEach(([key, engine]) => {
        const item = document.createElement('div');
        item.className = 'engine-item';

        if (key === currentEngine) {
            item.style.backgroundColor = '#d0e8f2';
        }

        const img = document.createElement('img');
        img.className = 'engine-icon';
        img.src = engine.icon;
        img.onerror = function() {
            this.src = 'icons/logo.png';
        };

        const name = document.createElement('span');
        name.className = 'engine-name';
        name.textContent = engine.name;

        item.appendChild(img);
        item.appendChild(name);

        item.addEventListener('click', () => {
            if (currentQuery) {
                const searchUrl = engine.url.replace('%s', encodeURIComponent(currentQuery));
                chrome.tabs.update({url: searchUrl});
                window.close();
            }
        });

        container.appendChild(item);
    });
}

function loadEngines() {
    chrome.storage.sync.get(['searchEngines', 'engineOrder'], function(result) {
        if (result.searchEngines) {
            customEngines = result.searchEngines;
        }
        if (result.engineOrder) {
            engineOrder = result.engineOrder;
        }

        // 按照设置页面的逻辑重建engines对象
        engines = {};
        engineOrder.forEach(engineKey => {
            if (defaultEngines[engineKey]) {
                engines[engineKey] = defaultEngines[engineKey];
            } else if (customEngines[engineKey]) {
                engines[engineKey] = customEngines[engineKey];
            }
        });

        extractSearchQuery();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    loadEngines();

    document.getElementById('options-btn').addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
    });
});