/**
 * AST 工具函数集
 * 提供常用的 AST 操作辅助函数
 */

const t = require('@babel/types');

/**
 * 创建唯一标识符
 * @param {string} prefix - 前缀
 * @param {object} scope - 作用域
 * @returns {string}
 */
function createUniqueId(prefix, scope) {
  return scope?.generateUid?.(prefix) || `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 检查是否是简单字符串（非拼接）
 * @param {object} node - AST 节点
 * @returns {boolean}
 */
function isSimpleString(node) {
  if (!t.isStringLiteral(node)) return false;
  
  // 检查父节点是否是二元表达式（拼接）
  const parent = node?.parent;
  if (t.isBinaryExpression(parent) && parent.operator === '+') {
    return false;
  }
  return true;
}

/**
 * 获取字符串字面量的值（递归解析拼接）
 * @param {object} node - AST 节点
 * @returns {string|null}
 */
function extractStringValue(node) {
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  
  if (t.isBinaryExpression(node) && node.operator === '+') {
    const left = extractStringValue(node.left);
    const right = extractStringValue(node.right);
    if (left !== null && right !== null) {
      return left + right;
    }
  }
  
  return null;
}

/**
 * 创建字符串拼接表达式
 * @param {string} str - 字符串
 * @returns {object} AST 节点
 */
function createStringConcat(str) {
  if (str.length === 0) {
    return t.stringLiteral('');
  }
  
  if (str.length <= 50) {
    return t.stringLiteral(str);
  }
  
  // 对于长字符串，分段拼接
  const parts = [];
  for (let i = 0; i < str.length; i += 50) {
    parts.push(t.stringLiteral(str.slice(i, i + 50)));
  }
  
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) {
    result = t.binaryExpression('+', result, parts[i]);
  }
  
  return result;
}

/**
 * 检查节点是否是注释
 * @param {object} node - AST 节点
 * @returns {boolean}
 */
function isComment(node) {
  return t.isComment(node) || t.isCommentBlock(node) || t.isCommentLine(node);
}

/**
 * 深拷贝节点
 * @param {object} node - AST 节点
 * @returns {object}
 */
function cloneNode(node) {
  return JSON.parse(JSON.stringify(node));
}

/**
 * 检查是否是数组字面量
 * @param {object} node - AST 节点
 * @returns {boolean}
 */
function isArrayLiteral(node) {
  return t.isArrayExpression(node) && 
         node.elements.every(el => el !== null);
}

/**
 * 获取数组字面量的元素值
 * @param {object} node - AST 节点
 * @returns {array|null}
 */
function extractArrayValues(node) {
  if (!isArrayLiteral(node)) return null;
  
  const values = [];
  for (const el of node.elements) {
    if (t.isStringLiteral(el)) {
      values.push(el.value);
    } else if (t.isNumericLiteral(el)) {
      values.push(el.value);
    } else if (t.isBooleanLiteral(el)) {
      values.push(el.value);
    } else {
      return null; // 包含复杂元素
    }
  }
  
  return values;
}

/**
 * 创建变量声明
 * @param {string} name - 变量名
 * @param {object} init - 初始化值
 * @param {string} kind - var/let/const
 * @returns {object}
 */
function createVariableDeclaration(name, init, kind = 'const') {
  return t.variableDeclaration(kind, [
    t.variableDeclarator(
      t.identifier(name),
      init
    )
  ]);
}

/**
 * 创建函数调用
 * @param {string} name - 函数名
 * @param {array} args - 参数列表
 * @returns {object}
 */
function createCallExpression(name, args = []) {
  return t.callExpression(
    t.identifier(name),
    args
  );
}

/**
 * 创建成员表达式
 * @param {string} object - 对象名
 * @param {string} property - 属性名
 * @param {boolean} computed - 是否计算属性
 * @returns {object}
 */
function createMemberExpression(object, property, computed = false) {
  return t.memberExpression(
    t.identifier(object),
    t.identifier(property),
    computed
  );
}

/**
 * 检查函数是否是纯函数（无副作用）
 * @param {object} path - traverse path
 * @returns {boolean}
 */
function isPureFunction(path) {
  const node = path.node;
  
  if (!t.isFunctionExpression(node) && !t.isArrowFunctionExpression(node)) {
    return false;
  }
  
  // 简单检查：函数体内是否包含 I/O 操作
  let isPure = true;
  
  path.traverse({
    CallExpression(innerPath) {
      const callee = innerPath.node.callee;
      
      // 检测常见副作用函数
      if (t.isIdentifier(callee)) {
        const name = callee.name;
        const sideEffectFunctions = [
          'console.log', 'console.error', 'console.warn',
          'alert', 'confirm', 'prompt',
          'setTimeout', 'setInterval',
          'fetch', 'XMLHttpRequest',
          'document.write', 'eval'
        ];
        
        if (sideEffectFunctions.includes(name)) {
          isPure = false;
          innerPath.stop();
        }
      }
    },
    
    AssignmentExpression(innerPath) {
      // 检测赋值给外部变量
      const target = innerPath.node.left;
      if (t.isIdentifier(target)) {
        const binding = innerPath.scope.getBinding(target.name);
        if (!binding || binding.scope === path.scope) {
          return; // 局部变量
        }
        isPure = false;
        innerPath.stop();
      }
    }
  });
  
  return isPure;
}

/**
 * 查找父函数
 * @param {object} path - traverse path
 * @returns {object|null}
 */
function findParentFunction(path) {
  let current = path.parentPath;
  
  while (current) {
    if (t.isFunction(current.node)) {
      return current;
    }
    current = current.parentPath;
  }
  
  return null;
}

/**
 * 获取节点的所有子节点
 * @param {object} node - AST 节点
 * @returns {array}
 */
function getChildNodes(node) {
  const children = [];
  
  function traverse(n) {
    for (const key in n) {
      const value = n[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && item.type) {
            children.push(item);
            traverse(item);
          }
        }
      } else if (value && typeof value === 'object' && value.type) {
        children.push(value);
        traverse(value);
      }
    }
  }
  
  traverse(node);
  return children;
}

/**
 * 查找所有标识符引用
 * @param {object} path - traverse path
 * @param {string} name - 标识符名称
 * @returns {array}
 */
function findReferences(path, name) {
  const references = [];
  
  path.scope?.crawl();
  const binding = path.scope.getBinding(name);
  
  if (binding) {
    binding.referencePaths.forEach(refPath => {
      references.push(refPath);
    });
  }
  
  return references;
}

/**
 * 简化条件表达式
 * @param {object} node - 表达式节点
 * @returns {object}
 */
function simplifyExpression(node) {
  // 简化常量表达式
  if (t.isBinaryExpression(node)) {
    const left = simplifyExpression(node.left);
    const right = simplifyExpression(node.right);
    
    if (t.isNumericLiteral(left) && t.isNumericLiteral(right)) {
      switch (node.operator) {
        case '+': return t.numericLiteral(left.value + right.value);
        case '-': return t.numericLiteral(left.value - right.value);
        case '*': return t.numericLiteral(left.value * right.value);
        case '/': return t.numericLiteral(left.value / right.value);
        case '%': return t.numericLiteral(left.value % right.value);
        case '**': return t.numericLiteral(Math.pow(left.value, right.value));
      }
    }
  }
  
  return node;
}

/**
 * 检查代码是否包含特定模式
 * @param {object} ast - AST
 * @param {function} checker - 检查函数
 * @returns {boolean}
 */
function containsPattern(ast, checker) {
  let found = false;
  
  require('@babel/traverse').default(ast, {
    enter(path) {
      if (checker(path.node)) {
        found = true;
        path.stop();
      }
    }
  });
  
  return found;
}

module.exports = {
  createUniqueId,
  isSimpleString,
  extractStringValue,
  createStringConcat,
  isComment,
  cloneNode,
  isArrayLiteral,
  extractArrayValues,
  createVariableDeclaration,
  createCallExpression,
  createMemberExpression,
  isPureFunction,
  findParentFunction,
  getChildNodes,
  findReferences,
  simplifyExpression,
  containsPattern
};
