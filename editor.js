const textarea = document.getElementById('sqlContent');
const highlight = document.getElementById('highlight');
const autocomplete = document.getElementById('autocomplete');
const executeBtn = document.getElementById('executeBtn');
const cancelBtn = document.getElementById('cancelBtn');
const copyEditorBtn = document.getElementById('copyEditorBtn');
const responseDiv = document.getElementById('response');
const statusSpan = document.getElementById('status');
const statusOnly = document.getElementById('statusOnly');
const copyResultBtn = document.getElementById('copyResultBtn');
const openInTabBtn = document.getElementById('openInTabBtn');
const resultActions = document.getElementById('resultActions');

// 存储最新的响应数据
let latestResponse = null;

// 从 URL 参数获取初始值和配置
const params = new URLSearchParams(window.location.search);
const initialValue = params.get('value') || '';
const editorType = params.get('type') || 'sql';
const apiUrl = params.get('url') || '';
const flowKey = params.get('flowKey') || '';
const requestParams = params.get('params') || '{"action": "run_sql"}';
const targetTabId = parseInt(params.get('tabId')) || null;

// 设置初始值
textarea.value = initialValue;

// 根据类型设置标题和功能
const editorTitle = document.getElementById('editorTitle');
const tipText = document.getElementById('tipText');

if (editorType === 'sql') {
  editorTitle.textContent = '🚀 Flow Runner - SQL 编辑器';
  tipText.textContent = '提示：Ctrl+Enter 执行，Ctrl+/ 注释，Tab 缩进，ESC 关闭';
} else if (editorType === 'params') {
  editorTitle.textContent = '🚀 Flow Runner - 请求参数编辑器';
  // 请求参数：隐藏执行按钮和响应区域，只用于编辑
  executeBtn.style.display = 'none';
  document.querySelector('.response-header').style.display = 'none';
  document.querySelector('.response-container').style.display = 'none';
  tipText.textContent = '提示：Tab 缩进，ESC 关闭';
  cancelBtn.textContent = '确认';
} else if (editorType === 'response') {
  editorTitle.textContent = '🚀 Flow Runner - 响应结果';
  textarea.readOnly = true;
  textarea.style.cursor = 'default';
  // 响应结果：只读模式，显示复制按钮
  executeBtn.style.display = 'none';
  copyEditorBtn.style.display = 'block';
  document.querySelector('.response-header').style.display = 'none';
  document.querySelector('.response-container').style.display = 'none';
  tipText.textContent = '提示：Ctrl+F 查找，ESC 关闭';
  cancelBtn.textContent = '关闭';
}

// 自动保存内容（响应结果除外）
let saveTimeout;
if (editorType !== 'response') {
  textarea.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const dataToSave = { type: editorType, value: textarea.value };
      chrome.storage.local.set({ editorResult: dataToSave });
      chrome.runtime.sendMessage({
        action: 'editorResult',
        data: dataToSave
      }).catch(() => {});
    }, 500); // 500ms 防抖
  });
}

// SQL 关键词
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'DISTINCT',
  'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'DROP',
  'TABLE', 'INDEX', 'ALTER', 'ADD', 'COLUMN', 'PRIMARY', 'KEY', 'FOREIGN',
  'NULL', 'IS', 'TRUE', 'FALSE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'UNION', 'ALL', 'EXISTS', 'IF', 'USING', 'CROSS', 'NATURAL'
];

const SQL_FUNCTIONS = [
  'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CONCAT', 'SUBSTRING', 'LENGTH',
  'UPPER', 'LOWER', 'TRIM', 'COALESCE', 'IFNULL', 'NOW', 'DATE', 'YEAR',
  'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'CAST', 'CONVERT', 'ROUND',
  'FLOOR', 'CEIL', 'ABS', 'MOD', 'REPLACE', 'LPAD', 'RPAD',
  'DATE_FORMAT', 'STR_TO_DATE', 'DATEDIFF', 'TIMESTAMPDIFF', 'GROUP_CONCAT',
  'JSON_EXTRACT', 'JSON_OBJECT', 'JSON_ARRAY', 'FIND_IN_SET', 'INSTR'
];

// 补全列表
const COMPLETIONS = [
  ...SQL_KEYWORDS.map(k => ({ text: k, type: '关键词' })),
  ...SQL_FUNCTIONS.map(f => ({ text: f + '()', type: '函数' }))
];

// 自动补全状态
let activeIndex = 0;
let matches = [];
let currentWord = '';
let wordStart = 0;

