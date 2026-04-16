/**
 * JSFuck 还原器
 * 
 * JSFuck 是一种只使用 6 个字符 (!+[]) 来编码 JavaScript 的技术。
 * 
 * 字符映射表:
 * - false:  ![]            -> ![]
 * - true:   !![]           -> !![] 
 * - NaN:    +[![]]         -> +[![]]
 * - undefined: [][[]]      -> [][[]]
 * - "":     []+[]          -> []+[]
 * - " ":    []+![]         -> (for space)
 * - 0:      +[]            -> +[]
 * - 1:      +!+[]          -> +!+[]
 * - 2:      +!+[]+!+[]     -> +!+[]+!+[]
 * - ... 以此类推
 * 
 * 参考: https://github.com/aemkei/jsfuck
 */

// 延迟导入
let t, generate;

function loadDependencies() {
  if (!t) {
    t = require('@babel/types');
    generate = require('@babel/generator').default;
  }
}

// JSFuck 基本字符映射
const JSFUCK_CHARS = {
  'false': '![]',
  'true': '!![]',
  'NaN': '+[![]]',
  'undefined': '[][[]]',
  'Infinity': '+Infinity',
  '": "': '[]+![]',
  '": "': '[]+!![]',
};

// 数字映射
const NUMBER_MAP = {
  '0': '+[]',
  '1': '+!+[]',
  '2': '+!+[]+!+[]',
  '3': '+!+[]+!+[]+!+[]',
  '4': '+!+[]+!+[]+!+[]+!+[]',
  '5': '+!+[]+!+[]+!+[]+!+[]+!+[]',
  '6': '+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]',
  '7': '+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]',
  '8': '+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]',
  '9': '+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]'
};

// 字符串映射
const STRING_MAP = {
  'a': '(![]+[])[+[]]',
  'b': '({}+[])[!+[]+!+[]]',
  'c': '({}+[])[+[]]',
  'd': '(![]+[])[!+[]+!+[]]',
  'e': '(![]+[])[!+[]+!+[]+!+[]]',
  'f': '(![]+[])[+!+[]]',
  'i': '([][0]+[])[+!+[]]',
  'l': '(![]+[])[!+[]+!+[]+!+[]]',
  'n': '([][0]+[])[+[]]',
  'o': '({}+[])[!+[]+!+[]+!+[]]',
  'r': '(!![]+[])[!+[]+!+[]]',
  's': '(![]+[])[!+[]+!+[]+!+[]+!+[]]',
  't': '(!![]+[])[+[]]',
  'u': '(!![]+[])[!+[]+!+[]+!+[]]',
  'x': '((+!+[])[{}]+[])[+!+[]]',
  'y': '((+!+[])[{}]+[])[+[]]',
  'A': '([]+[])[!+[]+!+[]]',
  'B': '([]+[])[+!+[]]',
  'C': '({}+[])[!+[]+!+[]+!+[]]',
  'I': '(+(+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]+!+[]))',
  // ... 其他字符
};

// 运算结果映射
const EVAL_RESULT_MAP = {
  '(+!+[]+[+[]])+(+!+[])': '"00"',
  // ... 更多映射
};

/**
 * 检测代码是否包含 JSFuck
 */
function isJSFuck(code) {
  // JSFuck 特征：大量使用 ! + [ ] 字符
  const cleanCode = code.replace(/\s/g, '');
  const jsfuckPattern = /^[!\+\[\]\(\)]+$/;
  const hasJSFuckChars = /[\[\]]/.test(cleanCode) && /[!+]/.test(cleanCode);
  
  // JSFuck 代码通常长度很长，且只有有限的字符
  const onlyJSFuckChars = /^[\[\]!\+\(\)]+$/.test(cleanCode);
  
  // 检查括号深度
  const bracketCount = (cleanCode.match(/[\[\]]/g) || []).length;
  
  // JSFuck 通常有很多方括号
  return (onlyJSFuckChars && bracketCount > 20) || 
         (hasJSFuckChars && onlyJSFuckChars && bracketCount > 50);
}

