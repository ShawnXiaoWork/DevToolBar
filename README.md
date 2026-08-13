# PlayPulse

面向游戏开发者的 Google Play 市场雷达。通过实时免费榜、畅销榜、付费榜与近期新游信号，快速识别榜单上升、突然爆发及值得拆解的产品方向。

首页指标和机会结论均可继续展开：查看对应游戏清单、跨榜表现、上榜依据、公开商店信息，并可跳转 Google Play 或加入本机关注列表。

## 本地运行

```bash
npm install
npm run dev
```

生产构建与运行：

```bash
npm run build
npm start
```

数据来自 `google-play-scraper` 获取的 Google Play 公开信息。趋势基于浏览器本机保存的同市场、同品类历史快照；首次访问会建立基线。畅销榜是相对排名信号，不代表精确收入估算。
