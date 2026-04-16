/**
 * JJEncode 还原器
 * 
 * JJEncode 使用 $ _ + ~ 等 ASCII 字符来编码 JavaScript 代码。
 * 
 * 特征：
 * - 以 $ 开头
 * - 包含 $_ $ + ~ ! ( ) 等字符
 * - 通常形如: $=~[]; $={...}; ... ; $($($...))();
 * 
 * 原理：
 * JJEncode 通过构建字符串来动态执行代码。
 * 它创建了一个 $ 对象，包含各种字符映射，
 * 然后通过字符串拼接和 eval 来执行代码。
 */

const t = require('@babel/types');
const generate = require('@babel/generator').default;

/**
 * JJEncode 特征检测
 */
const JJENCODE_PATTERN = /^\$[\$_~]+.*\(\)/;

/**
 * 检测代码是否是 JJEncode
 */
function isJJEncode(code) {
  // 清理代码
  const cleaned = code.trim();
  
  // 检查基本特征
  if (!cleaned.startsWith('$')) return false;
  if (!/^[\$_\+\~\!\(\)\[\]\{\}]+$/.test(cleaned)) return false;
  if (!cleaned.includes('=')) return false;
  
  // 检查是否包含常见的 JJEncode 结构
  const hasPattern = (
    cleaned.includes('++') ||
    cleaned.includes('({})') ||
    cleaned.includes('([])') ||
    /\$_$/.test(cleaned)
  );
  
  return hasPattern && cleaned.length > 100;
}

/**
 * JJEncode 还原主函数
 * @param {string} code - JJEncode 编码的代码
 * @param {object} options - 配置选项
 * @returns {object} { code: string, decoded: string, stats: object }
 */
