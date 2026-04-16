# Babel AST 基础指南

本文档介绍 Babel AST（抽象语法树）的基础知识，帮助理解反混淆工具的工作原理。

## 什么是 AST？

AST（Abstract Syntax Tree）是源代码结构化的树状表示。每个节点代表源代码中的一个语法构造。

```
源代码: function add(a, b) { return a + b; }

AST 结构:
Program
├── FunctionDeclaration
│   ├── id: Identifier (name: "add")
│   ├── params: [Identifier, Identifier]
│   │   ├── id: Identifier (name: "a")
│   │   └── id: Identifier (name: "b")
│   └── body: BlockStatement
│       └── body: [ReturnStatement]
│           └── argument: BinaryExpression
│               ├── operator: "+"
│               ├── left: Identifier (name: "a")
│               └── right: Identifier (name: "b")
```

## Babel 工具链

| 工具 | 功能 |
|------|------|
| @babel/parser | 解析 JavaScript 代码生成 AST |
| @babel/traverse | 遍历和修改 AST |
| @babel/types | 创建和判断 AST 节点类型 |
| @babel/generator | 将 AST 转换回代码 |
| @babel/template | 代码模板生成 |

## 常用节点类型

### 1. 程序结构

```javascript
// Program - 整个程序
{
  type: 'Program',
  body: [/* 语句列表 */]
}

// File - 包含额外元信息的包装
{
  type: 'File',
  program: Program
}
```

### 2. 声明

```javascript
// VariableDeclaration - 变量声明
{
  type: 'VariableDeclaration',
  kind: 'var' | 'let' | 'const',
  declarations: [VariableDeclarator]
}

// FunctionDeclaration - 函数声明
{
  type: 'FunctionDeclaration',
  id: Identifier,
  params: [Pattern],
  body: BlockStatement
}

// ClassDeclaration - 类声明
{
  type: 'ClassDeclaration',
  id: Identifier,
  body: ClassBody
}
```

### 3. 表达式

```javascript
// Identifier - 标识符
{
  type: 'Identifier',
  name: 'variableName'
}

// Literal - 字面量
{
  type: 'Literal',
  value: 'hello' | 123 | true | null | /regex/,
  raw: "'hello'" | '123' | ...
}

// ArrayExpression - 数组
{
  type: 'ArrayExpression',
  elements: [Expression]
}

// ObjectExpression - 对象
{
  type: 'ObjectExpression',
  properties: [ObjectProperty | SpreadElement]
}

// BinaryExpression - 二元运算
{
  type: 'BinaryExpression',
  operator: '+' | '-' | '*' | '/' | '==' | '===' | ...
  left: Expression,
  right: Expression
}

// UnaryExpression - 一元运算
{
  type: 'UnaryExpression',
  operator: '!' | '-' | '+' | 'typeof' | 'void' | 'delete',
  argument: Expression,
  prefix: true
}

// CallExpression - 函数调用
{
  type: 'CallExpression',
  callee: Expression,
  arguments: [Expression]
}

// MemberExpression - 成员访问
{
  type: 'MemberExpression',
  object: Expression,
  property: Expression,
  computed: true | false  // true: obj[prop], false: obj.prop
}

// ConditionalExpression - 条件表达式
{
  type: 'ConditionalExpression',
  test: Expression,
  consequent: Expression,
  alternate: Expression
}
```

### 4. 语句

```javascript
// ExpressionStatement - 表达式语句
{
  type: 'ExpressionStatement',
  expression: Expression
}

// IfStatement - if 语句
{
  type: 'IfStatement',
  test: Expression,
  consequent: Statement,
  alternate: Statement | null
}

// SwitchStatement - switch 语句
{
  type: 'SwitchStatement',
  discriminant: Expression,
  cases: [SwitchCase]
}

// SwitchCase - switch 分支
{
  type: 'SwitchCase',
  test: Expression | null,  // null 表示 default
  consequent: [Statement]
}

// ForStatement - for 循环
{
  type: 'ForStatement',
  init: VariableDeclaration | Expression | null,
  test: Expression | null,
  update: Expression | null,
  body: Statement
}

// WhileStatement - while 循环
{
  type: 'WhileStatement',
  test: Expression,
  body: Statement
}

// BlockStatement - 代码块
{
  type: 'BlockStatement',
  body: [Statement]
}

// ReturnStatement - return 语句
{
  type: 'ReturnStatement',
  argument: Expression | null
}
```

