const btn = document.getElementById('trigger');
const copyBtn = document.getElementById('copy');
const responseDiv = document.getElementById('response');
const statusSpan = document.getElementById('status');
const urlInput = document.getElementById('url');
const flowIdInput = document.getElementById('flowId');
const sqlInput = document.getElementById('sqlInput');
const paramsInput = document.getElementById('params');

// 存储键名
const STORAGE_KEY = 'flowRunnerState';
const SQL_HISTORY_KEY = 'flowRunnerSqlHistory';
const MAX_HISTORY = 10;

// accessSecret 相关变量
const accessSecretBtn = document.getElementById('accessSecretBtn');

// 加载保存的状态
chrome.storage.local.get([STORAGE_KEY, 'editorResult'], (data) => {
  // 先检查编辑器返回的数据（优先级最高）
  if (data.editorResult) {
    const result = data.editorResult;
    console.log('收到编辑器返回数据:', result);
    if (result.type === 'sql') {
      sqlInput.value = result.value;
    } else if (result.type === 'params') {
      paramsInput.value = result.value;
      autoResizeTextarea(paramsInput);
    }
    // 清除编辑器结果
    chrome.storage.local.remove('editorResult');
  }
  
  // 恢复保存的输入
  if (data[STORAGE_KEY]) {
    const state = data[STORAGE_KEY];
    if (state.flowId) flowIdInput.value = state.flowId;
    // 只有在没有编辑器返回数据时才恢复 SQL
    if (state.sql && !data.editorResult) {
      sqlInput.value = state.sql;
    }
    // 只有在没有编辑器返回数据时才恢复参数
    if (state.params && (!data.editorResult || data.editorResult.type !== 'params')) {
      paramsInput.value = state.params;
      autoResizeTextarea(paramsInput);
    }
    // 不再恢复 response，保持默认的"等待执行..."
  }
  
  // 保存当前状态（包括编辑器返回的数据）
  saveState();
});

// 保存状态
function saveState() {
  chrome.storage.local.set({
    [STORAGE_KEY]: {
      flowId: flowIdInput.value,
      sql: sqlInput.value,
      params: paramsInput.value
      // 不保存 response，避免旧的响应结果混淆
    }
  });
}

// 输入时自动保存
flowIdInput.addEventListener('input', saveState);
sqlInput.addEventListener('input', saveState);
paramsInput.addEventListener('input', () => {
  autoResizeTextarea(paramsInput);
  saveState();
});

// 自适应高度函数
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// 初始化时调整高度
autoResizeTextarea(paramsInput);

// 重置按钮
const resetBtn = document.getElementById('resetBtn');
resetBtn.addEventListener('click', () => {
  if (confirm('确定要重置所有输入吗？')) {
    flowIdInput.value = 'z244yolix5cg9meb';
    sqlInput.value = '';
    paramsInput.value = '{\n  "action": "run_sql"\n}';
    responseDiv.textContent = '等待执行...';
    statusSpan.textContent = '';
    statusSpan.className = 'status';
    autoResizeTextarea(paramsInput);
    chrome.storage.local.remove(STORAGE_KEY);
  }
});

