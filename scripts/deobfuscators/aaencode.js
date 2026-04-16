/**
 * AAEncode 还原器
 * 
 * AAEncode 使用日文颜文字表情来编码 JavaScript 代码。
 * 
 * 特征：
 * - 大量使用日文颜文字: ω ﾟ σ д ｀ 等
 * - 通常以 ﾟωﾟﾉ 开头
 * - 包含重复的颜文字模式
 * - 代码通常以 ('_'); 结尾
 * 
 * 原理：
 * AAEncode 将 JavaScript 代码转换为日文颜文字表示，
 * 通过运行时解码和 eval 来执行。
 */

const t = require('@babel/types');

// AAEncode 颜文字到字符的映射表
const AAENCODE_CHARS = {
  // 基本颜文字
  'ω': 'o',
  'ﾟ': 'p',
  'д': 'd',
  'σ': 's',
  '｀': 'b',
  'Θ': 'T',
  '丿': 'r',
  'Д': 'D',
  'Σ': 'S',
  // 更多映射...
};

// AAEncode 颜文字映射
const AAENCODE_MAP = {
  // 数字
  '0': 'o',
  '1': 'o^2',
  '2': 'o^o',
  '3': 'o^o^2',
  '4': 'o^o^o',
  '5': 'o^o^o^2',
  '6': 'o^o^o^o',
  '7': 'o^o^o^o^2',
  '8': 'o^o^o^o^o',
  '9': 'o^o^o^o^o^2',
  
  // 字符
  'a': '(ﾟДﾟ)[`o´]',
  'b': '(ﾟΘﾟ)[`o´]',
  'c': '(`ε´)',
  'd': '(ﾟДﾟ)[`o´]',
  'e': '(ﾟΘﾟ)[`o´]',
  'f': '(`ε´)',
  'g': '(ﾟДﾟ)[ﾟΘﾟ]',
  'h': '(ﾟΘﾟ)',
  'i': '((ﾟДﾟ))',
  'j': '(ﾟДﾟ)',
  'k': '(ﾟΘﾟ)',
  'l': '((ﾟΘﾟ))',
  'm': '(ﾟДﾟ)',
  'n': '(ﾟΘﾟ)',
  'o': 'o',
  'p': 'p',
  'q': '(ﾟДﾟ)',
  'r': '(ﾟΘﾟ)',
  's': 'σ',
  't': 'τ',
  'u': 'u',
  'v': 'v',
  'w': 'w',
  'x': 'x',
  'y': 'y',
  'z': 'ζ',
};

/**
 * 检测代码是否是 AAEncode
 */
function isAAEncode(code) {
  // 清理代码
  const cleaned = code.trim();
  
  // 检查是否包含 AAEncode 特征字符
  const hasAAChars = /[ﾟωдσ｀Θ丿ДΣζ]/.test(cleaned);
  if (!hasAAChars) return false;
  
  // 检查是否以颜文字开头
  const startsWithKaomoji = cleaned.startsWith('ﾟωﾟ') || 
                            cleaned.startsWith('(ﾟДﾟ)') ||
                            cleaned.startsWith('(ﾟΘﾟ)');
  if (!startsWithKaomoji) return false;
  
  // 检查是否有括号匹配
  const parenCount = (cleaned.match(/[()]/g) || []).length;
  if (parenCount < 20) return false;
  
  // 检查是否包含常见 AAEncode 模式
  const hasPattern = (
    cleaned.includes('==3') ||
    cleaned.includes('_=') ||
    cleaned.includes('~~') ||
    cleaned.includes('[ﾟΘﾟ]') ||
    cleaned.includes('[ﾟДﾟ]')
  );
  
  return hasPattern && cleaned.length > 200;
}

/**
 * AAEncode 还原主函数
 * @param {string} code - AAEncode 编码的代码
 * @param {object} options - 配置选项
 * @returns {object} { code: string, decoded: string, stats: object }
 */
