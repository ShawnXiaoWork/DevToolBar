import { ToolId } from "./types";

export const translations = {
  en: {
    appTitle: "DevToolbox",
    utilities: "Utilities",
    builtWith: "Built with React & Tailwind",
    tools: {
      timestamp: {
        name: "Timestamp Converter",
        description: "Convert between Unix timestamps and human-readable dates."
      },
      json: {
        name: "JSON Formatter",
        description: "Validate, format, and minify JSON data."
      }
    },
    timestamp: {
      currentTime: "Current Time",
      paused: "PAUSED",
      live: "LIVE",
      unixSec: "Unix Timestamp (s)",
      unixMs: "Unix Timestamp (ms)",
      formatted: "Formatted",
      converter: "Converter",
      timestampInput: "Timestamp",
      dateInput: "Date String",
      placeholderTimestamp: "e.g., 1678888888",
      placeholderDate: "e.g., 2023-03-15 10:00:00",
      unit: "Unit:",
      seconds: "Seconds",
      milliseconds: "Milliseconds",
      result: "Result",
      waiting: "Waiting for input...",
      copy: "Copy",
      copied: "Copied",
      invalidInput: "Invalid Input"
    },
    json: {
      title: "JSON Editor & Viewer",
      beautify: "Beautify",
      minify: "Minify",
      copy: "Copy",
      clear: "Clear",
      length: "Length",
      chars: "chars",
      parseError: "JSON Parse Error",
      validJsonMsg: "Valid JSON will appear here as a tree",
      invalidJson: "Invalid JSON"
    }
  },
  zh: {
    appTitle: "开发者工具箱",
    utilities: "实用工具",
    builtWith: "基于 React & Tailwind 构建",
    tools: {
      timestamp: {
        name: "时间戳转换",
        description: "Unix 时间戳与人类可读日期互转。"
      },
      json: {
        name: "JSON 格式化",
        description: "验证、格式化及压缩 JSON 数据。"
      }
    },
    timestamp: {
      currentTime: "当前时间",
      paused: "已暂停",
      live: "运行中",
      unixSec: "Unix 时间戳 (秒)",
      unixMs: "Unix 时间戳 (毫秒)",
      formatted: "格式化时间",
      converter: "转换器",
      timestampInput: "时间戳",
      dateInput: "日期字符串",
      placeholderTimestamp: "例如：1678888888",
      placeholderDate: "例如：2023-03-15 10:00:00",
      unit: "单位：",
      seconds: "秒",
      milliseconds: "毫秒",
      result: "结果",
      waiting: "等待输入...",
      copy: "复制",
      copied: "已复制",
      invalidInput: "无效输入"
    },
    json: {
      title: "JSON 编辑与查看器",
      beautify: "美化",
      minify: "压缩",
      copy: "复制",
      clear: "清空",
      length: "长度",
      chars: "字符",
      parseError: "JSON 解析错误",
      validJsonMsg: "有效的 JSON 将以树形结构显示在这里",
      invalidJson: "无效的 JSON"
    }
  }
};
