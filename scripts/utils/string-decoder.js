/**
 * 字符串解密工具
 * 提供各种字符串编码的解密功能
 */

// Base64 字符集
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64 解码
 * @param {string} str - Base64 编码的字符串
 * @returns {string}
 */
function base64Decode(str) {
  try {
    // 使用原生 atob（浏览器/Node 环境）
    if (typeof atob !== 'undefined') {
      return atob(str);
    }
    // Node.js 环境
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'base64').toString('utf8');
    }
    // 纯手写解码
    return base64DecodeManual(str);
  } catch (e) {
    return null;
  }
}

/**
 * 手动 Base64 解码
 * @param {string} str - Base64 编码的字符串
 * @returns {string}
 */
function base64DecodeManual(str) {
  // 清理字符串
  str = str.replace(/[^A-Za-z0-9+/=]/g, '');
  
  let output = '';
  const bytes = [];
  
  for (let i = 0; i < str.length; i += 4) {
    const enc1 = BASE64_CHARS.indexOf(str[i]);
    const enc2 = BASE64_CHARS.indexOf(str[i + 1] || 'A');
    const enc3 = BASE64_CHARS.indexOf(str[i + 2] || 'A');
    const enc4 = BASE64_CHARS.indexOf(str[i + 3] || 'A');
    
    const char1 = (enc1 << 2) | (enc2 >> 4);
    const char2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const char3 = ((enc3 & 3) << 6) | enc4;
    
    if (str[i + 2] !== undefined && str[i + 2] !== '=') {
      bytes.push(char2);
    }
    if (str[i + 3] !== undefined && str[i + 3] !== '=') {
      bytes.push(char3);
    }
    bytes.unshift(char1);
  }
  
  // 移除末尾的空字节
  while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
    bytes.pop();
  }
  
  return String.fromCharCode(...bytes);
}

/**
 * Hex 解码
 * @param {string} str - Hex 编码的字符串
 * @returns {string}
 */
function hexDecode(str) {
  try {
    // 匹配 \x 格式
    if (/\\x[0-9a-fA-F]{2}/.test(str)) {
      const matches = str.match(/\\x[0-9a-fA-F]{2}/g) || [];
      const bytes = matches.map(m => parseInt(m.slice(2), 16));
      return String.fromCharCode(...bytes);
    }
    
    // 匹配 \u 格式
    if (/\\u[0-9a-fA-F]{4}/.test(str)) {
      const matches = str.match(/\\u[0-9a-fA-F]{4}/g) || [];
      const codePoints = matches.map(m => parseInt(m.slice(2), 16));
      return String.fromCharCode(...codePoints);
    }
    
    // 纯 hex 字符串
    if (/^[0-9a-fA-F]+$/.test(str)) {
      const bytes = [];
      for (let i = 0; i < str.length; i += 2) {
        bytes.push(parseInt(str.slice(i, i + 2), 16));
      }
      return String.fromCharCode(...bytes);
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Unicode 解码
 * @param {string} str - Unicode 转义的字符串
 * @returns {string}
 */
function unicodeDecode(str) {
  try {
    // \uXXXX 格式
    let result = str.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => {
      return String.fromCharCode(parseInt(code, 16));
    });
    
    // \u{XXXXX} 格式（Unicode 代码点）
    result = result.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, code) => {
      return String.fromCodePoint(parseInt(code, 16));
    });
    
    return result;
  } catch (e) {
    return null;
  }
}

/**
 * ROT13 解码
 * @param {string} str - ROT13 编码的字符串
 * @returns {string}
 */
function rot13Decode(str) {
  return str.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= 'Z' ? 65 : 97;
    return String.fromCharCode((char.charCodeAt(0) - base + 13) % 26 + base);
  });
}

/**
 * 字符串解密（尝试多种编码）
 * @param {string} str - 加密的字符串
 * @returns {object} { decoded: string, method: string }
 */
