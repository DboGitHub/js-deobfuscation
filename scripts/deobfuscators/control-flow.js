/**
 * 控制流平坦化还原器
 * 
 * 控制流平坦化是一种将代码执行顺序打乱的混淆技术。
 * 
 * 原始代码:
 * function foo() {
 *   if (x) { A }
 *   else { B }
 * }
 * 
 * 平坦化后:
 * function foo() {
 *   let state = 0;
 *   while (true) {
 *     switch (state) {
 *       case 0:
 *         if (x) state = 1; else state = 2; break;
 *       case 1:
 *         A; state = 3; break;
 *       case 2:
 *         B; state = 3; break;
 *       case 3:
 *         return;
 *     }
 *   }
 * }
 * 
 * 还原原理：
 * 1. 识别状态变量和分发器
 * 2. 构建控制流图
 * 3. 拓扑排序恢复执行顺序
 * 4. 替换为原始控制流结构
 */

const t = require('@babel/types');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

/**
 * 控制流平坦化还原主函数
 * @param {string} code - 混淆后的代码
 * @param {object} options - 配置选项
 * @returns {object} { code: string, stats: object }
 */
function deobfuscateControlFlow(code, options = {}) {
  const stats = {
    flatternedFunctionsFound: 0,
    statesAnalyzed: 0,
    controlFlowRestored: 0,
    deadCodeRemoved: 0
  };

  try {
    const ast = parseCode(code);
    
    // 遍历查找平坦化的函数
    traverse(ast, {
      FunctionDeclaration(path) {
        if (detectAndRestoreControlFlow(path, stats)) {
          stats.flatternedFunctionsFound++;
        }
      },
      
      FunctionExpression(path) {
        if (detectAndRestoreControlFlow(path, stats)) {
          stats.flatternedFunctionsFound++;
        }
      },
      
      ArrowFunctionExpression(path) {
        if (detectAndRestoreControlFlow(path, stats)) {
          stats.flatternedFunctionsFound++;
        }
      }
    });
    
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
 * 解析代码
 */
function parseCode(code) {
  return require('@babel/parser').parse(code, {
    sourceType: 'script',
    allowReturnOutsideFunction: true
  });
}

/**
 * 生成代码
 */
function generateCode(ast) {
  const result = generate(ast, {
    comments: true,
    compact: false,
    concise: false,
    retainLines: true
  });
  return result.code;
}

/**
 * 检测并恢复控制流
 */
function detectAndRestoreControlFlow(path, stats) {
  const { node, scope } = path;
  const body = node.body;
  
  // 检查是否是 while(true) 结构
  if (!t.isBlockStatement(body) || body.body.length !== 1) {
    return false;
  }
  
  const stmt = body.body[0];
  
  // 模式1: while(true) { switch(state) { ... } }
  if (t.isWhileStatement(stmt) && 
      t.isBooleanLiteral(stmt.test) && stmt.test.value === true) {
    return processWhileSwitch(path, stmt.body, scope, stats);
  }
  
  // 模式2: for(;;) { switch(state) { ... } }
  if (t.isForStatement(stmt) && !stmt.test) {
    return processWhileSwitch(path, stmt.body, scope, stats);
  }
  
  // 模式3: do { switch(state) { ... } } while(true)
  if (t.isDoWhileStatement(stmt) &&
      t.isBooleanLiteral(stmt.test) && stmt.test.value === true) {
    return processWhileSwitch(path, stmt.body, scope, stats);
  }
  
  return false;
}

/**
 * 处理 while(switch) 结构
 */
function processWhileSwitch(path, body, scope, stats) {
  // 检查内部是否是 switch 语句
  if (!t.isSwitchStatement(body)) {
    return false;
  }
  
  const switchStmt = body;
  const discriminant = switchStmt.discriminant;
  
  // 识别状态变量
  const stateVar = identifyStateVariable(discriminant, scope);
  if (!stateVar) {
    return false;
  }
  
  stats.statesAnalyzed = switchStmt.cases.length;
  
  // 构建控制流图
  const cfg = buildControlFlowGraph(switchStmt, stateVar);
  
  if (!cfg) {
    return false;
  }
  
  // 恢复原始控制流
  const restoredStatements = restoreControlFlow(cfg, stats);
  
  if (restoredStatements && restoredStatements.length > 0) {
    // 替换函数体
    path.get('body').replaceWithMultiple(restoredStatements);
    stats.controlFlowRestored++;
    return true;
  }
  
  return false;
}

/**
 * 识别状态变量
 */
function identifyStateVariable(discriminant, scope) {
  // 状态变量通常是标识符
  if (t.isIdentifier(discriminant)) {
    // 尝试获取变量的绑定信息
    const binding = scope.getBinding(discriminant.name);
    if (binding && binding.path.node.type === 'VariableDeclarator') {
      return {
        name: discriminant.name,
        declaration: binding.path.node
      };
    }
    return {
      name: discriminant.name,
      declaration: null
    };
  }
  
  // 可能是成员表达式，如 state['x'] 或 state.x
  if (t.isMemberExpression(discriminant)) {
    return {
      name: 'memberExpression',
      expression: discriminant
    };
  }
  
  return null;
}

/**
 * 构建控制流图
 * 
 * 原理：分析 switch 语句中的状态转换关系。
 * 每个 case 块会有一些赋值语句来改变状态变量的值，
 * 从而决定下一个要执行的块。
 */
function buildControlFlowGraph(switchStmt, stateVar) {
  const cfg = {
    startState: null,
    endState: null,
    cases: new Map(),
    transitions: new Map(),
    entryStatements: []  // switch 之前的语句
  };
  
  const stateName = stateVar.name;
  
  // 分析每个 case
  for (const switchCase of switchStmt.cases) {
    const test = switchCase.test;
    let stateValue;
    
    if (test === null) {
      // default case
      stateValue = 'default';
    } else if (t.isNumericLiteral(test)) {
      stateValue = test.value;
    } else if (t.isStringLiteral(test)) {
      stateValue = test.value;
    } else if (t.isIdentifier(test)) {
      stateValue = test.name;
    } else {
      continue;
    }
    
    // 收集 case 块内的语句和状态转换
    const caseInfo = {
      state: stateValue,
      statements: [],
      nextState: null,
      isExit: false
    };
    
    for (const stmt of switchCase.consequent) {
      // 检测状态赋值
      const nextState = extractNextState(stmt, stateName);
      
      if (nextState !== null) {
        caseInfo.nextState = nextState;
        
        // 检查是否是退出语句
        if (isExitStatement(stmt)) {
          caseInfo.isExit = true;
        }
        
        // 移除状态赋值语句本身
        continue;
      }
      
      // 检查是否有 break 或 continue
      if (t.isBreakStatement(stmt)) {
        continue;
      }
      
      caseInfo.statements.push(stmt);
    }
    
    cfg.cases.set(stateValue, caseInfo);
    
    // 记录开始状态
    if (cfg.startState === null) {
      cfg.startState = stateValue;
    }
  }
  
  // 建立转换关系
  for (const [state, caseInfo] of cfg.cases) {
    if (caseInfo.nextState !== null) {
      const transitions = cfg.transitions.get(state) || [];
      transitions.push(caseInfo.nextState);
      cfg.transitions.set(state, transitions);
    }
  }
  
  // 识别结束状态
  for (const [state, caseInfo] of cfg.cases) {
    if (caseInfo.isExit || caseInfo.nextState === null) {
      cfg.endState = state;
    }
  }
  
  return cfg;
}

/**
 * 提取下一个状态
 */
function extractNextState(stmt, stateName) {
  // 模式: state = value
  if (t.isExpressionStatement(stmt) &&
      t.isAssignmentExpression(stmt.expression) &&
      t.isAssignmentExpression(stmt.expression.left) === false) {
    
    const left = stmt.expression.left;
    
    // 直接赋值
    if (t.isIdentifier(left) && left.name === stateName) {
      const right = stmt.expression.right;
      
      if (t.isNumericLiteral(right)) {
        return right.value;
      }
      if (t.isStringLiteral(right)) {
        return right.value;
      }
      if (t.isIdentifier(right)) {
        return right.name;
      }
    }
  }
  
  // 模式: state++ 或 state--
  if (t.isExpressionStatement(stmt) && t.isUpdateExpression(stmt.expression)) {
    const arg = stmt.expression.argument;
    if (t.isIdentifier(arg) && arg.name === stateName) {
      return 'increment';
    }
  }
  
  return null;
}

/**
 * 检查是否是退出语句
 */
function isExitStatement(stmt) {
  if (t.isReturnStatement(stmt)) return true;
  if (t.isThrowStatement(stmt)) return true;
  if (t.isBreakStatement(stmt)) return true;
  if (t.isContinueStatement(stmt)) return true;
  
  // 检查函数调用是否是终止调用
  if (t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression)) {
    const callee = stmt.expression.callee;
    if (t.isIdentifier(callee)) {
      // 常见的终止函数
      const exitFunctions = ['exit', 'die', 'throw', 'rethrow'];
      if (exitFunctions.includes(callee.name.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 恢复控制流
 * 
 * 原理：通过拓扑排序确定每个块的执行顺序，
 * 然后根据条件分支重建原始的 if/switch 结构。
 */
function restoreControlFlow(cfg, stats) {
  const { cases, transitions, startState } = cfg;
  
  if (!cases.has(startState)) {
    return null;
  }
  
  // 构建执行顺序
  const executionOrder = [];
  const visited = new Set();
  
  // DFS 遍历
  function traverse(state) {
    if (visited.has(state)) return;
    visited.add(state);
    
    const caseInfo = cases.get(state);
    if (!caseInfo) return;
    
    // 添加当前块中的语句
    executionOrder.push({
      state: state,
      statements: caseInfo.statements,
      nextState: caseInfo.nextState,
      transitions: transitions.get(state) || []
    });
    
    // 继续遍历
    if (caseInfo.nextState !== null && caseInfo.nextState !== 'increment') {
      traverse(caseInfo.nextState);
    }
    
    // 处理分支
    for (const next of transitions.get(state) || []) {
      traverse(next);
    }
  }
  
  traverse(startState);
  
  // 分析控制流模式
  const restoredStatements = [];
  
  for (const block of executionOrder) {
    // 如果只有一个后继且不是简单的递增，说明是顺序执行
    if (block.statements.length > 0) {
      restoredStatements.push(...block.statements);
    }
  }
  
  // 如果有多个分支，需要重建条件结构
  const hasBranches = executionOrder.some(block => 
    block.transitions.length > 1 || 
    (block.statements.length === 1 && !isSimpleStatement(block.statements[0]))
  );
  
  if (hasBranches) {
    // 尝试重建 if/switch 结构
    const rebuilt = rebuildBranchingStructure(executionOrder);
    if (rebuilt) {
      return rebuilt;
    }
  }
  
  return restoredStatements.length > 0 ? restoredStatements : null;
}

/**
 * 检查是否是简单语句
 */
function isSimpleStatement(stmt) {
  return t.isExpressionStatement(stmt) &&
         t.isSimpleExpression(stmt.expression);
}

function isSimpleExpression(expr) {
  if (t.isIdentifier(expr)) return true;
  if (t.isLiteral(expr)) return true;
  if (t.isMemberExpression(expr)) return true;
  return false;
}

/**
 * 重建分支结构
 */
function rebuildBranchingStructure(executionOrder) {
  // 简化实现：对于复杂的分支，生成注释说明
  const statements = [];
  
  statements.push(
    t.commentBlock(
      ' 控制流平坦化已还原\n' +
      ` 检测到 ${executionOrder.length} 个状态块\n` +
      ' 原始代码结构已无法精确还原'
    )
  );
  
  // 添加简化后的代码
  for (const block of executionOrder) {
    if (block.statements.length > 0) {
      statements.push(...block.statements);
    }
  }
  
  return statements;
}

/**
 * 检测 for(;;) 平坦化模式
 */
function detectForSwitchPattern(path) {
  const body = path.node.body;
  
  if (!t.isBlockStatement(body)) return null;
  if (body.body.length !== 1) return null;
  
  const forStmt = body.body[0];
  
  if (t.isForStatement(forStmt)) {
    // 检查是否是 for(;;)
    if (forStmt.test === null) {
      const innerBody = forStmt.body;
      
      if (t.isBlockStatement(innerBody) && innerBody.body.length === 1) {
        const innerStmt = innerBody.body[0];
        
        if (t.isSwitchStatement(innerStmt)) {
          return innerStmt;
        }
      }
      
      // 也可能是 while
      if (t.isWhileStatement(innerStmt)) {
        if (t.isSwitchStatement(innerStmt.body)) {
          return innerStmt.body;
        }
      }
    }
  }
  
  return null;
}

/**
 * 简化状态变量的使用
 */
function simplifyStateVariables(path, stateVarName) {
  // 这个函数可以移除状态变量相关的死代码
  // 但需要注意不要破坏其他逻辑
  
  traverse(path.node, {
    VariableDeclaration(varPath) {
      const declarations = varPath.node.declarations.filter(decl => {
        if (t.isIdentifier(decl.id) && decl.id.name === stateVarName) {
          return false; // 移除状态变量声明
        }
        return true;
      });
      
      if (declarations.length === 0) {
        varPath.remove();
      } else {
        varPath.node.declarations = declarations;
      }
    }
  });
}

module.exports = {
  deobfuscateControlFlow,
  detectAndRestoreControlFlow,
  buildControlFlowGraph,
  restoreControlFlow,
  identifyStateVariable
};