// 获取 accessSecret
if (accessSecretBtn) {
  accessSecretBtn.addEventListener('click', async () => {
    const apiUrl = urlInput.value.trim();
    if (!apiUrl) {
      showResponse('请先输入 URL', false);
      return;
    }
    
    accessSecretBtn.disabled = true;
    const originalText = accessSecretBtn.textContent;
    accessSecretBtn.textContent = '⏳';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (apiUrl) => {
          try {
            const getCookie = (name) => {
              const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
              return match ? decodeURIComponent(match[2]) : null;
            };
            const authorization = getCookie('Authorization');
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'zh-CN,zh;q=0.9',
                'app-version': 'v1.2.0',
                'authorization': authorization || '',
                'content-type': 'application/json;charset=UTF-8',
                'cache-control': 'no-cache',
                'pragma': 'no-cache',
                'x-csrf-token': 'undefined'
              },
              credentials: 'include',
              body: JSON.stringify({ flowId: 'b8vwkimhdmznr57l' })
            });
            
            const data = await response.json();
            return { success: response.ok, data };
          } catch (err) {
            return { success: false, error: err.message };
          }
        },
        args: [apiUrl]
      });
      
      const res = result.result;
      if (res.success && res.data.code === 1) {
        const secret = res.data.data?.tipData?.text;
        if (secret) {
          // 自动复制
          await navigator.clipboard.writeText(secret);
          accessSecretBtn.textContent = '✓';
          accessSecretBtn.style.background = '#4caf50';
          
          // 显示提示
          showResponse(`获取 accessSecret 成功！\n已自动复制: ${secret}`, true);
          
          setTimeout(() => {
            accessSecretBtn.textContent = originalText;
            accessSecretBtn.style.background = '#0f3460';
          }, 2000);
        } else {
          throw new Error('响应数据格式不正确');
        }
      } else {
        throw new Error(res.error || res.data?.message || '获取失败');
      }
    } catch (err) {
      showResponse('获取 accessSecret 失败: ' + err.message, false);
      accessSecretBtn.textContent = originalText;
      accessSecretBtn.style.background = '#f44336';
      setTimeout(() => {
        accessSecretBtn.style.background = '#0f3460';
      }, 2000);
    } finally {
      accessSecretBtn.disabled = false;
    }
  });
}

// 复制功能
copyBtn.addEventListener('click', async () => {
  const text = responseDiv.textContent;
  await navigator.clipboard.writeText(text);
  copyBtn.textContent = '已复制';
  setTimeout(() => copyBtn.textContent = '复制', 1500);
});

// 初始化：获取当前页面域名
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url) {
    const url = new URL(tabs[0].url);
    urlInput.value = url.origin + '/api/runFlow';
  }
});

btn.addEventListener('click', async () => {
  const apiUrl = document.getElementById('url').value.trim();
  const flowId = document.getElementById('flowId').value.trim();
  const paramsText = document.getElementById('params').value.trim();
  const sqlText = document.getElementById('sqlInput').value.trim();
  
  if (!flowId) {
    showResponse('请输入 flowKey', null);
    return;
  }
  
  if (!apiUrl) {
    showResponse('请输入 URL', null);
    return;
  }
  
  // 解析 JSON 参数
  let params;
  try {
    params = JSON.parse(paramsText);
  } catch (e) {
    showResponse('JSON 格式错误: ' + e.message, null);
    return;
  }
  
  // 如果有 SQL 输入，自动合并到参数
  if (sqlText) {
    params.sql = sqlText;
    // 保存 SQL 到历史记录
    saveSqlHistory(sqlText);
  }
  
  btn.disabled = true;
  btn.textContent = '执行中...';
  showResponse('正在请求...', null);  // null 表示临时状态，不会保存
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (apiUrl, flowId, params) => {
        try {
          const getCookie = (name) => {
            const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? decodeURIComponent(match[2]) : null;
          };
          const authorization = getCookie('Authorization');
          
          // 合并 flowId 到参数
          const body = { ...params, flowId };
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'accept': 'application/json, text/plain, */*',
              'accept-language': 'zh-CN,zh;q=0.9',
              'app-version': 'v1.2.0',
              'authorization': authorization || '',
              'content-type': 'application/json;charset=UTF-8',
              'x-csrf-token': 'undefined'
            },
            credentials: 'include',
            body: JSON.stringify(body)
          });
          
          const data = await response.json();
          return { success: response.ok, status: response.status, data };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
      args: [apiUrl, flowId, params]
    });
    
    const res = result.result;
    if (res.error) {
      showResponse(res.error, false);
    } else {
      showResponse(JSON.stringify(res.data, null, 2), res.success);
    }
  } catch (err) {
    showResponse('执行失败: ' + err.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = '执行请求';
  }
});

function showResponse(text, success) {
  responseDiv.textContent = text;
  if (success === true) {
    statusSpan.textContent = '✓ 成功';
    statusSpan.className = 'status ok';
  } else if (success === false) {
    statusSpan.textContent = '✗ 失败';
    statusSpan.className = 'status fail';
  } else {
    statusSpan.textContent = '';
    statusSpan.className = 'status';
  }
  // 不保存响应结果到 storage
}

