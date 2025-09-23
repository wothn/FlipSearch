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

function showStatus(message, type = 'success') {
    const statusDiv = document.getElementById('status-message');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status-message';
    }, 3000);
}

function saveEngines() {
    chrome.storage.sync.set({
        searchEngines: customEngines,
        engineOrder: engineOrder
    }, function() {
        showStatus('设置已保存');
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
        renderEngines();
    });
}

function renderEngines() {
    const container = document.getElementById('engine-list');
    container.innerHTML = '';

    engineOrder.forEach(engineKey => {
        const isDefault = defaultEngines[engineKey];
        const engine = isDefault ? defaultEngines[engineKey] : customEngines[engineKey];

        const item = document.createElement('div');
        item.className = 'engine-item';
        item.draggable = true;
        item.dataset.engineKey = engineKey;

        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = '≡';

        const engineInfo = document.createElement('div');
        engineInfo.className = 'engine-info';

        const img = document.createElement('img');
        img.className = 'engine-icon';
        img.src = engine.icon;
        img.onerror = function() {
            this.src = 'icons/logo.png';
        };

        const details = document.createElement('div');
        details.className = 'engine-details';
        details.innerHTML = `
            <h3>${engine.name}</h3>
            <p>${engine.url.replace('%s', '[搜索词]')}</p>
        `;

        engineInfo.appendChild(img);
        engineInfo.appendChild(details);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'toggle-btn';

        if (isDefault) {
            toggleBtn.textContent = '禁用';
            toggleBtn.className += ' disable-btn';
            toggleBtn.onclick = () => disableEngine(engineKey);
        } else {
            toggleBtn.textContent = '删除';
            toggleBtn.className += ' disable-btn';
            toggleBtn.onclick = () => removeEngine(engineKey);
        }

        item.appendChild(dragHandle);
        item.appendChild(engineInfo);
        item.appendChild(toggleBtn);

        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);

        container.appendChild(item);
    });
}

function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.engineKey);
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const draggedKey = e.dataTransfer.getData('text/plain');
    const targetKey = e.target.closest('.engine-item').dataset.engineKey;

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
    e.target.classList.remove('dragging');
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
    const name = document.getElementById('engine-name').value.trim();
    const url = document.getElementById('engine-url').value.trim();
    const param = document.getElementById('engine-param').value.trim();
    const icon = document.getElementById('engine-icon').value.trim();

    if (!name || !url || !param) {
        showStatus('请填写所有必填字段', 'error');
        return;
    }

    if (!url.includes('%s')) {
        showStatus('URL模板必须包含 %s 作为搜索词占位符', 'error');
        return;
    }

    const engineKey = name.toLowerCase().replace(/\s+/g, '_');
    
    if (defaultEngines[engineKey] || customEngines[engineKey]) {
        showStatus('搜索引擎已存在', 'error');
        return;
    }

    customEngines[engineKey] = {
        name: name,
        url: url,
        searchParam: param,
        icon: icon || 'icons/logo.png'
    };

    engineOrder.push(engineKey);

    document.getElementById('engine-name').value = '';
    document.getElementById('engine-url').value = '';
    document.getElementById('engine-param').value = '';
    document.getElementById('engine-icon').value = '';

    saveEngines();
    renderEngines();
}

document.addEventListener('DOMContentLoaded', function() {
    loadEngines();
    
    // 为添加搜索引擎按钮添加事件监听器
    const addEngineBtn = document.getElementById('add-engine-btn');
    if (addEngineBtn) {
        addEngineBtn.addEventListener('click', addEngine);
    }
});