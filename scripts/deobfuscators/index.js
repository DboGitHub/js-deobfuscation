/**
 * 反混淆器统一导出
 * 导出所有反混淆模块
 */

// 简单混淆还原器
const simple = require('./simple');

// JSFuck 还原器
const jsfuck = require('./jsfuck');

// JJEncode 还原器
const jjencode = require('./jjencode');

// AAEncode 还原器
const aaencode = require('./aaencode');

// 控制流平坦化还原器
const controlFlow = require('./control-flow');

// JSVMP 还原器
const vmprotect = require('./vmprotect');

/**
 * 所有反混淆器列表
 */
const deobfuscators = {
  simple: {
    name: 'simple',
    displayName: '简单混淆还原',
    detector: (code) => detectSimpleObfuscation(code),
    deobfuscator: simple.deobfuscateSimple
  },
  
  jsfuck: {
    name: 'jsfuck',
    displayName: 'JSFuck 还原',
    detector: jsfuck.isJSFuck,
    deobfuscator: jsfuck.deobfuscateJSFuck
  },
  
  jjencode: {
    name: 'jjencode',
    displayName: 'JJEncode 还原',
    detector: jjencode.isJJEncode,
    deobfuscator: jjencode.deobfuscateJJEncode
  },
  
  aaencode: {
    name: 'aaencode',
    displayName: 'AAEncode 还原',
    detector: aaencode.isAAEncode,
    deobfuscator: aaencode.deobfuscateAAEncode
  },
  
  'control-flow': {
    name: 'control-flow',
    displayName: '控制流平坦化还原',
    detector: detectControlFlowObfuscation,
    deobfuscator: controlFlow.deobfuscateControlFlow
  },
  
  vmprotect: {
    name: 'vmprotect',
    displayName: 'JSVMP 还原',
    detector: detectVMPObfuscation,
    deobfuscator: vmprotect.deobfuscateVMP
  }
};

/**
 * 检测简单混淆
 */
function detectSimpleObfuscation(code) {
  // 检测常见的简单混淆特征
  const patterns = [
    // 变量名替换（混淆后的变量名通常是短名称或十六进制）
    /\b[_$][0-9a-f]{2,}\s*=/i,
    // 字符串拼接
    /["'][^"']+["']\s*\+\s*["'][^"']+["']/,
    // 自执行函数
    /\(function\s*\([^)]*\)\s*\{[^}]+\}\s*\)\s*\(/,
    // atob 调用
    /atob\s*\(/,
    // 十六进制字符串
    /\\x[0-9a-fA-F]{2}/,
  ];
  
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(code)) {
      score++;
    }
  }
  
  return score >= 1;
}

/**
 * 检测控制流平坦化混淆
 */
function detectControlFlowObfuscation(code) {
  // 检测 while(true) { switch(...) { ... } } 模式
  const pattern1 = /while\s*\(\s*(true|1)\s*\)\s*\{[^}]*switch\s*\(/;
  
  // 检测 for(;;) { switch(...) { ... } } 模式
  const pattern2 = /for\s*\([^)]*\)\s*\{[^}]*switch\s*\(/;
  
  // 检测 do { switch(...) { ... } } while(true) 模式
  const pattern3 = /do\s*\{[^}]*switch\s*\([^)]+\)[^}]*\}\s*while\s*\(\s*(true|1)\s*\)/;
  
  // 使用简单的正则检测，避免 AST 遍历带来的问题
  return pattern1.test(code) || pattern2.test(code) || pattern3.test(code);
}

/**
 * 检测 VMP 混淆
 */
function detectVMPObfuscation(code) {
  // 检测虚拟机特征
  const patterns = [
    // 字节码数组
    /(?:var|let|const)\s+\w+\s*=\s*\[[\s\S]*?\]\s*;/,
    // 分发器循环
    /while\s*\(\s*true\s*\)\s*\{[\s\S]*?switch\s*\(/,
    // 常见的虚拟机变量名
    /bytecode|opcode|dispatcher|vm/i,
    // switch-case 作为分发器
    /switch\s*\(\s*\w+\s*\+\+\s*\)/,
  ];
  
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(code)) {
      score++;
    }
  }
  
  return score >= 2;
}

/**
 * 获取所有可用的反混淆器
 */
function getAllDeobfuscators() {
  return Object.keys(deobfuscators).map(key => ({
    key,
    ...deobfuscators[key]
  }));
}

/**
 * 获取指定类型的反混淆器
 */
function getDeobfuscator(type) {
  return deobfuscators[type] || null;
}

/**
 * 检测混淆类型
 * 使用简单的正则表达式检测，避免 AST 遍历
 */
function detectObfuscationType(code) {
  const results = [];
  
  // 简单混淆检测
  if (detectSimpleObfuscation(code)) {
    results.push({
      type: 'simple',
      name: '简单混淆还原',
      confidence: 0.7
    });
  }
  
  // JSFuck 检测
  if (jsfuck.isJSFuck(code)) {
    results.push({
      type: 'jsfuck',
      name: 'JSFuck 还原',
      confidence: 0.9
    });
  }
  
  // JJEncode 检测
  if (jjencode.isJJEncode(code)) {
    results.push({
      type: 'jjencode',
      name: 'JJEncode 还原',
      confidence: 0.9
    });
  }
  
  // AAEncode 检测
  if (aaencode.isAAEncode(code)) {
    results.push({
      type: 'aaencode',
      name: 'AAEncode 还原',
      confidence: 0.9
    });
  }
  
  // 控制流平坦化检测
  if (detectControlFlowObfuscation(code)) {
    results.push({
      type: 'control-flow',
      name: '控制流平坦化还原',
      confidence: 0.8
    });
  }
  
  // JSVMP 检测
  if (detectVMPObfuscation(code)) {
    results.push({
      type: 'vmprotect',
      name: 'JSVMP 还原',
      confidence: 0.8
    });
  }
  
  // 按置信度排序
  results.sort((a, b) => b.confidence - a.confidence);
  
  return results;
}

/**
 * 批量导出
 */
module.exports = {
  // 各反混淆器
  simple,
  jsfuck,
  jjencode,
  aaencode,
  controlFlow,
  vmprotect,
  
  // 工具函数
  deobfuscators,
  getAllDeobfuscators,
  getDeobfuscator,
  detectObfuscationType
};