function deobfuscateJJEncode(code, options = {}) {
  const stats = {
    variablesAnalyzed: 0,
    stringsReconstructed: 0,
    evalCallsFound: 0
  };

  try {
    // 1. 检测 JJEncode
    if (!isJJEncode(code)) {
      return {
        code: code,
        decoded: null,
        stats,
        success: false,
        error: 'Not JJEncode'
      };
    }

    // 2. 尝试解码
    const decoded = decodeJJEncode(code, stats);
    
    return {
      code: decoded || code,
      decoded: decoded,
      stats,
      success: decoded !== null
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
 * 解码 JJEncode
 */
function decodeJJEncode(code, stats) {
  // 尝试执行解码
  try {
    // JJEncode 本质上是可执行的 JavaScript
    // 我们需要提取最终的 eval 调用并获取其参数
    
    // 方法1：尝试执行并捕获 eval 参数
    const decoded = executeAndExtract(code, stats);
    if (decoded) return decoded;
    
    // 方法2：静态分析
    const staticDecoded = staticDecodeJJEncode(code, stats);
    if (staticDecoded) return staticDecoded;
    
  } catch (e) {
    // 执行失败
  }
  
  return null;
}

/**
 * 执行并提取解码结果
 */
function executeAndExtract(code, stats) {
  try {
    // 创建一个安全的执行环境
    const wrappedCode = `
      (function() {
        var decoded = null;
        var originalEval = eval;
        
        // 拦截 eval 调用
        window.eval = function(str) {
          decoded = str;
          // 不执行，防止副作用
          return '';
        };
        
        try {
          ${code}
        } catch(e) {}
        
        // 恢复 eval
        window.eval = originalEval;
        
        return decoded;
      })()
    `;
    
    // 在 Node.js 环境中
    if (typeof global !== 'undefined') {
      // 创建一个模拟的 window 对象
      const mockWindow = {
        eval: function(str) {
          // 检查是否是 eval 调用
          if (str) {
            throw new Error('EVAL_CALLED:' + str);
          }
          return '';
        }
      };
      
      // 修改代码以使用 mockWindow.eval
      const modifiedCode = code.replace(/\beval\s*\(/, 'mockWindow.eval(');
      
      try {
        // 尝试执行
        const fn = new Function('mockWindow', `
          with(mockWindow) {
            ${modifiedCode}
          }
        `);
        fn(mockWindow);
      } catch (e) {
        if (e.message && e.message.startsWith('EVAL_CALLED:')) {
          return e.message.slice(11);
        }
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 静态分析解码 JJEncode
 */
function staticDecodeJJEncode(code, stats) {
  // JJEncode 的结构大致是:
  // $ = ~[];
  // $ = { ___: ++$, ... };
  // ...
  // $(...)(params);
  
  // 我们需要理解 $ 对象的构建过程
  // 然后追踪最终的函数调用
  
  const lines = code.split(/[;{}]/);
  const variables = {};
  
  // 简化分析：查找常见的字符串构建模式
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 匹配: $ = "..." + "..."
    const concatMatch = trimmed.match(/\$\s*=\s*["']([^"']*)["']\s*\+\s*["']([^"']*)["']/);
    if (concatMatch) {
      stats.stringsReconstructed++;
      return concatMatch[1] + concatMatch[2];
    }
    
    // 匹配: $_ = ($) + ""
    const strBuildMatch = trimmed.match(/\$\s*=\s*\(\s*\$\s*\)\s*\+\s*["']/);
    if (strBuildMatch) {
      // 这表明正在构建字符串
    }
  }
  
  return null;
}

/**
 * 分析 JJEncode 变量结构
 */
function analyzeJJEncodeStructure(code) {
  const structure = {
    variables: [],
    stringBuilders: [],
    finalCalls: []
  };
  
  // 分割为语句
  const statements = code.split(/;(?![^()]*\))/).filter(s => s.trim());
  
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    
    // 检测变量赋值
    const varMatch = trimmed.match(/^\$[\$_]*\s*=/);
    if (varMatch) {
      structure.variables.push(trimmed);
    }
    
    // 检测字符串拼接
    if (trimmed.includes('"') || trimmed.includes("'")) {
      structure.stringBuilders.push(trimmed);
    }
    
    // 检测函数调用
    if (trimmed.includes('$(')) {
      structure.finalCalls.push(trimmed);
    }
  }
  
  return structure;
}

/**
 * 提取 JJEncode 编码的字符串
 */
function extractEncodedString(code) {
  // 尝试从 JJEncode 中提取可能的字符串常量
  const strings = [];
  
  // 匹配双引号字符串
  const doubleQuotes = code.match(/"([^"\\]|\\.)*"/g);
  if (doubleQuotes) {
    strings.push(...doubleQuotes);
  }
  
  // 匹配单引号字符串
  const singleQuotes = code.match(/'([^'\\]|\\.)*'/g);
  if (singleQuotes) {
    strings.push(...singleQuotes);
  }
  
  return strings;
}

/**
 * 解码简单的 JJEncode 表达式
 */
function decodeSimpleJJEncode(expr) {
  // JJEncode 中常见的表达式:
  // $_ = !$;
  // $_ = !!$;
  // $_ = -~$;
  // $_ = (($) + "")[$._$];
  
  // 这个简化的实现只能处理非常简单的模式
  // 实际的 JJEncode 需要完整的 JavaScript 引擎来解码
  
  if (expr === '~$') return '-1';
  if (expr === '!$') return 'false';
  if (expr === '!!$') return 'true';
  if (expr === '!$') return 'false';
  if (expr === '-$') return '-1';
  
  return null;
}

/**
 * JJEncode 验证函数
 */
function validateJJEncode(code) {
  // 检查代码是否看起来像是有效的 JJEncode
  const checks = {
    startsWithDollar: code.trim().startsWith('$'),
    hasAssignment: code.includes('='),
    hasParentheses: code.includes('(') && code.includes(')'),
    hasBrackets: code.includes('[') && code.includes(']'),
    hasEvalPattern: /\$_/.test(code),
    reasonableLength: code.length > 50 && code.length < 100000
  };
  
  const passedChecks = Object.values(checks).filter(Boolean).length;
  
  return {
    isValid: passedChecks >= 4,
    confidence: passedChecks / Object.keys(checks).length,
    checks
  };
}

/**
 * 清理还原后的代码
 */
function cleanDecodedCode(code) {
  if (!code) return '';
  
  // 移除首尾空白
  let cleaned = code.trim();
  
  // 检查是否是函数定义或表达式
  if (cleaned.startsWith('function') || 
      cleaned.startsWith('(') ||
      cleaned.startsWith('{')) {
    return cleaned;
  }
  
  // 如果看起来像代码但不是完整的，尝试包装
  if (!cleaned.endsWith(';') && !cleaned.endsWith('}') && !cleaned.endsWith(')')) {
    // 可能需要添加分号
  }
  
  return cleaned;
}

module.exports = {
  deobfuscateJJEncode,
  isJJEncode,
  detectAndDecodeJJEncode: extractEncodedString,
  analyzeJJEncodeStructure,
  validateJJEncode,
  cleanDecodedCode,
  JJENCODE_PATTERN
};