function decodeString(str) {
  if (!str || typeof str !== 'string') {
    return { decoded: str, method: 'none' };
  }
  
  // 去除首尾空白
  str = str.trim();
  
  // 尝试各种解码方法
  const methods = [
    { name: 'base64', fn: base64Decode, check: (s) => /^[A-Za-z0-9+/]+=*$/.test(s) && s.length >= 4 },
    { name: 'hex', fn: hexDecode, check: (s) => /^\\x[0-9a-fA-F]+$/.test(s) || /^[0-9a-fA-F]{2,}$/.test(s) },
    { name: 'unicode', fn: unicodeDecode, check: (s) => /\\u[0-9a-fA-F]/.test(s) },
    { name: 'rot13', fn: rot13Decode, check: (s) => /[a-zA-Z]/.test(s) && s.length <= 1000 }
  ];
  
  for (const method of methods) {
    if (method.check(str)) {
      const decoded = method.fn(str);
      if (decoded && decoded.length > 0) {
        // 验证解码结果是否合理
        if (isValidDecodedString(decoded)) {
          return { decoded, method: method.name };
        }
      }
    }
  }
  
  return { decoded: str, method: 'none' };
}

/**
 * 检查解码结果是否有效
 * @param {string} str - 解码后的字符串
 * @returns {boolean}
 */
function isValidDecodedString(str) {
  if (!str || str.length === 0) return false;
  
  // 检查是否包含可打印字符
  const printableRatio = str.split('').filter(c => {
    const code = c.charCodeAt(0);
    return (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13;
  }).length / str.length;
  
  return printableRatio > 0.7;
}

/**
 * 解析字符串拼接模式
 * @param {object} node - AST 节点（二元表达式）
 * @returns {string|null}
 */
function parseStringConcat(node) {
  if (!node) return null;
  
  if (node.type === 'StringLiteral') {
    return node.value;
  }
  
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = parseStringConcat(node.left);
    const right = parseStringConcat(node.right);
    
    if (left !== null && right !== null) {
      return left + right;
    }
  }
  
  // 尝试调用解码函数
  if (node.type === 'CallExpression') {
    const callee = node.callee;
    const args = node.arguments || [];
    
    // atob(...)
    if (callee.type === 'Identifier' && callee.name === 'atob') {
      if (args.length === 1 && args[0].type === 'StringLiteral') {
        return base64Decode(args[0].value);
      }
    }
    
    // btoa(...)
    if (callee.type === 'Identifier' && callee.name === 'btoa') {
      if (args.length === 1 && args[0].type === 'StringLiteral') {
        return args[0].value; // btoa 是编码，不是解码
      }
    }
    
    // String.fromCharCode(...)
    if (callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'String' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'fromCharCode') {
      
      const values = args.map(arg => {
        if (arg.type === 'NumericLiteral') return arg.value;
        if (arg.type === 'UnaryExpression' && arg.operator === '-' && 
            arg.argument.type === 'NumericLiteral') {
          return -arg.argument.value;
        }
        return null;
      });
      
      if (values.every(v => v !== null)) {
        return String.fromCharCode(...values);
      }
    }
  }
  
  // 数字到字符转换
  if (node.type === 'CallExpression') {
    const callee = node.callee;
    
    // String.fromCharCode 形式
    if (callee.type === 'MemberExpression') {
      if (callee.property.type === 'Identifier' && 
          callee.property.name === 'fromCharCode') {
        return parseStringConcat(node);
      }
    }
  }
  
  return null;
}

/**
 * 尝试解密被混淆的字符串常量
 * @param {string} str - 混淆的字符串
 * @param {object} context - 解密上下文（包含已知变量映射等）
 * @returns {string}
 */
function decryptString(str, context = {}) {
  // 1. 尝试直接解码
  const directDecode = decodeString(str);
  if (directDecode.method !== 'none') {
    return directDecode.decoded;
  }
  
  // 2. 尝试去除常见包装
  let cleaned = str;
  
  // 去除反斜杠转义
  cleaned = cleaned.replace(/\\\\/g, '\\');
  
  // 3. 如果是数字形式，尝试转为字符
  if (/^\d+$/.test(cleaned)) {
    const num = parseInt(cleaned, 10);
    if (num >= 0 && num <= 65535) {
      return String.fromCharCode(num);
    }
  }
  
  // 4. 尝试十六进制解析
  if (/^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length % 2 === 0) {
    try {
      const bytes = [];
      for (let i = 0; i < cleaned.length; i += 2) {
        bytes.push(parseInt(cleaned.substr(i, 2), 16));
      }
      const result = String.fromCharCode(...bytes);
      if (isValidDecodedString(result)) {
        return result;
      }
    } catch (e) {
      // 忽略错误
    }
  }
  
  return str;
}

module.exports = {
  base64Decode,
  base64DecodeManual,
  hexDecode,
  unicodeDecode,
  rot13Decode,
  decodeString,
  isValidDecodedString,
  parseStringConcat,
  decryptString
};
