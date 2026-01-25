---
description: 分析游戏UI参考图并生成Unity UI Toolkit元素数据
---

# UI 参考图分析规则

当用户提供游戏界面参考图时，按以下规则分析并生成 UI 元素 JSON 数据。

## 分析步骤

### 1. 整体布局识别
- 识别画布尺寸（根据图片比例推断，默认 1920×1080）
- 识别主要布局区域（顶部状态栏、底部操作栏、侧边栏、中心区域等）
- 确定元素层级关系

### 2. 元素类型识别

| 视觉特征 | Unity UI Toolkit 类型 |
|---------|---------------------|
| 可点击按钮、带文字的矩形 | `Button` |
| 纯文本显示 | `Label` |
| 图标、头像、装饰图 | `Image` |
| 进度条、血条、经验条 | `ProgressBar` |
| 滑动区域、列表 | `ScrollView` |
| 输入框 | `TextField` |
| 滑块控件 | `Slider` |
| 开关按钮 | `Toggle` |
| 容器、面板、卡片 | `VisualElement` |

### 3. 位置与尺寸估算
- 使用像素坐标（左上角为原点）
- 估算精度：±10px
- 对于对称/对齐的元素，保持数值一致

### 4. 样式提取
- `backgroundColor`: 使用 rgba 格式或 `transparent`
- `borderRadius`: 圆角半径（0 为直角）
- `color`: 文字颜色
- `fontSize`: 字体大小（默认 14）
- `opacity`: 透明度（0-1）

## 输出格式

生成如下嵌套 JSON 结构，容器应包含其子元素：

```json
[
  {
    "type": "VisualElement",
    "name": "parentContainer",
    "x": 100,
    "y": 100,
    "width": 400,
    "height": 300,
    "styles": { "backgroundColor": "rgba(30,30,30,0.5)" },
    "children": [
      {
        "type": "Button",
        "name": "confirmBtn",
        "x": 20,
        "y": 20,
        "width": 100,
        "height": 40,
        "text": "确定"
      }
    ]
  }
]
```

> [!IMPORTANT]
> 1. 子节点的 `x` 和 `y` 坐标必须是**相对于画布的绝对坐标**（方便编辑器定位）。
> 2. 请务必根据视觉上的包含关系嵌套 JSON 节点。


## 命名规范

- 使用驼峰命名：`headerPanel`, `startButton`, `coinLabel`
- 按功能命名，不用位置命名
- 常见命名：
  - 面板：`xxxPanel`, `xxxContainer`
  - 按钮：`xxxButton`, `xxxBtn`
  - 图标：`xxxIcon`, `xxxImage`
  - 文本：`xxxLabel`, `xxxText`

## JSON 结构校验 (重要)

在输出 JSON 之前，请按以下标准进行自检，确保数据可被解析：

1. **结构合法性**：必须是标准的 JSON 数组格式，禁止出现末尾逗号（Trailing Commas）或注释。
2. **字段完整性**：每个元素必须包含 `type`, `name`, `x`, `y`, `width`, `height`。容器必须包含 `children` 数组（即使为空）。
3. **数值类型**：`x`, `y`, `width`, `height` 以及 `styles` 中的数值必须为 `Number`，禁止使用字符串（如 `"100px"`）。
4. **层级深度**：建议嵌套层级不超过 4 层，确保逻辑清晰。
5. **坐标一致性**：子节点的 `x`, `y` 必须始终基于**全局画布坐标**。
6. **样式对象**：所有 `styles` 属性必须包裹在 `styles` 对象内。


## 分析示例

对于一个典型的游戏主界面：

1. **顶部状态栏**
   - 玩家头像 → `Image` (playerAvatar)
   - 昵称文字 → `Label` (playerName)
   - 金币显示 → `Label` + `Image` (coinIcon, coinLabel)

2. **底部导航栏**
   - 各功能按钮 → `Button` (homeBtn, shopBtn, settingsBtn)

3. **中心内容区**
   - 背景容器 → `VisualElement` (mainContainer)
   - 功能卡片 → `VisualElement` + 内部元素

---

**使用方法**：发送参考图时输入 `/analyze-ui`，我将按此规则分析并生成 JSON 数据。