/**
 * 计算括号深度
 */
function countBrackets(code) {
  let count = 0;
  for (const char of code) {
    if (char === '[' || char === ']') count++;
  }
  return count;
}

/**
 * JSFuck 还原主函数
 * @param {string} code - JSFuck 编码的代码
 * @param {object} options - 配置选项
 * @returns {object} { code: string, decoded: string, stats: object }
 */
function deobfuscateJSFuck(code, options = {}) {
  loadDependencies();
  
  const stats = {
    expressionsParsed: 0,
    stringsDecoded: 0,
    callsResolved: 0
  };

  try {
    // 1. 检测 JSFuck 编码
    if (!isJSFuck(code)) {
      return {
        code: code,
        decoded: code,
        stats,
        success: false,
        error: 'Not JSFuck encoded'
      };
    }

    // 2. 解析 JSFuck 表达式
    const decoded = parseJSFuck(code, stats);
    
    // 3. 清理结果
    const cleaned = cleanResult(decoded);

    return {
      code: cleaned,
      decoded: cleaned,
      stats,
      success: true
    };
  } catch (error) {
    return {
      code: code,
      decoded: null,
      stats,
      success: false,
      error: error.message
    };
  }
}

/**
 * 解析 JSFuck 代码
 */
function parseJSFuck(code, stats) {
  // 首先尝试通过 JavaScript 引擎执行
  try {
    // 使用 Function 构造函数创建可执行的函数
    const result = executeJSFuck(code);
    if (result !== null) {
      stats.expressionsParsed++;
      return result;
    }
  } catch (e) {
    // 执行失败，继续解析
  }
  
  // 手动解析
  return manualParseJSFuck(code, stats);
}

/**
 * 通过执行来解析 JSFuck
 * 
 * 原理：JSFuck 编码的代码本身是有效的 JavaScript，
 * 可以直接在引擎中执行并获取结果。
 */
function executeJSFuck(code) {
  try {
    // 包装代码以捕获结果
    const wrappedCode = `
      (function() {
        try {
          return ${code};
        } catch(e) {
          return null;
        }
      })()
    `;
    
    // 特殊处理函数调用模式
    if (code.includes('][') && code.includes('(')) {
      // JSFuck 函数调用模式: []['method']['method'](...)
      const result = eval(code);
      return formatResult(result);
    }
    
    // 其他情况使用 Function
    const fn = new Function(`return ${code}`);
    const result = fn();
    return formatResult(result);
  } catch (e) {
    return null;
  }
}

/**
 * 格式化结果
 */
function formatResult(result) {
  if (result === undefined) return 'undefined';
  if (result === null) return 'null';
  if (typeof result === 'function') {
    // 尝试获取函数源码
    return result.toString();
  }
  return String(result);
}

/**
 * 手动解析 JSFuck
 * 
 * 这是一个简化的解析器，主要用于教育目的。
 * 对于复杂的 JSFuck 代码，推荐使用执行方法。
 */
