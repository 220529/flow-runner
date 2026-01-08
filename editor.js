const textarea = document.getElementById('sqlContent');
const highlight = document.getElementById('highlight');
const autocomplete = document.getElementById('autocomplete');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');

// 从 URL 参数获取初始值和类型
const params = new URLSearchParams(window.location.search);
const initialValue = params.get('value') || '';
const editorType = params.get('type') || 'sql';

// 设置标题
const titles = {
  sql: '📝 SQL 编辑器',
  params: '📝 JSON 编辑器',
  response: '📋 响应结果'
};
document.getElementById('editorTitle').textContent = titles[editorType] || '📝 编辑器';

// 响应结果只读
if (editorType === 'response') {
  textarea.readOnly = true;
  confirmBtn.textContent = '关闭';
}

textarea.value = initialValue;

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
  } else {
    highlight.innerHTML = highlightJSON(code) + '\n';
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

// 确认并关闭
confirmBtn.addEventListener('click', () => {
  chrome.storage.local.set({ 
    editorResult: { type: editorType, value: textarea.value }
  }, () => {
    window.close();
  });
});

// 取消
cancelBtn.addEventListener('click', () => {
  window.close();
});

// 复制
const copyBtn = document.getElementById('copyBtn');
copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(textarea.value);
  copyBtn.textContent = '✓ 已复制';
  setTimeout(() => copyBtn.textContent = '📋 复制', 1500);
});

// Ctrl+Enter 快速确认
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    confirmBtn.click();
  }
  if (e.key === 'Escape') {
    window.close();
  }
});
