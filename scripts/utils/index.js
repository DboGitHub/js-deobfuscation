/**
 * 工具模块导出
 * 统一导出所有工具函数
 */

const astUtils = require('./ast-utils');
const stringDecoder = require('./string-decoder');

module.exports = {
  ...astUtils,
  ...stringDecoder
};

// 单独导出各模块，方便按需引用
module.exports.astUtils = astUtils;
module.exports.stringDecoder = stringDecoder;
