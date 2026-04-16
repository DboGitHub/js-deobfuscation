# JS 逆向反混淆工具

一个功能完整的 JavaScript 代码反混淆工具，支持多种主流混淆技术的自动检测与还原。

## 功能特性

| 模块 | 文件 | 功能 |
|------|------|------|
| 简单混淆 | `simple.js` | 变量名、字符串常量、字符串拼接、包装函数、数值常量还原 |
| JSFuck | `jsfuck.js` | JSFuck 6字符编码解析与还原 |
| JJEncode | `jjencode.js` | JJEncode `$` 系列字符编码解析 |
| AAEncode | `aaencode.js` | 日文表情符号编码解析 |
| 控制流平坦化 | `control-flow.js` | 状态变量分发器检测与控制流还原 |
| JSVMP | `vmprotect.js` | 虚拟机字节码提取与代码还原 |

## 快速开始

### 安装依赖

```bash
npm install @babel/parser @babel/traverse @babel/types @babel/generator @babel/template
```

### 基本用法

```javascript
const { deobfuscate } = require('./scripts/deobfuscator.js');

// 自动检测类型
const result = deobfuscate(obfuscatedCode);

// 指定类型
const result = deobfuscate(obfuscatedCode, { 
  type: 'jsfuck',
  verbose: true 
});

// 获取处理报告
const result = deobfuscate(obfuscatedCode, { 
  verbose: true 
});
console.log(result.report);
```

### 命令行用法

```bash
# 自动检测
node scripts/deobfuscator.js input.js

# 指定类型
node scripts/deobfuscator.js input.js --type jsfuck

# 输出到文件
node scripts/deobfuscator.js input.js -o output.js

# 详细输出
node scripts/deobfuscator.js input.js -v
```

## 混淆类型详解

### 1. JSFuck

JSFuck 使用 6 个字符 `(!+[])` 来编码任意 JavaScript 代码。

**示例:**
```javascript
// 原始代码
alert(1)

// JSFuck 编码
[][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]](![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[![]]+([][[]]+[])[+!+[]+[+[]]]+([][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]]]+[])[!+[]+!+[]+!+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[!+[]+!+[]])()
```

### 2. JJEncode

JJEncode 使用 `$` 开头的一系列字符来编码 JavaScript 代码。

**特征:**
- 以 `$` 开头
- 包含大量 `$ _ + ~` 等字符
- 最终调用 `eval()` 执行

### 3. AAEncode

AAEncode 使用日文表情符号来编码 JavaScript 代码。

**特征:**
- 使用日文颜文字表情
- 包含 `ω` `ﾟ` `д` 等字符
- 通常以 `ﾟωﾟﾉ` 开头

### 4. 控制流平坦化

将正常的代码块通过 switch 语句和状态变量进行打乱。

**原始结构:**
```
function foo() {
  if (condition) { A }
  else { B }
}
```

**平坦化后:**
```
function foo() {
  let state = 0;
  switch(state) {
    case 0:
      if (condition) state = 1; else state = 2; break;
    case 1:
      A; state = 3; break;
    case 2:
      B; state = 3; break;
    case 3:
      return;
  }
}
```

### 5. JSVMP (JavaScript 虚拟机保护)

将代码编译为字节码，通过自定义解释器执行。

**特征:**
- 包含字节码数组
- 包含分发器 (switch/while)
- 包含操作数栈操作

## API 参考

### deobfuscate(code, options)

**参数:**
- `code` (string): 混淆后的 JavaScript 代码
- `options` (object, optional):
  - `type` (string): 混淆类型，'auto' | 'simple' | 'jsfuck' | 'jjencode' | 'aaencode' | 'control-flow' | 'vmprotect'
  - `verbose` (boolean): 是否输出详细处理信息
  - `output` (string): 输出文件路径

**返回值:**
```javascript
{
  code: string,           // 还原后的代码
  type: string,           // 检测到的混淆类型
  confidence: number,     // 检测置信度 (0-1)
  report: {               // 处理报告
    steps: string[],      // 处理步骤
    transforms: number,    // 转换次数
    warnings: string[]    // 警告信息
  }
}
```

## 限制与注意事项

1. **复杂虚拟机**: 高度定制的虚拟机保护可能无法完全还原
2. **代码压缩**: 某些混淆会与代码压缩结合，还原效果可能有限
3. **环境依赖**: 部分混淆代码依赖特定环境 (DOM, Node APIs)
4. **合法性**: 请仅用于合法的代码分析、调试和安全研究场景

## 技术栈

- **@babel/parser**: 解析 JavaScript 代码生成 AST
- **@babel/traverse**: 遍历和修改 AST
- **@babel/types**: AST 节点类型判断和创建
- **@babel/generator**: 将 AST 转换回代码
- **@babel/template**: 代码模板生成

## License

MIT
