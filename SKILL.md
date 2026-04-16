---
name: 技术反混淆skill
author: szb
description: 通过ast技术来实现从简单的js混淆到复杂的混淆，包括:JSFuck、JJEncode、AAEncode、控制流平坦化还原、JSVMP 还原、ob混淆
---


# JS 逆向反混淆 Skill


## 概述

本 Skill 提供完整的 JavaScript 代码反混淆功能，支持多种主流混淆技术的自动检测与还原。

## 功能特性

### 1. 简单混淆还原 (simple.js)
- 变量名还原
- 字符串常量解密
- 字符串拼接还原
- 无意义包装函数移除
- 数值常量还原

### 2. JSFuck 还原 (jsfuck.js)
- 完整 JSFuck 6字符编码解析
- 还原为可读 JavaScript

### 3. JJEncode 还原 (jjencode.js)
- `$` 系列字符编码解析
- 标准 JS 代码还原

### 4. AAEncode 还原 (aaencode.js)
- 日文表情符号编码解析
- 可执行 JS 还原

### 5. 控制流平坦化还原 (control-flow.js)
- 状态变量分发器检测
- 执行顺序追踪
- 真实控制流结构还原
- 嵌套平坦化处理

### 6. JSVMP 还原 (vmprotect.js)
- 虚拟机特征检测
- 字节码/操作数提取
- 指令模式识别
- 等价 JS 代码还原

## 使用方法

### Node.js 环境

```javascript
const { deobfuscate } = require('./scripts/deobfuscator.js');

// 自动检测类型
const result = deobfuscate(obfuscatedCode);

// 指定类型
const result = deobfuscate(obfuscatedCode, { 
  type: 'jsfuck',
  verbose: true 
});

// 链式调用
const result = deobfuscate(obfuscatedCode)
  .then(r => deobfuscate(r, { type: 'simple' }));
```

### 命令行使用

```bash
node deobfuscator.js <input.js> [options]
```

## 选项说明

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | string | 'auto' | 混淆类型: auto/simple/jsfuck/jjencode/aaencode/control-flow/vmprotect |
| verbose | boolean | false | 输出详细处理信息 |
| output | string | null | 输出文件路径 |

## 技术栈

- **@babel/parser**: JavaScript 代码解析
- **@babel/traverse**: AST 遍历
- **@babel/types**: AST 节点类型判断
- **@babel/generator**: 代码生成
- **@babel/template**: 代码模板生成

## 目录结构

```
js-deobfuscation/
├── SKILL.md                           # 本文件
├── README.md                           # 详细使用说明
├── references/
│   ├── 混淆类型指南.md                 # 各类混淆原理详解
│   └── AST基础指南.md                  # Babel AST 入门
└── scripts/
    ├── deobfuscator.js                # 主入口
    ├── deobfuscators/
    │   ├── index.js                    # 导出所有反混淆器
    │   ├── simple.js                   # 简单混淆还原
    │   ├── jsfuck.js                   # JSFuck 还原
    │   ├── jjencode.js                 # JJEncode 还原
    │   ├── aaencode.js                 # AAEncode 还原
    │   ├── control-flow.js             # 控制流平坦化还原
    │   └── vmprotect.js                # JSVMP 还原
    └── utils/
        ├── index.js                    # 工具导出
        ├── ast-utils.js                # AST 工具函数
        └── string-decoder.js           # 字符串解密工具
```

## 注意事项

1. **兼容性**: 需要 Node.js 14+ 环境
2. **依赖安装**: `npm install @babel/parser @babel/traverse @babel/types @babel/generator @babel/template`
3. **局限性**: 复杂的自定义虚拟机保护可能无法完全还原
4. **安全性**: 仅用于合法的代码分析场景
