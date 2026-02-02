// 使用 common.js 中的 defaultEngines、defaultEngineOrder
let engines = { ...defaultEngines };
let customEngines = {};
let engineOrder = [...defaultEngineOrder];
let currentQuery = "";
let currentEngine = "";
let openInNewTab = false;

/**
 * 从URL中提取搜索参数
 *
 * 该函数尝试解析给定URL中的搜索关键词和对应的搜索引擎。
 * 首先会检查是否匹配已知搜索引擎的搜索参数，如果没有匹配则尝试通用搜索参数。
 * 智能识别站点搜索，如果查询包含 site: 操作符，则只保留实际的搜索词。
 *
 * @param {string} url - 需要解析的URL地址
 * @returns {Object} 包含engine和query的对象，engine表示搜索引擎标识（未识别时为null），query表示搜索关键词（未识别时为null）
 */
function extractSearchParamFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    const hostname = urlObj.hostname.toLowerCase();

    // 首先通过主机名匹配搜索引擎
    for (const [engineKey, engine] of Object.entries(engines)) {
      const engineUrlObj = new URL(engine.url);
      const engineHostname = engineUrlObj.hostname.toLowerCase();
      const engineDomain = engineHostname.replace(/^www\./, "");

      // 检查主机名是否匹配（处理 www 前缀和子域名的情况，如 cn.bing.com）
      const currentDomain = hostname.replace(/^www\./, "");
      if (
        currentDomain === engineDomain ||
        currentDomain.endsWith("." + engineDomain)
      ) {
        // 主机名匹配，再检查搜索参数
        const paramValue = params.get(engine.searchParam);
        if (paramValue) {
          let query = decodeURIComponent(paramValue);

          // 检查是否为站点搜索（包含 site: 操作符）
          const siteMatch = query.match(/site:[^\s]+\s+(.+)/);
          if (siteMatch) {
            return { engine: engineKey, query: siteMatch[1] };
          }

          return { engine: engineKey, query: query };
        }
      }
    }

    // 如果没有匹配到已知搜索引擎，则尝试常见的搜索参数名称
    for (const param of commonSearchParams) {
      const paramValue = params.get(param);
      if (paramValue) {
        let query = decodeURIComponent(paramValue);

        // 检查是否为站点搜索
        const siteMatch = query.match(/site:[^\s]+\s+(.+)/);
        if (siteMatch) {
          return { engine: null, query: siteMatch[1] };
        }

        return { engine: null, query: query };
      }
    }
  } catch (e) {
    console.error("解析URL失败:", e);
  }
  return { engine: null, query: null };
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
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      // 从标签页URL中提取搜索参数
      const result = extractSearchParamFromUrl(tabs[0].url);
      currentQuery = result.query;
      currentEngine = result.engine;

      // 更新页面中显示当前搜索查询的元素
      updateQueryDisplay();

      // 渲染搜索引擎列表
      renderEngines();
    }
  });
}

/**
 * 更新搜索词显示
 */
function updateQueryDisplay() {
  const queryText = document.getElementById("query-text");
  const queryInput = document.getElementById("query-input");

  if (currentQuery) {
    queryText.textContent = `当前搜索: ${currentQuery}`;
  } else {
    queryText.textContent = "当前未在搜索";
  }
}

/**
 * 切换到编辑模式
 */
function enableQueryEdit() {
  if (!currentQuery) return;

  const queryDisplay = document.getElementById("query-display");
  const queryText = document.getElementById("query-text");
  const queryInput = document.getElementById("query-input");

  queryDisplay.classList.add("editing");
  queryText.style.display = "none";
  queryInput.style.display = "block";
  queryInput.value = currentQuery;
  queryInput.focus();
  queryInput.select();
}

/**
 * 保存编辑后的搜索词
 */
function saveQueryEdit() {
  const queryDisplay = document.getElementById("query-display");
  const queryText = document.getElementById("query-text");
  const queryInput = document.getElementById("query-input");

  const newQuery = queryInput.value.trim();
  if (newQuery) {
    currentQuery = newQuery;
  }

  queryDisplay.classList.remove("editing");
  queryInput.style.display = "none";
  queryText.style.display = "inline";
  updateQueryDisplay();
}

/**
 * 取消编辑
 */
function cancelQueryEdit() {
  const queryDisplay = document.getElementById("query-display");
  const queryText = document.getElementById("query-text");
  const queryInput = document.getElementById("query-input");

  queryDisplay.classList.remove("editing");
  queryInput.style.display = "none";
  queryText.style.display = "inline";
}

function renderEngines() {
  const container = document.getElementById("engines-container");
  container.innerHTML = "";

  Object.entries(engines).forEach(([key, engine]) => {
    const item = document.createElement("div");
    // 标记当前所在的搜索引擎
    if (key === currentEngine) {
      item.className = "engine-item current-engine";
    } else {
      item.className = "engine-item";
    }

    const img = document.createElement("img");
    img.className = "engine-icon";
    img.src = engine.icon;
    img.onerror = function () {
      this.src = "icons/logo.png";
    };

    const name = document.createElement("span");
    name.className = "engine-name";
    name.textContent = engine.name;

    item.appendChild(img);
    item.appendChild(name);

    item.addEventListener("click", () => {
      if (currentQuery) {
        const searchUrl = engine.url.replace(
          "%s",
          encodeURIComponent(currentQuery),
        );
        if (openInNewTab) {
          chrome.tabs.create({ url: searchUrl });
        } else {
          chrome.tabs.update({ url: searchUrl });
          window.close();
        }
      }
    });

    container.appendChild(item);
  });
}

function loadEngines() {
  chrome.storage.sync.get(
    ["searchEngines", "engineOrder", "openInNewTab"],
    function (result) {
      if (result.searchEngines) {
        customEngines = result.searchEngines;
      }
      if (result.engineOrder) {
        engineOrder = result.engineOrder;
      }
      if (result.openInNewTab !== undefined) {
        openInNewTab = result.openInNewTab;
      }

      // 更新checkbox状态
      const checkbox = document.getElementById("new-tab-checkbox");
      if (checkbox) {
        checkbox.checked = openInNewTab;
      }

      // 按照设置页面的逻辑重建engines对象
      engines = {};
      engineOrder.forEach((engineKey) => {
        if (defaultEngines[engineKey]) {
          engines[engineKey] = defaultEngines[engineKey];
        } else if (customEngines[engineKey]) {
          engines[engineKey] = customEngines[engineKey];
        }
      });

      extractSearchQuery();
    },
  );
}

document.addEventListener("DOMContentLoaded", function () {
  loadEngines();

  document.getElementById("options-btn").addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });

  // 监听新标签页选项变化
  const newTabCheckbox = document.getElementById("new-tab-checkbox");
  if (newTabCheckbox) {
    newTabCheckbox.addEventListener("change", function () {
      openInNewTab = this.checked;
      chrome.storage.sync.set({ openInNewTab: openInNewTab });
    });
  }

  // 搜索词编辑功能
  const queryDisplay = document.getElementById("query-display");
  const queryInput = document.getElementById("query-input");

  // 点击搜索词区域进入编辑模式
  queryDisplay.addEventListener("click", function (e) {
    if (e.target !== queryInput && queryInput.style.display === "none") {
      enableQueryEdit();
    }
  });

  // 输入框回车保存
  queryInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      saveQueryEdit();
    } else if (e.key === "Escape") {
      cancelQueryEdit();
    }
  });

  // 输入框失去焦点时保存
  queryInput.addEventListener("blur", function () {
    saveQueryEdit();
  });
});
