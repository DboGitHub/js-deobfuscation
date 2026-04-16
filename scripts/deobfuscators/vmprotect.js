/**
 * JSVMP (JavaScript 虚拟机保护) 还原器
 * 
 * JSVMP 是一种高级的代码保护技术，将 JavaScript 代码编译为字节码，
 * 通过自定义虚拟机解释执行。
 * 
 * 典型结构:
 * function vm() {
 *   var bytecode = [0x01, 0x02, 0x03, ...];  // 字节码数组
 *   var vars = {};                            // 变量存储
 *   var stack = [];                           // 操作数栈
 *   var pc = 0;                               // 程序计数器
 *   
 *   while (true) {
 *     switch (bytecode[pc++]) {               // 分发器
 *       case 0x01: stack.push(bytecode[pc++]); break;  // LOAD
 *       case 0x02: /* ADD */ break;
 *       // ... 更多指令
 *       case 0xFF: return stack.pop();         // HALT
 *     }
 *   }
 * }
 * 
 * 还原原理:
 * 1. 识别虚拟机特征
 * 2. 提取字节码和常量
 * 3. 分析指令模式
 * 4. 尝试模拟执行或翻译为等价 JS
 */

const t = require('@babel/types');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

/**
 * 常见虚拟机指令定义
 */
const VM_OPS = {
  // 栈操作
  PUSH: 0x01,
  POP: 0x02,
  DUP: 0x03,
  
  // 加载/存储
  LOAD: 0x10,
  STORE: 0x11,
  LOAD_CONST: 0x12,
  
  // 算术运算
  ADD: 0x20,
  SUB: 0x21,
  MUL: 0x22,
  DIV: 0x23,
  MOD: 0x24,
  
  // 比较运算
  EQ: 0x30,
  NE: 0x31,
  LT: 0x32,
  GT: 0x33,
  LE: 0x34,
  GE: 0x35,
  
  // 逻辑运算
  AND: 0x40,
  OR: 0x41,
  NOT: 0x42,
  XOR: 0x43,
  
  // 控制流
  JMP: 0x50,
  JZ: 0x51,       // 条件跳转 (zero)
  JNZ: 0x52,      // 条件跳转 (not zero)
  
  // 函数调用
  CALL: 0x60,
  RET: 0x61,
  
  // 其他
  NOP: 0x00,
  HALT: 0xFF
};

/**
 * JSVMP 还原主函数
 * @param {string} code - 混淆后的代码
 * @param {object} options - 配置选项
 * @returns {object} { code: string, stats: object }
 */