## 代码示例

### 解析代码

```javascript
const parser = require('@babel/parser');

const code = 'const x = 1 + 2;';
const ast = parser.parse(code);

console.log(JSON.stringify(ast, null, 2));
```

### 遍历 AST

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = `
  const x = 1 + 2;
  console.log(x);
`;

const ast = parser.parse(code);

traverse(ast, {
  // 进入节点时调用
  enter(path) {
    console.log(`Enter: ${path.node.type}`);
  },
  
  // 退出节点时调用
  exit(path) {
    console.log(`Exit: ${path.node.type}`);
  },
  
  // 特定类型处理
  Identifier(path) {
    if (path.node.name === 'x') {
      console.log('Found identifier x');
    }
  },
  
  NumericLiteral(path) {
    console.log(`Number: ${path.node.value}`);
  }
});
```

### 修改 AST

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const generate = require('@babel/generator').default;

const code = `x + 1`;

const ast = parser.parse(code);

traverse(ast, {
  BinaryExpression(path) {
    // 将 x + 1 替换为 x + 2
    if (path.node.operator === '+') {
      path.node.right = t.numericLiteral(2);
    }
  }
});

const result = generate(ast);
console.log(result.code); // x + 2
```

### 创建新节点

```javascript
const t = require('@babel/types');

// 创建标识符
const id = t.identifier('foo');

// 创建数值字面量
const num = t.numericLiteral(42);

// 创建字符串字面量
const str = t.stringLiteral('hello');

// 创建二元表达式: a + b
const add = t.binaryExpression('+', 
  t.identifier('a'), 
  t.identifier('b')
);

// 创建函数调用: console.log('hello')
const call = t.callExpression(
  t.memberExpression(
    t.identifier('console'),
    t.identifier('log'),
    false
  ),
  [t.stringLiteral('hello')]
);

// 创建变量声明: const x = 42
const declaration = t.variableDeclaration('const', [
  t.variableDeclarator(
    t.identifier('x'),
    t.numericLiteral(42)
  )
]);

// 创建 if 语句
const ifStatement = t.ifStatement(
  t.identifier('condition'),
  t.blockStatement([
    t.expressionStatement(
      t.callExpression(
        t.identifier('doSomething'),
        []
      )
    )
  ]),
  t.blockStatement([
    t.expressionStatement(
      t.callExpression(
        t.identifier('doOther'),
        []
      )
    )
  ])
);
```

## 路径 (Path) 对象

`path` 对象表示节点在 AST 中的位置和路径。

### 常用属性

```javascript
path.node      // 当前节点
path.parent    // 父节点
path.parentPath // 父节点的 path
path.scope     // 当前作用域
path.hub       // AST 根节点
```

### 常用方法

```javascript
// 替换当前节点
path.replaceWith(newNode);
path.replaceWithMultiple([node1, node2]);

// 移除当前节点
path.remove();

// 在前后插入节点
path.insertBefore(nodes);
path.insertAfter(nodes);

// 跳过遍历子节点
path.skip();
path.skip();

 // 检查节点类型
path.isNodeType();
path.assertNodeType('Identifier');

// 查找父级
path.getFunctionParent();  // 函数父级
path.getStatementParent(); // 语句父级
```

## 作用域 (Scope)

```javascript
traverse(ast, {
  FunctionDeclaration(path) {
    const scope = path.scope;
    
    // 绑定（变量）
    console.log(scope.bindings);  // 函数内定义的变量
    
    // 查询变量
    const binding = scope.getBinding('x');
    if (binding) {
      console.log(binding.path);      // 定义位置
      console.log(binding.references); // 引用次数
    }
    
    // 检查变量是否在作用域内
    console.log(scope.hasOwnBinding('x'));
    
    // 生成唯一名称
    console.log(scope.generateUid('temp'));
  }
});
```

