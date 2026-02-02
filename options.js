// 使用 common.js 中的 defaultEngines、defaultEngineOrder
let engines = { ...defaultEngines };
let customEngines = {};
let engineOrder = [...defaultEngineOrder];

function showStatus(message, type = "success") {
  const statusDiv = document.getElementById("status-message");
  statusDiv.textContent = message;
  statusDiv.className = `status-message ${type}`;
  setTimeout(() => {
    statusDiv.textContent = "";
    statusDiv.className = "status-message";
  }, 3000);
}

function saveEngines() {
  chrome.storage.sync.set(
    {
      searchEngines: customEngines,
      engineOrder: engineOrder,
    },
    function () {
      showStatus("设置已保存");
    },
  );
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

      // 加载新标签页设置
      const newTabCheckbox = document.getElementById("new-tab-checkbox");
      if (newTabCheckbox) {
        newTabCheckbox.checked = result.openInNewTab || false;
      }

      renderEngines();
    },
  );
}

function renderEngines() {
  const container = document.getElementById("engine-list");
  container.innerHTML = "";

  engineOrder.forEach((engineKey) => {
    const isDefault = defaultEngines[engineKey];
    const engine = isDefault
      ? defaultEngines[engineKey]
      : customEngines[engineKey];

    const item = document.createElement("div");
    item.className = "engine-item";
    item.draggable = true;
    item.dataset.engineKey = engineKey;

    const dragHandle = document.createElement("div");
    dragHandle.className = "drag-handle";
    dragHandle.textContent = "≡";

    const engineInfo = document.createElement("div");
    engineInfo.className = "engine-info";

    const img = document.createElement("img");
    img.className = "engine-icon";
    img.src = engine.icon;
    img.onerror = function () {
      this.src = "icons/logo.png";
    };

    const details = document.createElement("div");
    details.className = "engine-details";
    details.innerHTML = `
            <h3>${engine.name}</h3>
            <p>${engine.url.replace("%s", "[搜索词]")}</p>
        `;

    engineInfo.appendChild(img);
    engineInfo.appendChild(details);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "toggle-btn";

    if (isDefault) {
      toggleBtn.textContent = "禁用";
      toggleBtn.className += " disable-btn";
      toggleBtn.onclick = () => disableEngine(engineKey);
    } else {
      toggleBtn.textContent = "删除";
      toggleBtn.className += " disable-btn";
      toggleBtn.onclick = () => removeEngine(engineKey);
    }

    item.appendChild(dragHandle);
    item.appendChild(engineInfo);
    item.appendChild(toggleBtn);

    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragover", handleDragOver);
    item.addEventListener("drop", handleDrop);
    item.addEventListener("dragend", handleDragEnd);

    container.appendChild(item);
  });
}

function handleDragStart(e) {
  e.target.classList.add("dragging");
  e.dataTransfer.setData("text/plain", e.target.dataset.engineKey);
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDrop(e) {
  e.preventDefault();
  const draggedKey = e.dataTransfer.getData("text/plain");
  const targetKey = e.target.closest(".engine-item").dataset.engineKey;

  const draggedIndex = engineOrder.indexOf(draggedKey);
  const targetIndex = engineOrder.indexOf(targetKey);

  if (draggedIndex !== -1 && targetIndex !== -1) {
    engineOrder.splice(draggedIndex, 1);
    engineOrder.splice(targetIndex, 0, draggedKey);
    saveEngines();
    renderEngines();
  }
}

function handleDragEnd(e) {
  e.target.classList.remove("dragging");
}

function disableEngine(engineKey) {
  const index = engineOrder.indexOf(engineKey);
  if (index !== -1) {
    engineOrder.splice(index, 1);
    saveEngines();
    renderEngines();
  }
}

function removeEngine(engineKey) {
  delete customEngines[engineKey];
  const index = engineOrder.indexOf(engineKey);
  if (index !== -1) {
    engineOrder.splice(index, 1);
  }
  saveEngines();
  renderEngines();
}

function addEngine() {
  const name = document.getElementById("engine-name").value.trim();
  const url = document.getElementById("engine-url").value.trim();
  const param = document.getElementById("engine-param").value.trim();
  const icon = document.getElementById("engine-icon").value.trim();

  if (!name || !url || !param) {
    showStatus("请填写所有必填字段", "error");
    return;
  }

  if (!url.includes("%s")) {
    showStatus("URL模板必须包含 %s 作为搜索词占位符", "error");
    return;
  }

  const engineKey = name.toLowerCase().replace(/\s+/g, "_");

  if (defaultEngines[engineKey] || customEngines[engineKey]) {
    showStatus("搜索引擎已存在", "error");
    return;
  }

  // 如果没有提供图标，自动从 URL 获取 favicon
  let finalIcon = icon;
  if (!finalIcon) {
    const domain = extractDomain(url);
    if (domain) {
      finalIcon = getFaviconUrl(domain);
    } else {
      finalIcon = "icons/logo.png";
    }
  }

  customEngines[engineKey] = {
    name: name,
    url: url,
    searchParam: param,
    icon: finalIcon,
  };

  engineOrder.push(engineKey);

  document.getElementById("engine-name").value = "";
  document.getElementById("engine-url").value = "";
  document.getElementById("engine-param").value = "";
  document.getElementById("engine-icon").value = "";

  saveEngines();
  renderEngines();
}

function resetSettings() {
  if (
    confirm(
      "确定要还原到默认设置吗？这将删除所有自定义搜索引擎并恢复默认排序。",
    )
  ) {
    customEngines = {};
    engineOrder = Object.keys(defaultEngines);
    saveEngines();
    renderEngines();
    showStatus("已还原为默认设置", "success");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadEngines();

  // 为添加搜索引擎按钮添加事件监听器
  const addEngineBtn = document.getElementById("add-engine-btn");
  if (addEngineBtn) {
    addEngineBtn.addEventListener("click", addEngine);
  }

  // 为还原设置按钮添加事件监听器
  const resetBtn = document.getElementById("reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetSettings);
  }

  // 为新标签页选项添加事件监听器
  const newTabCheckbox = document.getElementById("new-tab-checkbox");
  if (newTabCheckbox) {
    newTabCheckbox.addEventListener("change", function () {
      chrome.storage.sync.set({ openInNewTab: this.checked }, function () {
        showStatus("设置已保存");
      });
    });
  }
});
