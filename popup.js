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

// accessSecret 相关变量
const accessSecretBtn = document.getElementById('accessSecretBtn');

// 加载保存的状态
chrome.storage.local.get([STORAGE_KEY, 'editorResult'], (data) => {
  // 恢复保存的输入
  if (data[STORAGE_KEY]) {
    const state = data[STORAGE_KEY];
    if (state.flowId) flowIdInput.value = state.flowId;
    if (state.sql) sqlInput.value = state.sql;
    if (state.params) {
      paramsInput.value = state.params;
      autoResizeTextarea(paramsInput);
    }
    if (state.response) {
      responseDiv.textContent = state.response;
    }
  }
  
  // 检查编辑器返回的数据
  if (data.editorResult) {
    const result = data.editorResult;
    if (result.type === 'sql') {
      sqlInput.value = result.value;
    } else if (result.type === 'params') {
      paramsInput.value = result.value;
      autoResizeTextarea(paramsInput);
    }
    chrome.storage.local.remove('editorResult');
    saveState();
  }
});

// 保存状态
function saveState() {
  chrome.storage.local.set({
    [STORAGE_KEY]: {
      flowId: flowIdInput.value,
      sql: sqlInput.value,
      params: paramsInput.value,
      response: responseDiv.textContent
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
  }
  
  btn.disabled = true;
  btn.textContent = '执行中...';
  showResponse('正在请求...', null);
  
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
  // 保存响应结果
  saveState();
}

// SQL 弹框逻辑
const sqlModal = document.getElementById('sqlModal');
const sqlModalInput = document.getElementById('sqlModalInput');
const expandSqlBtn = document.getElementById('expandSql');
const expandParamsBtn = document.getElementById('expandParams');
const closeModalBtn = document.getElementById('closeModal');
const confirmSqlBtn = document.getElementById('confirmSql');

// 打开独立窗口编辑器的通用函数
function openEditor(type, value) {
  const encodedValue = encodeURIComponent(value);
  // 获取屏幕尺寸，计算居中位置
  const width = 700;
  const height = 500;
  const left = Math.round((screen.width - width) / 2);
  const top = Math.round((screen.height - height) / 2);
  
  chrome.windows.create({
    url: `editor.html?type=${type}&value=${encodedValue}`,
    type: 'popup',
    width: width,
    height: height,
    left: left,
    top: top
  });
}

// SQL 放大按钮
expandSqlBtn.addEventListener('click', () => {
  openEditor('sql', sqlInput.value);
});

// 请求参数放大按钮
expandParamsBtn.addEventListener('click', () => {
  openEditor('params', paramsInput.value);
});

// 响应结果放大按钮
const expandResponseBtn = document.getElementById('expandResponse');
expandResponseBtn.addEventListener('click', () => {
  openEditor('response', responseDiv.textContent);
});

// 监听编辑器返回的数据（popup 打开时实时监听）
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.editorResult) {
    const result = changes.editorResult.newValue;
    if (result) {
      if (result.type === 'sql') {
        sqlInput.value = result.value;
      } else if (result.type === 'params') {
        paramsInput.value = result.value;
        autoResizeTextarea(paramsInput);
      }
      chrome.storage.local.remove('editorResult');
      saveState();
    }
  }
});

// 保留内部弹框作为备用（双击打开）
sqlInput.addEventListener('dblclick', () => {
  sqlModalInput.value = sqlInput.value;
  sqlModal.style.display = 'block';
  sqlModalInput.focus();
});

// 关闭弹框
closeModalBtn.addEventListener('click', () => {
  sqlModal.style.display = 'none';
});

// 确认并关闭
confirmSqlBtn.addEventListener('click', () => {
  sqlInput.value = sqlModalInput.value;
  sqlModal.style.display = 'none';
});

// 点击遮罩关闭
sqlModal.addEventListener('click', (e) => {
  if (e.target === sqlModal) {
    sqlModal.style.display = 'none';
  }
});

// ESC 关闭
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sqlModal.style.display === 'block') {
    sqlModal.style.display = 'none';
  }
});