## 代码转换示例

### 示例 1: 字符串常量加密

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const generate = require('@babel/generator').default;

// 简单的字符串加密函数生成器
function createStringDecoder(strings) {
  const encoded = strings.map(s => 
    Buffer.from(s).toString('base64')
  );
  
  return t.callExpression(
    t.identifier('atob'),
    [t.stringLiteral(encoded[0])]
  );
}

// 转换: "hello" -> atob("aGVsbG8=")
traverse(ast, {
  StringLiteral(path) {
    if (path.parent.type !== 'BinaryExpression' || 
        path.parent.operator !== '+') {
      // 检查是否是简单字符串（非拼接）
      const decoded = Buffer.from(path.node.value).toString('base64');
      const replacement = t.callExpression(
        t.identifier('atob'),
        [t.stringLiteral(decoded)]
      );
      path.replaceWith(replacement);
    }
  }
});
```

### 示例 2: 移除自执行函数包装

```javascript
// 转换前
(function(){ var x = 1; return x; })();

// 转换后
var x = 1; return x;

traverse(ast, {
  CallExpression(path) {
    const { callee } = path.node;
    
    // 检测 (function(){...})()
    if (t.isFunctionExpression(callee) && 
        callee.body.body.length === 1 &&
        t.isReturnStatement(callee.body.body[0])) {
      
      // 将 return 替换为赋值到临时变量
      const returnStmt = callee.body.body[0];
      const tempVar = path.scope.generateUid('result');
      
      // 在原位置插入变量声明
      path.replaceWithMultiple([
        t.variableDeclaration('var', [
          t.variableDeclarator(
            t.identifier(tempVar),
            returnStmt.argument
          )
        ])
      ]);
    }
  }
});
```

### 示例 3: 控制流平坦化还原

```javascript
// 检测平坦化模式
traverse(ast, {
  WhileStatement(path) {
    const body = path.node.body;
    if (!t.isSwitchStatement(body)) return;
    
    // 查找状态变量
    const stateVar = findStateVariable(path);
    if (!stateVar) return;
    
    // 构建执行图
    const graph = buildControlFlowGraph(body, stateVar);
    
    // 拓扑排序
    const order = topologicalSort(graph);
    
    // 替换为原始结构
    const deobfuscated = rebuildStatements(order);
    path.replaceWithMultiple(deobfuscated);
  }
});
```

## 调试工具

### 打印 AST

```javascript
const parser = require('@babel/parser');
const generate = require('@babel/generator');

function printAst(code) {
  const ast = parser.parse(code);
  console.log(JSON.stringify(ast, null, 2));
}
```

### 查看节点信息

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

traverse(ast, {
  enter(path) {
    console.log(`[${path.node.type}] ${path.node.loc?.start.line}:${path.node.loc?.start.column}`);
  }
});
```

## 最佳实践

1. **始终检查空值**: 使用 `t.isXxx()` 或 `path.node.xxx` 前检查
2. **作用域感知**: 修改变量名时使用 `scope.generateUid()`
3. **路径正确性**: 替换节点后注意更新路径
4. **类型守卫**: 使用 `@babel/types` 的类型守卫函数
5. **代码生成配置**: 配置 `generate()` 选项控制输出格式

```javascript
const generate = require('@babel/generator').default;

const output = generate(ast, {
  comments: true,      // 保留注释
  compact: false,      // 紧凑格式
  concise: false,     // 冗长格式（更易读）
  json: false,         // JSON 兼容性
  sourceMaps: false,   // 源码映射
  retainLines: false,  // 保留行号
}, code);

console.log(output.code);
```

## 参考资源

- [Babel 官网](https://babeljs.io/)
- [AST Explorer](https://astexplorer.net/) - 在线 AST 可视化工具
- [@babel/types 文档](https://babeljs.io/docs/en/babel-types)
- [@babel/traverse 文档](https://babeljs.io/docs/en/babel-traverse)
- [@babel/generator 文档](https://babeljs.io/docs/en/babel-generator)
