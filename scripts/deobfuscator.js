#!/usr/bin/env node
/**
 * JS 逆向反混淆主入口
 * 
 * 统一接收混淆代码，自动识别类型并调度相应的反混淆器。
 * 
 * 使用方法:
 * 
 * Node.js API:
 * const { deobfuscate } = require('./deobfuscator');
 * const result = deobfuscate(code, options);
 * 
 * 命令行:
 * node deobfuscator.js <input.js> [options]
 * node deobfuscator.js <input.js> --type jsfuck
 * node deobfuscator.js <input.js> -o output.js -v
 */

const fs = require('fs');
const path = require('path');

// 导入 Babel 依赖
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

// 导入反混淆器
const {
  simple,
  jsfuck,
  jjencode,
  aaencode,
  controlFlow,
  vmprotect,
  detectObfuscationType,
  getDeobfuscator
} = require('./deobfuscators');

/**
 * 反混淆配置选项
 */
const defaultOptions = {
  // 混淆类型: 'auto' | 'simple' | 'jsfuck' | 'jjencode' | 'aaencode' | 'control-flow' | 'vmprotect'
  type: 'auto',
  
  // 是否输出详细处理信息
  verbose: false,
  
  // 输出文件路径（可选）
  output: null,
  
  // 最大处理迭代次数
  maxIterations: 10,
  
  // 是否启用链式处理
  chainProcessing: true,
  
  // 信任检测结果
  trustDetection: true
};

/**
 * 主要反混淆函数
 * 
 * @param {string} code - 混淆后的 JavaScript 代码
 * @param {object} options - 配置选项
 * @returns {object} { code, type, confidence, report, success }
 */
function deobfuscate(code, options = {}) {
  // 合并选项
  const opts = { ...defaultOptions, ...options };
  
  // 初始化报告
  const report = {
    steps: [],
    transforms: 0,
    warnings: [],
    errors: []
  };
  
  try {
    // 1. 预处理代码
    code = preprocessCode(code, report);
    
    // 2. 确定混淆类型
    let obfuscationType = opts.type;
    let confidence = 1.0;
    
    if (obfuscationType === 'auto') {
      const detected = detectObfuscationType(code);
      if (detected.length > 0) {
        obfuscationType = detected[0].type;
        confidence = detected[0].confidence;
        report.steps.push(`自动检测到混淆类型: ${detected[0].name} (置信度: ${(confidence * 100).toFixed(0)}%)`);
      } else {
        obfuscationType = 'simple';
        report.steps.push('未检测到特定混淆类型，使用简单反混淆');
      }
    }
    
    // 3. 执行反混淆
    let result;
    let iterations = 0;
    let currentCode = code;
    
    while (iterations < opts.maxIterations) {
      iterations++;
      
      const deobf = getDeobfuscator(obfuscationType);
      
      if (!deobf) {
        report.errors.push(`未知的混淆类型: ${obfuscationType}`);
        break;
      }
      
      if (opts.verbose) {
        console.log(`\n[迭代 ${iterations}] 使用反混淆器: ${deobf.displayName}`);
      }
      
      try {
        const deobfResult = deobf.deobfuscator(currentCode, {
          verbose: opts.verbose
        });
        
        if (deobfResult.success) {
          const previousCode = currentCode;
          currentCode = deobfResult.code;
          
          // 检查是否有变化
          if (normalizeCode(currentCode) === normalizeCode(previousCode)) {
            report.steps.push(`[${deobf.displayName}] 处理完成，无新变化`);
            break;
          }
          
          report.steps.push(`[${deobf.displayName}] 完成`);
          
          // 累加统计
          if (deobfResult.stats) {
            Object.keys(deobfResult.stats).forEach(key => {
              if (typeof deobfResult.stats[key] === 'number') {
                report.transforms += deobfResult.stats[key];
              }
            });
          }
          
          // 如果不需要链式处理，停止
          if (!opts.chainProcessing) {
            break;
          }
        } else {
          report.warnings.push(`[${deobf.displayName}] ${deobfResult.error || '处理失败'}`);
          break;
        }
        
      } catch (error) {
        report.errors.push(`[${deobf.displayName}] 错误: ${error.message}`);
        break;
      }
    }
    
    // 4. 链式处理：如果启用了链式处理，尝试其他反混淆器
    if (opts.chainProcessing && obfuscationType !== 'simple') {
      const simpleResult = tryChainDeobfuscation(currentCode, opts, report);
      if (simpleResult) {
        currentCode = simpleResult;
      }
    }
    
    // 5. 后处理
    currentCode = postprocessCode(currentCode, report);
    
    // 6. 输出结果
    if (opts.output) {
      fs.writeFileSync(opts.output, currentCode, 'utf8');
      report.steps.push(`结果已保存到: ${opts.output}`);
    }
    
    return {
      code: currentCode,
      type: obfuscationType,
      confidence: confidence,
      report: report,
      success: true
    };
    
  } catch (error) {
    report.errors.push(`严重错误: ${error.message}`);
    
    return {
      code: code,
      type: null,
      confidence: 0,
      report: report,
      success: false,
      error: error.message
    };
  }
}