// 获取光标位置的当前单词
function getCurrentWord() {
  const pos = textarea.selectionStart;
  const text = textarea.value;
  let start = pos;
  
  // 向前找单词开始
  while (start > 0 && /[a-zA-Z_]/.test(text[start - 1])) {
    start--;
  }
  
  return {
    word: text.substring(start, pos).toUpperCase(),
    start: start,
    end: pos
  };
}

// 显示补全列表
function showAutocomplete() {
  if (editorType !== 'sql') {
    hideAutocomplete();
    return;
  }
  
  const { word, start, end } = getCurrentWord();
  
  if (word.length < 1) {
    hideAutocomplete();
    return;
  }
  
  currentWord = word;
  wordStart = start;
  
  // 过滤匹配项
  matches = COMPLETIONS.filter(c => 
    c.text.toUpperCase().startsWith(word) && c.text.toUpperCase() !== word
  ).slice(0, 10);
  
  if (matches.length === 0) {
    hideAutocomplete();
    return;
  }
  
  activeIndex = 0;
  renderAutocomplete();
  
  // 计算位置（简单实现，固定在左下角）
  autocomplete.style.display = 'block';
  autocomplete.style.left = '12px';
  autocomplete.style.bottom = '12px';
}

// 渲染补全列表
function renderAutocomplete() {
  autocomplete.innerHTML = matches.map((m, i) => 
    `<div class="autocomplete-item ${i === activeIndex ? 'active' : ''}" data-index="${i}">
      ${m.text}<span class="type">${m.type}</span>
    </div>`
  ).join('');
}

// 隐藏补全列表
function hideAutocomplete() {
  autocomplete.style.display = 'none';
  matches = [];
}

// 应用补全
function applyCompletion(index) {
  const match = matches[index];
  if (!match) return;
  
  const before = textarea.value.substring(0, wordStart);
  const after = textarea.value.substring(textarea.selectionStart);
  
  let insertText = match.text;
  let cursorOffset = insertText.length;
  
  // 如果是函数，光标放在括号内
  if (insertText.endsWith('()')) {
    cursorOffset = insertText.length - 1;
  }
  
  textarea.value = before + insertText + after;
  textarea.selectionStart = textarea.selectionEnd = wordStart + cursorOffset;
  
  hideAutocomplete();
  updateHighlight();
  textarea.focus();
}

// 事件监听
textarea.addEventListener('input', () => {
  updateHighlight();
  showAutocomplete();
});

textarea.addEventListener('keydown', (e) => {
  // 自动补全导航
  if (autocomplete.style.display === 'block') {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % matches.length;
      renderAutocomplete();
      return;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + matches.length) % matches.length;
      renderAutocomplete();
      return;
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (matches.length > 0) {
        e.preventDefault();
        applyCompletion(activeIndex);
        return;
      }
    } else if (e.key === 'Escape') {
      hideAutocomplete();
      return;
    }
  }
  
  // 自动缩进：Enter 键保持上一行缩进
  if (e.key === 'Enter') {
    e.preventDefault();
    const pos = textarea.selectionStart;
    const text = textarea.value;
    
    // 找到当前行的开始位置
    let lineStart = pos;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    // 获取当前行的缩进
    let indent = '';
    let i = lineStart;
    while (i < pos && (text[i] === ' ' || text[i] === '\t')) {
      indent += text[i];
      i++;
    }
    
    // 检查是否需要增加缩进（上一个非空字符是 { 或 (）
    const beforeCursor = text.substring(0, pos).trimEnd();
    const lastChar = beforeCursor[beforeCursor.length - 1];
    if (lastChar === '{' || lastChar === '(' || lastChar === '[') {
      indent += '  ';
    }
    
    // 插入换行和缩进
    const before = text.substring(0, pos);
    const after = text.substring(pos);
    textarea.value = before + '\n' + indent + after;
    textarea.selectionStart = textarea.selectionEnd = pos + 1 + indent.length;
    
    updateHighlight();
  }
  
  // Tab 键插入空格
  if (e.key === 'Tab' && autocomplete.style.display !== 'block') {
    e.preventDefault();
    const pos = textarea.selectionStart;
    const text = textarea.value;
    textarea.value = text.substring(0, pos) + '  ' + text.substring(pos);
    textarea.selectionStart = textarea.selectionEnd = pos + 2;
    updateHighlight();
  }
});

textarea.addEventListener('blur', () => {
  setTimeout(hideAutocomplete, 150);
});

// 点击补全项
autocomplete.addEventListener('click', (e) => {
  const item = e.target.closest('.autocomplete-item');
  if (item) {
    applyCompletion(parseInt(item.dataset.index));
  }
});