function manualParseJSFuck(code, stats) {
  // 简化实现：识别常见的 JSFuck 模式
  
  // 移除空白
  code = code.replace(/\s+/g, '');
  
  // 检测数字
  const numberMatch = code.match(/^\+?(\[\]|\[!*\[\]|!*\[\]|!*\[\])(\+\+?)*\+$/);
  if (numberMatch) {
    stats.expressionsParsed++;
    return evaluateJSFuckNumber(code);
  }
  
  // 检测字符串
  const stringMatch = code.match(/^(\[\]|!*\[\])(\[.*?\]\+)*(\[\]|!*\[\])$/);
  if (stringMatch) {
    stats.expressionsParsed++;
    return evaluateJSFuckString(code);
  }
  
  // 如果无法手动解析，返回原始代码并添加注释
  return `/* JSFuck 编码，无法自动还原\n${code}\n*/`;
}

/**
 * 评估 JSFuck 数字表达式
 */
function evaluateJSFuckNumber(code) {
  // 简化实现
  // 实际上需要模拟 JSFuck 的求值过程
  
  // 计数 !+[] 的数量来计算数字
  let count = 0;
  const pattern = /!\+\[\]/g;
  let match;
  while ((match = pattern.exec(code)) !== null) {
    count++;
  }
  
  // 计数 +[] 的数量（表示 0）
  const zeroPattern = /\+\[\]/g;
  const zeroMatch = code.match(zeroPattern);
  const zeroCount = zeroMatch ? zeroMatch.length : 0;
  
  // 计算结果
  if (code.startsWith('+') && !code.startsWith('+!+[]')) {
    // 可能是 Infinity
    if (code.includes('+!+[]+!+[]+!+[]+!+[]+!+[]')) {
      return 'Infinity';
    }
  }
  
  return String(count - zeroCount);
}

/**
 * 评估 JSFuck 字符串表达式
 */
function evaluateJSFuckString(code) {
  // JSFuck 字符串是通过数组和运算符构建的
  // 简化的实现
  
  // []+[] = ""
  if (code === '[]+[]') return '""';
  
  // ![]+[] = "false"
  if (code === '![]+[]') return '"false"';
  
  // !![]+[] = "true"
  if (code === '!![]+[]') return '"true"';
  
  // [][[]]+[] = "undefined"
  if (code === '[][[]]+[]') return '"undefined"';
  
  // 其他情况返回原始代码
  return code;
}

/**
 * 清理还原结果
 */
function cleanResult(result) {
  if (!result) return '';
  
  // 移除引号如果是字符串
  let cleaned = String(result);
  
  // 移除首尾引号
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  
  return cleaned;
}

/**
 * 检测并还原 JSFuck 编码的字符串
 */
function detectAndDecodeJSFuck(code) {
  const results = [];
  
  // 查找类似 JSFuck 的表达式
  const pattern = /\[\][!\+\[\]\(\)]+\[\]/g;
  let match;
  
  while ((match = pattern.exec(code)) !== null) {
    const expr = match[0];
    const decoded = parseJSFuck(expr, { expressionsParsed: 0 });
    
    if (decoded && decoded !== expr) {
      results.push({
        original: expr,
        decoded: decoded
      });
    }
  }
  
  return results;
}

/**
 * 构建 JSFuck 字符串
 * 
 * 用于测试和验证
 */
function buildJSFuckString(str) {
  let result = '';
  
  for (const char of str) {
    if (STRING_MAP[char]) {
      result += STRING_MAP[char];
    } else {
      // 使用 String.fromCharCode 构建
      const code = char.charCodeAt(0);
      result += `([]+[])[${buildJSFuckNumber(code)}]`;
    }
  }
  
  return result;
}

/**
 * 构建 JSFuck 数字
 */
function buildJSFuckNumber(num) {
  if (num === 0) return '+[]';
  
  let result = '+!+[]';
  for (let i = 1; i < num; i++) {
    result += '+!+[]';
  }
  
  return result;
}

/**
 * 检测 JSFuck 编码类型
 */
function detectJSFuckType(code) {
  if (/^[\[\]!+\s]+$/.test(code)) {
    // 纯 JSFuck
    return 'pure';
  }
  
  if (/<script[^>]*>[\s\S]*?<\/script>/i.test(code)) {
    // HTML 中的 JSFuck
    return 'embedded';
  }
  
  if (/`[\[\]!+\s]+`/.test(code)) {
    // 模板字符串中的 JSFuck
    return 'template';
  }
  
  return 'unknown';
}

module.exports = {
  deobfuscateJSFuck,
  isJSFuck,
  detectAndDecodeJSFuck,
  detectJSFuckType,
  buildJSFuckString,
  buildJSFuckNumber,
  JSFUCK_CHARS,
  NUMBER_MAP,
  STRING_MAP
};