/**
 * 预处理代码
 */
function preprocessCode(code, report) {
  // 移除 BOM
  if (code.charCodeAt(0) === 0xFEFF) {
    code = code.slice(1);
    report.steps.push('移除 BOM 标记');
  }
  
  // 统一行结束符
  code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  return code;
}

/**
 * 后处理代码
 */
function postprocessCode(code, report) {
  // 移除空行
  code = code.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // 移除行首行尾空白
  code = code.split('\n')
    .map(line => line.trim())
    .join('\n');
  
  return code;
}

/**
 * 标准化代码（用于比较）
 */
function normalizeCode(code) {
  return code
    .replace(/\s+/g, '')
    .replace(/;+/g, ';')
    .replace(/\{+/g, '{')
    .replace(/\}+/g, '}')
    .trim();
}

/**
 * 尝试链式反混淆
 */
function tryChainDeobfuscation(code, options, report) {
  // 尝试使用简单反混淆器处理结果
  try {
    const simpleResult = simple.deobfuscateSimple(code, { verbose: false });
    
    if (simpleResult.success) {
      const normalized = normalizeCode(simpleResult.code);
      const originalNormalized = normalizeCode(code);
      
      if (normalized !== originalNormalized) {
        report.steps.push('[简单反混淆] 链式处理完成');
        return simpleResult.code;
      }
    }
  } catch (e) {
    // 忽略链式处理错误
  }
  
  return null;
}

/**
 * 异步版本的反混淆
 */
function deobfuscateAsync(code, options = {}) {
  return new Promise((resolve) => {
    // 同步执行，因为 Babel 操作本身很快
    const result = deobfuscate(code, options);
    resolve(result);
  });
}

/**
 * 批量处理
 */
function deobfuscateBatch(codes, options = {}) {
  const results = [];
  
  for (const code of codes) {
    const result = deobfuscate(code, options);
    results.push(result);
  }
  
  return results;
}

/**
 * 从文件读取并反混淆
 */
function deobfuscateFile(inputPath, outputPath, options = {}) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`输入文件不存在: ${inputPath}`);
  }
  
  const code = fs.readFileSync(inputPath, 'utf8');
  
  const result = deobfuscate(code, {
    ...options,
    output: outputPath
  });
  
  return result;
}

/**
 * 命令行入口
 */