// SQL 语法高亮 - 使用分词方式避免冲突
function highlightSQL(code) {
  // 先转义 HTML
  code = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // 用分词方式处理，避免正则冲突
  const tokens = [];
  let remaining = code;
  
  while (remaining.length > 0) {
    let matched = false;
    
    // 注释 --
    let match = remaining.match(/^(--[^\n]*)/);
    if (match) {
      tokens.push(`<span class="sql-comment">${match[1]}</span>`);
      remaining = remaining.slice(match[1].length);
      matched = true;
      continue;
    }
    
    // 注释 /* */
    match = remaining.match(/^(\/\*[\s\S]*?\*\/)/);
    if (match) {
      tokens.push(`<span class="sql-comment">${match[1]}</span>`);
      remaining = remaining.slice(match[1].length);
      matched = true;
      continue;
    }
    
    // 字符串 '...'
    match = remaining.match(/^('(?:[^'\\]|\\.)*')/);
    if (match) {
      tokens.push(`<span class="sql-string">${match[1]}</span>`);
      remaining = remaining.slice(match[1].length);
      matched = true;
      continue;
    }
    
    // 字符串 "..."
    match = remaining.match(/^("(?:[^"\\]|\\.)*")/);
    if (match) {
      tokens.push(`<span class="sql-string">${match[1]}</span>`);
      remaining = remaining.slice(match[1].length);
      matched = true;
      continue;
    }
    
    // 数字
    match = remaining.match(/^(\d+\.?\d*)/);
    if (match) {
      tokens.push(`<span class="sql-number">${match[1]}</span>`);
      remaining = remaining.slice(match[1].length);
      matched = true;
      continue;
    }
    
    // 单词（关键词、函数、标识符）
    match = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (match) {
      const word = match[1];
      const upperWord = word.toUpperCase();
      
      if (SQL_KEYWORDS.includes(upperWord)) {
        tokens.push(`<span class="sql-keyword">${word}</span>`);
      } else if (SQL_FUNCTIONS.includes(upperWord)) {
        tokens.push(`<span class="sql-function">${word}</span>`);
      } else {
        tokens.push(word);
      }
      remaining = remaining.slice(word.length);
      matched = true;
      continue;
    }
    
    // 其他字符（空格、符号等）
    tokens.push(remaining[0]);
    remaining = remaining.slice(1);
  }
  
  return tokens.join('');
}

// JSON 语法高亮
function highlightJSON(code) {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // 字符串键
  html = html.replace(/"([^"]+)"(\s*:)/g, '<span class="sql-function">"$1"</span>$2');
  // 字符串值
  html = html.replace(/:\s*"([^"]*)"/g, ': <span class="sql-string">"$1"</span>');
  // 数字
  html = html.replace(/:\s*(\d+\.?\d*)/g, ': <span class="sql-number">$1</span>');
  // 布尔和 null
  html = html.replace(/:\s*(true|false|null)\b/gi, ': <span class="sql-keyword">$1</span>');
  
  return html;
}

// 更新高亮
function updateHighlight() {
  const code = textarea.value;
  if (editorType === 'sql') {
    highlight.innerHTML = highlightSQL(code) + '\n';
  } else if (editorType === 'params' || editorType === 'response') {
    highlight.innerHTML = highlightJSON(code) + '\n';
  } else {
    highlight.innerHTML = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n';
  }
}

// 同步滚动
function syncScroll() {
  highlight.scrollTop = textarea.scrollTop;
  highlight.scrollLeft = textarea.scrollLeft;
}

// 事件监听
textarea.addEventListener('input', updateHighlight);
textarea.addEventListener('scroll', syncScroll);

// 初始化高亮
updateHighlight();

