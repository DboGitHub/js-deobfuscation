/**
 * 简单混淆还原器
 * 
 * 处理常见的简单 JavaScript 混淆技术：
 * - 变量名替换还原
 * - 字符串常量解密
 * - 字符串拼接还原
 * - 无意义包装函数移除
 * - 数值常量还原
 */

// 延迟导入 Babel 模块，避免启动时加载问题
let t, traverse, generate, template;
let astUtils;

function loadDependencies() {
  if (!t) {
    t = require('@babel/types');
    traverse = require('@babel/traverse').default;
    generate = require('@babel/generator').default;
    template = require('@babel/template');
    astUtils = require('../utils/ast-utils');
  }
}

/**
 * 简单混淆还原主函数
 * @param {string} code - 混淆后的代码
 * @param {object} options - 配置选项
 * @returns {object} { code: string, stats: object }
 */
function deobfuscateSimple(code, options = {}) {
  // 确保依赖已加载
  loadDependencies();
  
  const stats = {
    variablesRenamed: 0,
    stringsDecoded: 0,
    concatsResolved: 0,
    wrappersRemoved: 0,
    numbersSimplified: 0
  };

  try {
    // 解析代码
    const ast = parseCode(code);
    
    // 1. 移除自执行包装函数
    removeWrapperFunctions(ast, stats);
    
    // 2. 还原字符串拼接
    resolveStringConcatenation(ast, stats);
    
    // 3. 解密字符串常量
    decodeStringConstants(ast, stats);
    
    // 4. 还原数值常量
    simplifyNumericConstants(ast, stats);
    
    // 5. 还原变量名（基于模式识别）
    // renameVariables(ast, stats);
    
    // 生成代码
    const result = generateCode(ast);
    
    return {
      code: result,
      stats,
      success: true
    };
  } catch (error) {
    return {
      code: code,
      stats,
      success: false,
      error: error.message
    };
  }
}

/**
 * 解析代码为 AST
 */
function parseCode(code) {
  loadDependencies();
  try {
    return require('@babel/parser').parse(code, {
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true
    });
  } catch (e1) {
    // 尝试作为模块解析
    return require('@babel/parser').parse(code, {
      sourceType: 'module'
    });
  }
}

/**
 * 生成代码
 */
function generateCode(ast) {
  loadDependencies();
  const result = generate(ast, {
    comments: true,
    compact: false,
    concise: false,
    retainLines: true
  });
  return result.code;
}

/**
 * 移除自执行包装函数
 * 
 * 模式: (function(){ ... })() 或 (function(){ ... })()
 * 
 * 原理：混淆器经常将代码包装在立即执行函数中，
 * 可以通过识别这种模式并展开来简化代码结构。
 */
function removeWrapperFunctions(ast, stats) {
  traverse(ast, {
    CallExpression(path) {
      const { callee } = path.node;
      
      // 模式1: (function(){...})() - 函数表达式调用
      if (t.isCallExpression(callee) && 
          t.isFunctionExpression(callee.callee)) {
        
        const func = callee.callee;
        
        // 检查是否是简单的包装（只有一个 return 语句）
        if (func.body.body.length === 1) {
          const stmt = func.body.body[0];
          
          if (t.isReturnStatement(stmt)) {
            // 将 return 替换为赋值表达式
            const tempVar = path.scope.generateUid('_result');
            
            path.replaceWithMultiple([
              t.variableDeclaration('var', [
                t.variableDeclarator(
                  t.identifier(tempVar),
                  stmt.argument || t.identifier('undefined')
                )
              ])
            ]);
            
            stats.wrappersRemoved++;
            path.skip();
          }
        }
      }
      
      // 模式2: (function(){...}.call(this)) 或类似变体
      if (t.isMemberExpression(callee) &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'call') {
        
        const func = callee.object;
        if (t.isFunctionExpression(func) && 
            func.body.body.length === 1 &&
            t.isReturnStatement(func.body.body[0])) {
          
          const returnValue = func.body.body[0].argument;
          path.replaceWith(returnValue || t.identifier('undefined'));
          stats.wrappersRemoved++;
          path.skip();
        }
      }
    }
  });
}

/**
 * 还原字符串拼接
 * 
 * 模式: "part1" + "part2" + "part3" -> "part1part2part3"
 * 
 * 原理：混淆器将字符串拆分成多个部分拼接，
 * 可以通过静态分析拼接结构来还原原始字符串。
 */