// SQL 弹框逻辑（仅保留备用的内部弹框）
const sqlModal = document.getElementById('sqlModal');
const sqlModalInput = document.getElementById('sqlModalInput');
const expandSqlBtn = document.getElementById('expandSql');
const closeModalBtn = document.getElementById('closeModal');
const confirmSqlBtn = document.getElementById('confirmSql');

// 打开独立窗口编辑器的通用函数
async function openEditor(type, value) {
  // 获取当前标签页 ID
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  const encodedValue = encodeURIComponent(value);
  const encodedUrl = encodeURIComponent(urlInput.value);
  const encodedFlowKey = encodeURIComponent(flowIdInput.value);
  const encodedParams = encodeURIComponent(paramsInput.value);
  const tabId = tab.id;
  
  // 窗口尺寸和位置 - 左上角显示
  const width = 900;
  const height = 700;
  const left = 50; // 左侧留 50px 边距
  const top = 100; // 距离顶部 100px
  
  chrome.windows.create({
    url: `editor.html?type=${type}&value=${encodedValue}&url=${encodedUrl}&flowKey=${encodedFlowKey}&params=${encodedParams}&tabId=${tabId}`,
    type: 'popup',
    width: width,
    height: height,
    left: left,
    top: top
  });
}

// SQL 放大按钮 - 使用独立窗口
expandSqlBtn.addEventListener('click', () => {
  openEditor('sql', sqlInput.value);
});

// 请求参数放大按钮 - 使用独立窗口
const expandParamsBtn = document.getElementById('expandParams');
expandParamsBtn.addEventListener('click', () => {
  openEditor('params', paramsInput.value);
});

// 响应结果放大按钮 - 使用独立窗口（只读）
const expandResponseBtn = document.getElementById('expandResponse');
expandResponseBtn.addEventListener('click', () => {
  openEditor('response', responseDiv.textContent);
});

// 监听编辑器返回的数据（popup 打开时实时监听）
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.editorResult) {
    const result = changes.editorResult.newValue;
    if (result) {
      console.log('通过 storage 监听到编辑器数据:', result);
      applyEditorResult(result);
    }
  }
});

// 监听来自编辑器的直接消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'editorResult') {
    console.log('通过消息接收到编辑器数据:', message.data);
    applyEditorResult(message.data);
    sendResponse({ success: true });
  }
});

// 应用编辑器返回的数据
function applyEditorResult(result) {
  if (result.type === 'sql') {
    sqlInput.value = result.value;
  } else if (result.type === 'params') {
    paramsInput.value = result.value;
    autoResizeTextarea(paramsInput);
  } else if (result.type === 'response') {
    // 响应结果是只读的，不需要应用回来
    return;
  }
  chrome.storage.local.remove('editorResult');
  saveState();
}

// 保留内部弹框作为备用（双击打开 SQL）
sqlInput.addEventListener('dblclick', () => {
  sqlModalInput.value = sqlInput.value;
  sqlModal.style.display = 'block';
  sqlModalInput.focus();
});

// 关闭 SQL 弹框
closeModalBtn.addEventListener('click', () => {
  sqlModal.style.display = 'none';
});

// 确认并关闭 SQL 弹框
confirmSqlBtn.addEventListener('click', () => {
  sqlInput.value = sqlModalInput.value;
  sqlModal.style.display = 'none';
  saveState();
});

// 点击遮罩关闭 SQL 弹框
sqlModal.addEventListener('click', (e) => {
  if (e.target === sqlModal) {
    sqlModal.style.display = 'none';
  }
});

// ESC 关闭 SQL 弹框
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sqlModal.style.display === 'block') {
    sqlModal.style.display = 'none';
  }
});

// ========== SQL 历史记录功能 ==========