function deobfuscateVMP(code, options = {
  simulateExecution: true,
  maxIterations: 10000
}) {
  const stats = {
    vmDetected: false,
    bytecodeExtracted: false,
    constantsExtracted: 0,
    instructionsDecoded: 0,
    jsEquivalent: null,
    simulatedOutputs: []
  };

  try {
    const ast = parseCode(code);
    
    // 1. 检测虚拟机特征
    const vmInfo = detectVM(ast, stats);
    
    if (!vmInfo) {
      return {
        code: code,
        stats,
        success: false,
        error: 'No VM pattern detected'
      };
    }
    
    stats.vmDetected = true;
    
    // 2. 提取字节码
    const bytecode = extractBytecode(vmInfo, stats);
    
    if (!bytecode || bytecode.length === 0) {
      return {
        code: code,
        stats,
        success: false,
        error: 'Could not extract bytecode'
      };
    }
    
    stats.bytecodeExtracted = true;
    
    // 3. 提取常量
    const constants = extractConstants(vmInfo, stats);
    stats.constantsExtracted = constants.length;
    
    // 4. 分析字节码
    const instructions = decodeBytecode(bytecode, constants, stats);
    stats.instructionsDecoded = instructions.length;
    
    // 5. 尝试生成等价的 JavaScript
    let jsEquivalent = null;
    
    if (options.simulateExecution) {
      // 尝试模拟执行
      const simulationResult = simulateVM(bytecode, constants, {
        maxIterations: options.maxIterations
      }, stats);
      
      if (simulationResult) {
        jsEquivalent = simulationResult;
      }
    }
    
    // 如果模拟失败，尝试翻译
    if (!jsEquivalent) {
      jsEquivalent = translateToJS(instructions, constants, stats);
    }
    
    // 6. 生成报告
    const report = generateVMReport(vmInfo, bytecode, constants, instructions, stats);
    
    return {
      code: jsEquivalent || code,
      originalCode: code,
      vmReport: report,
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
 * 检测虚拟机模式
 */
function detectVM(ast, stats) {
  let vmInfo = null;
  
  traverse(ast, {
    FunctionDeclaration(path) {
      const info = analyzeFunction(path);
      if (info && info.isVMFunction) {
        vmInfo = info;
        path.stop();
      }
    },
    
    FunctionExpression(path) {
      const info = analyzeFunction(path);
      if (info && info.isVMFunction) {
        vmInfo = info;
        path.stop();
      }
    }
  });
  
  return vmInfo;
}

/**
 * 分析函数是否是虚拟机
 */
function analyzeFunction(path) {
  const { node } = path;
  const body = node.body;
  
  if (!t.isBlockStatement(body)) return null;
  
  // 寻找字节码数组
  const bytecodeArray = findBytecodeArray(node);
  
  // 寻找分发器
  const dispatcher = findDispatcher(node);
  
  // 寻找操作数栈
  const stackVar = findStackVariable(node);
  
  // 判断是否是 VM 函数
  const isVMFunction = bytecodeArray && dispatcher;
  
  if (isVMFunction) {
    return {
      isVMFunction: true,
      bytecodeArray,
      dispatcher,
      stackVar,
      functionNode: node,
      path
    };
  }
  
  return null;
}

/**
 * 查找字节码数组
 */
function findBytecodeArray(funcNode) {
  const body = funcNode.body.body;
  
  for (const stmt of body) {
    // 查找变量声明
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (t.isIdentifier(decl.id)) {
          // 检查初始化值是否是数组
          if (t.isArrayExpression(decl.init)) {
            const elements = decl.init.elements;
            
            // 检查数组元素是否像字节码（数字）
            if (elements.length > 5 && 
                elements.every(el => 
                  el && (t.isNumericLiteral(el) || t.isUnaryExpression(el))
                )) {
              return {
                name: decl.id.name,
                elements: elements
              };
            }
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * 查找分发器 (dispatcher)
 */
function findDispatcher(funcNode) {
  const body = funcNode.body.body;
  
  for (const stmt of body) {
    // 查找 while 循环
    if (t.isWhileStatement(stmt)) {
      const loopBody = stmt.body;
      
      // 检查循环内是否有 switch
      if (t.isSwitchStatement(loopBody)) {
        return {
          type: 'while-switch',
          switchNode: loopBody,
          loopNode: stmt
        };
      }
      
      // 检查循环内是否有 if/switch
      if (t.isBlockStatement(loopBody)) {
        for (const innerStmt of loopBody.body) {
          if (t.isSwitchStatement(innerStmt)) {
            return {
              type: 'while-block-switch',
              switchNode: innerStmt,
              loopNode: stmt
            };
          }
        }
      }
    }
    
    // 查找 for 循环
    if (t.isForStatement(stmt)) {
      const loopBody = stmt.body;
      
      if (t.isSwitchStatement(loopBody)) {
        return {
          type: 'for-switch',
          switchNode: loopBody,
          loopNode: stmt
        };
      }
    }
  }
  
  return null;
}

/**
 * 查找栈变量
 */
function findStackVariable(funcNode) {
  const body = funcNode.body.body;
  
  for (const stmt of body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (t.isIdentifier(decl.id)) {
          const name = decl.id.name;
          
          // 常见的栈变量名
          if (['stack', 'sp', 'esp', 'ops', 'operands'].includes(name)) {
            return {
              name: name,
              declaration: decl
            };
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * 提取字节码
 */
function extractBytecode(vmInfo, stats) {
  const { bytecodeArray } = vmInfo;
  
  if (!bytecodeArray) return null;
  
  const bytecode = [];
  
  for (const element of bytecodeArray.elements) {
    if (t.isNumericLiteral(element)) {
      bytecode.push(element.value);
    } else if (t.isUnaryExpression(element)) {
      // 处理负数或其他一元运算
      if (t.isNumericLiteral(element.argument)) {
        const value = element.operator === '-' 
          ? -element.argument.value 
          : element.argument.value;
        bytecode.push(value);
      }
    }
  }
  
  return bytecode;
}

/**
 * 提取常量
 */
function extractConstants(vmInfo, stats) {
  // 虚拟机中的常量通常存储在数组中
  // 或者在 switch case 中直接使用
  
  const constants = [];
  const { functionNode } = vmInfo;
  
  // 遍历函数体查找常量数组
  traverse(functionNode, {
    ArrayExpression(path) {
      // 检查是否是常量数组
      const elements = path.node.elements;
      if (elements.length > 3 && 
          elements.every(el => 
            el && (t.isNumericLiteral(el) || t.isStringLiteral(el))
          )) {
        // 检查这个数组是否被用在分发器中
        // 如果是，很可能是常量池
        for (const element of elements) {
          if (t.isStringLiteral(element)) {
            constants.push(element.value);
          } else if (t.isNumericLiteral(element)) {
            constants.push(element.value);
          }
        }
      }
    },
    
    StringLiteral(path) {
      // 检查字符串是否是常量
      const value = path.node.value;
      
      // 过滤掉明显的非常量字符串
      if (value.length > 0 && value.length < 1000) {
        // 检查是否在字节码相关上下文中
        if (!constants.includes(value)) {
          constants.push(value);
        }
      }
    }
  });
  
  return constants;
}

/**
 * 解码字节码
 */
function decodeBytecode(bytecode, constants, stats) {
  const instructions = [];
  let pc = 0;
  
  while (pc < bytecode.length) {
    const op = bytecode[pc++];
    
    const instruction = {
      offset: pc - 1,
      opcode: op,
      name: getOpName(op),
      operands: [],
      raw: [op]
    };
    
    // 解析操作数
    switch (op) {
      case VM_OPS.PUSH:
      case VM_OPS.LOAD:
      case VM_OPS.LOAD_CONST:
        if (pc < bytecode.length) {
          instruction.operands.push(bytecode[pc++]);
          instruction.raw.push(instruction.operands[0]);
        }
        break;
        
      case VM_OPS.JMP:
      case VM_OPS.JZ:
      case VM_OPS.JNZ:
        if (pc < bytecode.length) {
          // 跳转目标可能是相对或绝对地址
          instruction.operands.push(bytecode[pc++]);
          instruction.raw.push(instruction.operands[0]);
        }
        break;
        
      case VM_OPS.CALL:
        if (pc < bytecode.length) {
          instruction.operands.push(bytecode[pc++]);
          instruction.raw.push(instruction.operands[0]);
        }
        break;
    }
    
    instructions.push(instruction);
  }
  
  return instructions;
}

/**
 * 获取操作码名称
 */
function getOpName(op) {
  for (const [name, value] of Object.entries(VM_OPS)) {
    if (value === op) {
      return name;
    }
  }
  return `UNKNOWN_${op}`;
}

/**
 * 模拟执行虚拟机
 */
function simulateVM(bytecode, constants, options, stats) {
  const { maxIterations } = options;
  
  const stack = [];
  const variables = {};
  let pc = 0;
  let iterations = 0;
  
  try {
    while (pc < bytecode.length && iterations < maxIterations) {
      iterations++;
      const op = bytecode[pc++];
      
      switch (op) {
        case VM_OPS.PUSH:
        case VM_OPS.LOAD_CONST:
          if (pc < bytecode.length) {
            const value = bytecode[pc++];
            // 区分常量和变量索引
            const constant = constants[value] !== undefined 
              ? constants[value] 
              : value;
            stack.push(constant);
          }
          break;
          
        case VM_OPS.POP:
          stack.pop();
          break;
          
        case VM_OPS.DUP:
          if (stack.length > 0) {
            stack.push(stack[stack.length - 1]);
          }
          break;
          
        case VM_OPS.ADD: {
          if (stack.length >= 2) {
            const b = stack.pop();
            const a = stack.pop();
            stack.push(a + b);
          }
          break;
        }
        
        case VM_OPS.SUB: {
          if (stack.length >= 2) {
            const b = stack.pop();
            const a = stack.pop();
            stack.push(a - b);
          }
          break;
        }
        
        case VM_OPS.MUL: {
          if (stack.length >= 2) {
            const b = stack.pop();
            const a = stack.pop();
            stack.push(a * b);
          }
          break;
        }
        
        case VM_OPS.DIV: {
          if (stack.length >= 2) {
            const b = stack.pop();
            const a = stack.pop();
            stack.push(a / b);
          }
          break;
        }
        
        case VM_OPS.EQ: {
          if (stack.length >= 2) {
            const b = stack.pop();
            const a = stack.pop();
            stack.push(a === b);
          }
          break;
        }
        
        case VM_OPS.LT: {
          if (stack.length >= 2) {
            const b = stack.pop();
            const a = stack.pop();
            stack.push(a < b);
          }
          break;
        }
        
        case VM_OPS.GT: {
          if (stack.length >= 2) {
            const b = stack.pop();
            const a = stack.pop();
            stack.push(a > b);
          }
          break;
        }
        
        case VM_OPS.JMP:
          if (pc < bytecode.length) {
            pc = bytecode[pc];
          }
          break;
          
        case VM_OPS.JZ:
          if (pc < bytecode.length) {
            const target = bytecode[pc++];
            if (!stack.pop()) {
              pc = target;
            }
          }
          break;
          
        case VM_OPS.STORE: {
          const name = stack.pop();
          const value = stack.pop();
          variables[name] = value;
          break;
        }
        
        case VM_OPS.LOAD: {
          if (pc < bytecode.length) {
            const idx = bytecode[pc++];
            const name = constants[idx] || idx;
            stack.push(variables[name]);
          }
          break;
        }
        
        case VM_OPS.HALT:
          stats.simulatedOutputs.push(...stack);
          return formatSimulationResult(stack, variables);
      }
    }
    
    stats.simulatedOutputs.push(...stack);
    return formatSimulationResult(stack, variables);
    
  } catch (error) {
    // 模拟执行出错
    return null;
  }
}

/**
 * 格式化模拟结果
 */
function formatSimulationResult(stack, variables) {
  const parts = [];
  
  if (stack.length > 0) {
    parts.push(`/* Stack output: ${stack.join(', ')} */`);
  }
  
  if (Object.keys(variables).length > 0) {
    const varStr = Object.entries(variables)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');
    parts.push(`/* Variables: ${varStr} */`);
  }
  
  return parts.join('\n');
}

/**
 * 翻译为 JavaScript
 */
function translateToJS(instructions, constants, stats) {
  const lines = [];
  
  lines.push('/* === Decompiled from VM === */');
  lines.push('');
  
  // 生成注释说明
  lines.push(`/* Bytecode length: ${instructions.length} instructions */`);
  lines.push(`/* Constants: ${constants.length} values */`);
  lines.push('');
  
  // 简化翻译：将每条指令转为注释
  lines.push('/* Decoded Instructions: */');
  
  for (const instr of instructions.slice(0, 100)) { // 限制输出
    const operands = instr.operands
      .map(op => constants[op] !== undefined ? `"${constants[op]}"` : op)
      .join(', ');
    
    lines.push(`/* ${instr.offset}: ${instr.name}${operands ? ' ' + operands : ''} */`);
  }
  
  if (instructions.length > 100) {
    lines.push(`/* ... and ${instructions.length - 100} more instructions */`);
  }
  
  lines.push('');
  lines.push('/* Full decompilation requires more complex analysis */');
  
  return lines.join('\n');
}

/**
 * 生成虚拟机分析报告
 */
function generateVMReport(vmInfo, bytecode, constants, instructions, stats) {
  return {
    detected: stats.vmDetected,
    bytecodeLength: bytecode.length,
    constantCount: constants.length,
    instructionCount: instructions.length,
    uniqueOps: [...new Set(instructions.map(i => i.opcode))],
    opDistribution: getOpDistribution(instructions),
    dispatcherType: vmInfo?.dispatcher?.type,
    suggestions: generateSuggestions(bytecode, instructions)
  };
}

/**
 * 获取操作码分布
 */
function getOpDistribution(instructions) {
  const distribution = {};
  
  for (const instr of instructions) {
    const name = instr.name;
    distribution[name] = (distribution[name] || 0) + 1;
  }
  
  return distribution;
}

/**
 * 生成分析建议
 */
function generateSuggestions(bytecode, instructions) {
  const suggestions = [];
  
  if (bytecode.length > 1000) {
    suggestions.push('Large bytecode detected - manual analysis recommended');
  }
  
  const hasCalls = instructions.some(i => i.name === 'CALL');
  if (hasCalls) {
    suggestions.push('Function calls detected - trace stack for recovery');
  }
  
  const hasJumps = instructions.some(i => i.name.startsWith('J'));
  if (hasJumps) {
    suggestions.push('Control flow jumps detected - build CFG for analysis');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Simple bytecode - may be fully reversible');
  }
  
  return suggestions;
}

module.exports = {
  deobfuscateVMP,
  detectVM,
  extractBytecode,
  decodeBytecode,
  simulateVM,
  translateToJS,
  VM_OPS
};