// 执行请求（仅 SQL 类型）
if (editorType === 'sql') {
  executeBtn.addEventListener('click', async () => {
    const content = textarea.value.trim();
    const flowId = flowKey.trim();
    
    if (!content) {
      showResponse(editorType === 'sql' ? '请输入 SQL 语句' : '请输入请求参数', false);
      return;
    }
    
    if (!flowId) {
      showResponse('错误：flowKey 未设置', false);
      return;
    }
    
    if (!targetTabId) {
      showResponse('错误：无法获取目标标签页', false);
      return;
    }
    
    executeBtn.disabled = true;
    executeBtn.textContent = '执行中...';
    showResponse('正在执行...', null);
    
    try {
      // SQL 模式：解析请求参数并合并 SQL
      let params;
      try {
        params = JSON.parse(requestParams);
      } catch (e) {
        params = { action: 'run_sql' };
      }
      params.sql = content;
      const body = { ...params, flowId };
      // 在目标页面执行请求（获取 Cookie）
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: async (apiUrl, body) => {
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
        args: [apiUrl, body]
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
      executeBtn.disabled = false;
      executeBtn.textContent = '▶ 执行';
    }
  });
}

// 显示响应结果（增强错误提示）
function showResponse(text, success) {
  responseDiv.textContent = text;
  latestResponse = text;
  
  if (success === true) {
    // 成功：显示操作按钮
    resultActions.style.display = 'block';
    statusOnly.style.display = 'none';
    statusSpan.textContent = '✓ 成功';
    statusSpan.className = 'status ok';
  } else if (success === false) {
    // 失败：只显示状态，并尝试解析错误
    resultActions.style.display = 'none';
    statusOnly.style.display = 'inline';
    statusOnly.textContent = '✗ 失败';
    statusOnly.className = 'status fail';
    
    // 尝试美化错误信息
    try {
      const errorObj = JSON.parse(text);
      if (errorObj.message || errorObj.error) {
        const errorMsg = errorObj.message || errorObj.error;
        const errorCode = errorObj.code || errorObj.status || '';
        responseDiv.textContent = `❌ 错误 ${errorCode}\n\n${errorMsg}\n\n完整响应：\n${text}`;
      }
    } catch (e) {
      // 不是 JSON，保持原样
    }
  } else {
    // 执行中：隐藏所有
    resultActions.style.display = 'none';
    statusOnly.style.display = 'none';
  }
}

// 取消/确认按钮
cancelBtn.addEventListener('click', () => {
  if (editorType === 'params') {
    // 请求参数：保存并关闭
    const dataToSave = { type: 'params', value: textarea.value };
    chrome.storage.local.set({ editorResult: dataToSave });
    chrome.runtime.sendMessage({
      action: 'editorResult',
      data: dataToSave
    }).catch(() => {});
  }
  window.close();
});

// 复制结果
copyResultBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(responseDiv.textContent);
  copyResultBtn.textContent = '✓ 已复制';
  setTimeout(() => copyResultBtn.textContent = '📋 复制', 1500);
});

// 复制编辑器内容（用于响应结果类型）
copyEditorBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(textarea.value);
  copyEditorBtn.textContent = '✓ 已复制';
  setTimeout(() => copyEditorBtn.textContent = '📋 复制', 1500);
});

// 在新标签页查看结果（纯 JSON，无 UI），并关闭编辑器窗口
openInTabBtn.addEventListener('click', () => {
  if (!latestResponse) return;
  
  try {
    // 尝试解析并格式化 JSON
    const json = JSON.parse(latestResponse);
    const formatted = JSON.stringify(json, null, 2);
    
    // 创建纯文本 Blob
    const blob = new Blob([formatted], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 打开新标签页
    chrome.tabs.create({ url: url }, () => {
      // 关闭编辑器窗口
      window.close();
    });
  } catch (e) {
    // 不是 JSON，直接显示原文本
    const blob = new Blob([latestResponse], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url: url }, () => {
      // 关闭编辑器窗口
      window.close();
    });
  }
});

// Ctrl+Enter 快速执行，Ctrl+/ 注释
document.addEventListener('keydown', (e) => {
  // Ctrl+Enter 执行
  if (e.ctrlKey && e.key === 'Enter' && editorType === 'sql') {
    e.preventDefault();
    executeBtn.click();
  }
  
  // Ctrl+/ 注释/取消注释（仅 SQL）
  if (e.ctrlKey && e.key === '/' && editorType === 'sql') {
    e.preventDefault();
    toggleComment();
  }
  
  // ESC 关闭
  if (e.key === 'Escape') {
    window.close();
  }
});

// 切换注释（SQL）
function toggleComment() {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  // 找到选中区域的行范围
  let lineStart = start;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') {
    lineStart--;
  }
  
  let lineEnd = end;
  while (lineEnd < text.length && text[lineEnd] !== '\n') {
    lineEnd++;
  }
  
  const lines = text.substring(lineStart, lineEnd).split('\n');
  
  // 检查是否所有行都已注释
  const allCommented = lines.every(line => line.trim().startsWith('--'));
  
  let newLines;
  if (allCommented) {
    // 取消注释
    newLines = lines.map(line => line.replace(/^\s*--\s?/, ''));
  } else {
    // 添加注释
    newLines = lines.map(line => line.trim() ? '-- ' + line : line);
  }
  
  const newText = text.substring(0, lineStart) + newLines.join('\n') + text.substring(lineEnd);
  textarea.value = newText;
  
  // 恢复选区
  textarea.selectionStart = lineStart;
  textarea.selectionEnd = lineStart + newLines.join('\n').length;
  
  updateHighlight();
}