// 保存 SQL 到历史记录
function saveSqlHistory(sql) {
  if (!sql || !sql.trim()) return;
  
  chrome.storage.local.get([SQL_HISTORY_KEY], (data) => {
    let history = data[SQL_HISTORY_KEY] || [];
    
    // 去重：如果已存在相同的 SQL，先移除
    history = history.filter(item => item.sql !== sql);
    
    // 添加到开头
    history.unshift({
      sql: sql,
      timestamp: Date.now(),
      date: new Date().toLocaleString('zh-CN')
    });
    
    // 只保留最近 MAX_HISTORY 条
    history = history.slice(0, MAX_HISTORY);
    
    chrome.storage.local.set({ [SQL_HISTORY_KEY]: history });
  });
}

// 加载并显示 SQL 历史记录
function loadSqlHistory() {
  chrome.storage.local.get([SQL_HISTORY_KEY], (data) => {
    const history = data[SQL_HISTORY_KEY] || [];
    const listDiv = document.getElementById('sqlHistoryList');
    
    if (history.length === 0) {
      listDiv.innerHTML = '<div style="text-align: center; color: #888; padding: 40px; font-size: 14px;">📭 暂无历史记录<br><span style="font-size: 12px; margin-top: 8px; display: block;">执行 SQL 后会自动保存</span></div>';
      return;
    }
    
    listDiv.innerHTML = history.map((item, index) => `
      <div class="history-item" data-index="${index}">
        <div class="history-item-header">
          <span class="history-item-time">🕐 ${item.date}</span>
          <button class="history-item-delete" data-index="${index}" onclick="event.stopPropagation()">✕ 删除</button>
        </div>
        <div class="history-item-content">${item.sql}</div>
      </div>
    `).join('');
    
    // 绑定点击事件
    listDiv.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        sqlInput.value = history[index].sql;
        sqlHistoryModal.style.display = 'none';
        saveState();
      });
    });
    
    // 绑定删除按钮
    listDiv.querySelectorAll('.history-item-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        deleteSqlHistoryItem(index);
      });
    });
  });
}

// 删除单条历史记录
function deleteSqlHistoryItem(index) {
  chrome.storage.local.get([SQL_HISTORY_KEY], (data) => {
    let history = data[SQL_HISTORY_KEY] || [];
    history.splice(index, 1);
    chrome.storage.local.set({ [SQL_HISTORY_KEY]: history }, () => {
      loadSqlHistory();
    });
  });
}

// 清空所有历史记录
function clearSqlHistory() {
  if (confirm('确定要清空所有 SQL 历史记录吗？')) {
    chrome.storage.local.set({ [SQL_HISTORY_KEY]: [] }, () => {
      loadSqlHistory();
    });
  }
}

// SQL 历史记录按钮
const sqlHistoryBtn = document.getElementById('sqlHistoryBtn');
const sqlHistoryModal = document.getElementById('sqlHistoryModal');
const closeSqlHistory = document.getElementById('closeSqlHistory');
const clearSqlHistoryBtn = document.getElementById('clearSqlHistory');

sqlHistoryBtn.addEventListener('click', () => {
  loadSqlHistory();
  sqlHistoryModal.style.display = 'block';
});

closeSqlHistory.addEventListener('click', () => {
  sqlHistoryModal.style.display = 'none';
});

clearSqlHistoryBtn.addEventListener('click', clearSqlHistory);

sqlHistoryModal.addEventListener('click', (e) => {
  if (e.target === sqlHistoryModal) {
    sqlHistoryModal.style.display = 'none';
  }
});

// ========== 新标签页查看纯 JSON ==========

const openJsonTabBtn = document.getElementById('openJsonTab');

// 在新标签页查看纯 JSON（无任何 UI），并关闭插件
openJsonTabBtn.addEventListener('click', () => {
  const text = responseDiv.textContent;
  
  if (!text || text === '等待执行...') {
    alert('暂无响应结果');
    return;
  }
  
  try {
    // 尝试解析并格式化 JSON
    const json = JSON.parse(text);
    const formatted = JSON.stringify(json, null, 2);
    
    // 创建纯文本 Blob
    const blob = new Blob([formatted], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 打开新标签页
    chrome.tabs.create({ url: url }, () => {
      // 关闭插件弹窗
      window.close();
    });
  } catch (e) {
    // 不是 JSON，直接显示原文本
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url: url }, () => {
      // 关闭插件弹窗
      window.close();
    });
  }
});