function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  const options = {
    type: 'auto',
    verbose: false,
    output: null
  };
  
  let inputPath = null;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
    
    if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
      continue;
    }
    
    if (arg === '-o' || arg === '--output') {
      options.output = args[++i];
      continue;
    }
    
    if (arg === '-t' || arg === '--type') {
      options.type = args[++i];
      continue;
    }
    
    if (arg === '--no-chain') {
      options.chainProcessing = false;
      continue;
    }
    
    // 其他参数作为输入文件
    if (!arg.startsWith('-')) {
      inputPath = arg;
    }
  }
  
  // 验证输入
  if (!inputPath) {
    console.error('错误: 请指定输入文件');
    console.error('用法: node deobfuscator.js <input.js> [options]');
    console.error('帮助: node deobfuscator.js --help');
    process.exit(1);
  }
  
  // 读取输入
  let code;
  try {
    code = fs.readFileSync(inputPath, 'utf8');
  } catch (e) {
    console.error(`错误: 无法读取文件 ${inputPath}: ${e.message}`);
    process.exit(1);
  }
  
  // 执行反混淆
  console.log(`\n读取文件: ${inputPath}`);
  console.log(`文件大小: ${code.length} 字符`);
  console.log(`混淆类型: ${options.type === 'auto' ? '自动检测' : options.type}`);
  console.log('');
  
  const startTime = Date.now();
  const result = deobfuscate(code, options);
  const elapsed = Date.now() - startTime;
  
  // 输出结果
  console.log('\n' + '='.repeat(50));
  console.log('反混淆结果');
  console.log('='.repeat(50));
  
  if (result.success) {
    console.log(`状态: 成功`);
    console.log(`检测类型: ${result.type || '未知'}`);
    console.log(`置信度: ${result.confidence ? (result.confidence * 100).toFixed(0) + '%' : 'N/A'}`);
    console.log(`处理耗时: ${elapsed}ms`);
    console.log(`输出长度: ${result.code.length} 字符`);
    
    if (options.verbose) {
      console.log('\n处理步骤:');
      result.report.steps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step}`);
      });
      
      if (result.report.warnings.length > 0) {
        console.log('\n警告:');
        result.report.warnings.forEach(w => {
          console.log(`  ! ${w}`);
        });
      }
    }
    
    // 输出代码
    if (!options.output) {
      console.log('\n' + '-'.repeat(50));
      console.log('还原后的代码:');
      console.log('-'.repeat(50));
      console.log(result.code);
    }
    
  } else {
    console.log(`状态: 失败`);
    console.log(`错误: ${result.error || '未知错误'}`);
    
    if (options.verbose && result.report.errors.length > 0) {
      console.log('\n错误详情:');
      result.report.errors.forEach(e => {
        console.log(`  ! ${e}`);
      });
    }
  }
  
  console.log('');
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`
JS 逆向反混淆工具
=================

用法:
  node deobfuscator.js <input.js> [options]

参数:
  input.js              输入的 JavaScript 文件

选项:
  -t, --type <type>     指定混淆类型
                        类型: auto, simple, jsfuck, jjencode, aaencode, control-flow, vmprotect
                        默认: auto (自动检测)

  -o, --output <file>   输出文件路径
                        默认: 输出到 stdout

  -v, --verbose         显示详细处理信息
                        默认: false

  --no-chain            禁用链式处理
                        默认: 启用链式处理

  -h, --help            显示帮助信息

示例:
  # 自动检测并反混淆
  node deobfuscator.js obfuscated.js

  # 反混淆 JSFuck 代码
  node deobfuscator.js jsfuck.js --type jsfuck

  # 输出到文件
  node deobfuscator.js input.js -o output.js

  # 详细模式
  node deobfuscator.js input.js -v

Node.js API:
  const { deobfuscate } = require('./deobfuscator');
  
  const result = deobfuscate(code, {
    type: 'auto',
    verbose: true,
    chainProcessing: true
  });
  
  console.log(result.code);
`);
}

// 导出模块
module.exports = {
  deobfuscate,
  deobfuscateAsync,
  deobfuscateBatch,
  deobfuscateFile,
  detectObfuscationType,
  getDeobfuscator,
  defaultOptions
};

// 如果直接运行此文件
if (require.main === module) {
  main();
}