function resolveStringConcatenation(ast, stats) {
  let changed = true;
  let iterations = 0;
  const maxIterations = 10;
  
  // 多次遍历直到没有变化
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    
    traverse(ast, {
      exit(path) {
        if (path.node.type !== 'BinaryExpression') return;
        if (path.node.operator !== '+') return;
        
        // 检查是否已被处理
        if (path.visited) return;
        
        // 尝试静态计算字符串拼接
        const value = evaluateStringConcat(path.node);
        
        if (value !== null) {
          // 替换为计算后的字符串
          path.replaceWith(t.stringLiteral(value));
          stats.concatsResolved++;
          changed = true;
        }
      }
    });
  }
}

/**
 * 处理序列表达式（逗号运算符）
 */
function processSequenceExpression(path, stats) {
  const { expressions } = path.node;
  
  // 检查是否所有表达式都是常量
  const canEvaluate = expressions.every(expr => {
    if (t.isLiteral(expr)) return true;
    if (t.isBinaryExpression(expr) && expr.operator === '+') {
      return evaluateStringConcat(expr) !== null;
    }
    return false;
  });
  
  if (canEvaluate && expressions.length > 0) {
    // 保留最后一个表达式的值
    const lastExpr = expressions[expressions.length - 1];
    path.replaceWith(lastExpr);
    stats.concatsResolved++;
    path.skip();
  }
}

/**
 * 尝试计算字符串拼接表达式的值
 */
function evaluateStringConcat(node) {
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  
  if (t.isBinaryExpression(node) && node.operator === '+') {
    const left = evaluateStringConcat(node.left);
    const right = evaluateStringConcat(node.right);
    
    if (left !== null && right !== null) {
      // 安全检查：避免超长字符串
      if (left.length + right.length > 10000) {
        return null;
      }
      return left + right;
    }
  }
  
  return null;
}

/**
 * 解密字符串常量
 * 
 * 模式: atob("encrypted"), btoa(str) 等
 * 
 * 原理：识别常见的字符串加密函数调用，
 * 并尝试解码加密的字符串常量。
 */
function decodeStringConstants(ast, stats) {
  traverse(ast, {
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      
      // atob(str) - Base64 解码
      if (t.isIdentifier(callee) && callee.name === 'atob') {
        if (args.length === 1 && t.isStringLiteral(args[0])) {
          const decoded = decodeBase64(args[0].value);
          if (decoded !== null) {
            path.replaceWith(t.stringLiteral(decoded));
            stats.stringsDecoded++;
            path.skip();
          }
        }
      }
      
      // window.atob
      if (t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object) &&
          callee.object.name === 'window' &&
          t.isIdentifier(callee.property) &&
          callee.property.name === 'atob') {
        if (args.length === 1 && t.isStringLiteral(args[0])) {
          const decoded = decodeBase64(args[0].value);
          if (decoded !== null) {
            path.replaceWith(t.stringLiteral(decoded));
            stats.stringsDecoded++;
            path.skip();
          }
        }
      }
      
      // unescape(str) - URL 解码
      if (t.isIdentifier(callee) && callee.name === 'unescape') {
        if (args.length === 1 && t.isStringLiteral(args[0])) {
          try {
            const decoded = decodeURIComponent(args[0].value.replace(/%/g, '%25'));
            path.replaceWith(t.stringLiteral(decoded));
            stats.stringsDecoded++;
            path.skip();
          } catch (e) {
            // 解码失败，忽略
          }
        }
      }
      
      // decodeURIComponent(str)
      if (t.isIdentifier(callee) && callee.name === 'decodeURIComponent') {
        if (args.length === 1 && t.isStringLiteral(args[0])) {
          try {
            const decoded = decodeURIComponent(args[0].value);
            path.replaceWith(t.stringLiteral(decoded));
            stats.stringsDecoded++;
            path.skip();
          } catch (e) {
            // 解码失败，忽略
          }
        }
      }
    }
  });
}

/**
 * Base64 解码
 */
function decodeBase64(str) {
  try {
    if (typeof atob !== 'undefined') {
      return atob(str);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'base64').toString('utf8');
    }
    return manualBase64Decode(str);
  } catch (e) {
    return null;
  }
}

/**
 * 手动 Base64 解码
 */