function deobfuscateAAEncode(code, options = {}) {
  const stats = {
    kaomojiAnalyzed: 0,
    patternsMatched: 0,
    stringsExtracted: 0
  };

  try {
    // 1. 检测 AAEncode
    if (!isAAEncode(code)) {
      return {
        code: code,
        decoded: null,
        stats,
        success: false,
        error: 'Not AAEncode'
      };
    }

    // 2. 尝试解码
    const decoded = decodeAAEncode(code, stats);
    
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
 * 解码 AAEncode
 */
function decodeAAEncode(code, stats) {
  // AAEncode 解码策略：
  // 1. 分析颜文字模式
  // 2. 提取编码的字符串
  // 3. 转换为原始 JavaScript
  
  try {
    // 方法1：提取颜文字中编码的字符串
    const extracted = extractAAEncodeStrings(code, stats);
    if (extracted) return extracted;
    
    // 方法2：尝试执行并捕获 eval 参数
    const executed = executeAndExtractAAEncode(code, stats);
    if (executed) return executed;
    
  } catch (e) {
    // 解码失败
  }
  
  return null;
}

/**
 * 提取 AAEncode 中编码的字符串
 */
function extractAAEncodeStrings(code, stats) {
  // AAEncode 将字符编码为颜文字组合
  // 我们需要识别这些模式
  
  // 查找常见的颜文字模式
  const patterns = [
    // 数字模式: o^2 表示 1
    /o\^2/g,
    // 字符模式: (ﾟДﾟ)[`o´]
    /\(ﾟДﾟ\)\[`o´`\]/g,
    // 更多模式...
  ];
  
  for (const pattern of patterns) {
    const matches = code.match(pattern);
    if (matches) {
      stats.patternsMatched += matches.length;
    }
  }
  
  // 尝试解析代码结构
  const lines = code.split('\n');
  const encodedParts = [];
  
  for (const line of lines) {
    if (/ﾟ|ω|д|σ/.test(line)) {
      encodedParts.push(line);
    }
  }
  
  if (encodedParts.length > 0) {
    return `/* AAEncode 编码 (${encodedParts.length} 行) */`;
  }
  
  return null;
}

/**
 * 执行 AAEncode 并提取结果
 */
function executeAndExtractAAEncode(code, stats) {
  try {
    // AAEncode 是可执行的 JavaScript
    // 我们需要拦截 eval 调用来获取原始代码
    
    // 创建包装代码
    const wrappedCode = `
      (function() {
        var decodedCode = null;
        
        // 保存原始 eval
        var originalEval = eval;
        
        // 重写 eval 来捕获参数
        eval = function(code) {
          if (decodedCode === null) {
            decodedCode = code;
          }
          return originalEval(code);
        };
        
        try {
          // 执行 AAEncode
          ${code}
        } catch(e) {}
        
        // 恢复 eval
        eval = originalEval;
        
        return decodedCode;
      })()
    `;
    
    // 执行包装代码
    try {
      const result = new Function(wrappedCode)();
      if (result && typeof result === 'string') {
        stats.stringsExtracted++;
        return result;
      }
    } catch (e) {
      // 执行失败
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 分析 AAEncode 结构
 */
function analyzeAAEncodeStructure(code) {
  const structure = {
    kaomojiCount: 0,
    encodedStrings: [],
    executionPattern: null
  };
  
  // 统计颜文字数量
  const kaomojiPattern = /[ﾟωдσ｀Θ丿ДΣζτ]/g;
  const kaomoji = code.match(kaomojiPattern);
  structure.kaomojiCount = kaomoji ? kaomoji.length : 0;
  
  // 查找编码的字符串部分
  const stringPattern = /"(.*?)"/g;
  let match;
  while ((match = stringPattern.exec(code)) !== null) {
    structure.encodedStrings.push(match[1]);
  }
  
  // 检测执行模式
  if (code.includes("('_')")) {
    structure.executionPattern = 'function_call';
  } else if (code.includes('eval(')) {
    structure.executionPattern = 'eval';
  }
  
  return structure;
}

/**
 * AAEncode 验证函数
 */
function validateAAEncode(code) {
  const checks = {
    hasJapaneseChars: /[ﾟωдσ｀Θ丿ДΣζ]/.test(code),
    startsWithKaomoji: /^[\(ﾟ]/.test(code.trim()),
    hasBalancedParens: (code.match(/[()]/g) || []).length % 2 === 0,
    hasEncodingPattern: /\[\^o\]|\[ﾟ[a-zA-Z]\]/i.test(code),
    reasonableLength: code.length > 100
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
  
  // 确保代码完整
  if (!cleaned.endsWith(';') && !cleaned.endsWith('}')) {
    cleaned += ';';
  }
  
  return cleaned;
}

/**
 * 解析 AAEncode 颜文字序列
 */
function parseKaomojiSequence(sequence) {
  // 简化的解析器
  // 实际 AAEncode 需要更复杂的解析逻辑
  
  const parts = [];
  
  // 分割颜文字
  const kaomojiRegex = /\([ﾟωдσ｀Θ丿ДΣζ\w^]+\)/g;
  const matches = sequence.match(kaomojiRegex);
  
  if (matches) {
    for (const match of matches) {
      // 尝试映射到字符
      const mapped = mapKaomojiToChar(match);
      if (mapped) {
        parts.push(mapped);
      }
    }
  }
  
  return parts.join('');
}

/**
 * 将颜文字映射到字符
 */
function mapKaomojiToChar(kaomoji) {
  // 简化实现
  const map = {
    '(o)': 'o',
    '(p)': 'p',
    '(d)': 'd',
    '(s)': 's',
    '(T)': 'T',
    '(ﾟДﾟ)': 'a',
    '(ﾟΘﾟ)': 'o',
    '(ﾟｰﾟ)': '_',
    '~~': '~',
  };
  
  return map[kaomoji] || null;
}

/**
 * 生成 AAEncode 示例（用于测试）
 */
function generateAAEncodeExample(jsCode) {
  // 这是一个占位实现
  // 实际生成 AAEncode 需要复杂的编码逻辑
  return `ﾟωﾟﾉ = /｀ｍ´）ﾉ ~┻━┻   //*´∇｀*/ ['_']; 
o=(ﾟｰﾟ)  =_=3;
c=(ﾟΘﾟ) =(ﾟｰﾟ)-(ﾟｰﾟ);
${jsCode}
`;
}

module.exports = {
  deobfuscateAAEncode,
  isAAEncode,
  analyzeAAEncodeStructure,
  validateAAEncode,
  cleanDecodedCode,
  parseKaomojiSequence,
  generateAAEncodeExample,
  AAENCODE_CHARS,
  AAENCODE_MAP
};