function manualBase64Decode(str) {
  const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  
  // 清理输入
  str = str.replace(/[^A-Za-z0-9+/=]/g, '');
  
  let output = '';
  const bytes = [];
  
  for (let i = 0; i < str.length; i += 4) {
    const enc1 = BASE64_CHARS.indexOf(str[i] || 'A');
    const enc2 = BASE64_CHARS.indexOf(str[i + 1] || 'A');
    const enc3 = BASE64_CHARS.indexOf(str[i + 2] || 'A');
    const enc4 = BASE64_CHARS.indexOf(str[i + 3] || 'A');
    
    const char1 = (enc1 << 2) | (enc2 >> 4);
    const char2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const char3 = ((enc3 & 3) << 6) | enc4;
    
    if (str[i + 2] !== '=') bytes.push(char2);
    if (str[i + 3] !== '=') bytes.push(char3);
    bytes.unshift(char1);
  }
  
  while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
    bytes.pop();
  }
  
  return String.fromCharCode(...bytes);
}

/**
 * 还原数值常量
 * 
 * 模式: (10 * 10) - (5 * 5) -> 75
 * 
 * 原理：混淆器使用复杂表达式生成简单数值，
 * 可以通过静态计算还原。
 */
function simplifyNumericConstants(ast, stats) {
  traverse(ast, {
    NumericLiteral(path) {
      // 检查父节点是否是二元表达式
      const parent = path.parent;
      
      if (t.isBinaryExpression(parent) || 
          t.isUnaryExpression(parent)) {
        // 尝试计算父表达式
        trySimplifyExpression(path.parent, stats);
      }
    }
  });
}

/**
 * 尝试简化表达式
 */
function trySimplifyExpression(node, stats) {
  if (!t.isExpression(node)) return;
  
  const simplified = simplifyExpression(node);
  
  if (simplified !== node) {
    // 检查是否可以替换
    if (t.isNumericLiteral(simplified)) {
      // 只替换明显可简化的表达式
      const complexity = countExpressionComplexity(node);
      if (complexity > 3) {
        // 替换为简化后的值
        if (node.parent.type === 'ExpressionStatement') {
          // 如果是独立语句，创建一个赋值表达式
          const varName = path.scope?.generateUid?.('_const') || '_tmp';
          node.parentPath.replaceWith(
            t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier(varName),
                simplified
              )
            ])
          );
        } else {
          node.parentPath.replaceWith(simplified);
        }
        stats.numbersSimplified++;
      }
    }
  }
}

/**
 * 计算表达式复杂度
 */
function countExpressionComplexity(node) {
  let count = 0;
  
  function traverse(n) {
    if (t.isNumericLiteral(n)) {
      count++;
    }
    if (t.isBinaryExpression(n)) {
      traverse(n.left);
      traverse(n.right);
    }
    if (t.isUnaryExpression(n)) {
      traverse(n.argument);
    }
  }
  
  traverse(node);
  return count;
}

/**
 * 基于模式识别的变量重命名
 * 
 * 注意：这个功能比较复杂，可能产生误判，默认禁用
 */
function renameVariables(ast, stats) {
  // 变量名映射
  const nameMapping = new Map();
  
  // 收集函数参数的模式
  traverse(ast, {
    FunctionDeclaration(path) {
      const { node } = path;
      const params = node.params;
      
      // 检查是否是数组遍历函数
      if (params.length >= 2) {
        const body = node.body.body;
        
        // 简单的模式：检查是否有数组访问
        if (body.some(stmt => 
          t.isExpressionStatement(stmt) &&
          t.isAssignmentExpression(stmt.expression) &&
          t.isMemberExpression(stmt.expression.left) &&
          t.isNumericLiteral(stmt.expression.left.property)
        )) {
          // 可能是数组遍历函数
          params.forEach((param, index) => {
            if (t.isIdentifier(param)) {
              const suggestedNames = ['array', 'index', 'callback', 'element', 'item'];
              if (index < suggestedNames.length) {
                nameMapping.set(param.name, suggestedNames[index]);
                stats.variablesRenamed++;
              }
            }
          });
        }
      }
    }
  });
  
  // 应用重命名
  if (nameMapping.size > 0) {
    traverse(ast, {
      Identifier(path) {
        const { node } = path;
        if (nameMapping.has(node.name)) {
          // 注意：这里需要考虑作用域，避免重名冲突
          path.replaceWith(t.identifier(nameMapping.get(node.name)));
        }
      }
    });
  }
}

module.exports = {
  deobfuscateSimple,
  removeWrapperFunctions,
  resolveStringConcatenation,
  decodeStringConstants,
  simplifyNumericConstants
};
