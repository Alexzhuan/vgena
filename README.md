# VGenA - Video Generation Annotation Platform

视频生成质量标注与分析平台，集标注、质量审核（QA）、模型排名与一致性分析于一体。纯前端架构，零后端依赖。

## 功能概览

### 标注平台（Annotation）

- **双模式支持**: 对比式标注（Pair-wise，两视频对比）和打分式标注（Score-wise，单视频 1-5 分评分）
- **五维度评估**: 文本一致性、时序一致性、视觉质量、畸变、运动质量
- **智能问题模板**: 每个维度预设主要问题/次要问题模板，一键快速填写
- **动态检查清单**: 按维度分组的 Checklist，辅助定位问题
- **矛盾检测**: 实时检查对比结果与问题等级的逻辑一致性（Pair 模式）
- **评分约束**: 根据问题等级自动限制可选分数范围（Score 模式）
- **视频同步**: Pair 模式下 A/B 视频联动播放，支持首帧预览、GT 视频展示
- **进度追踪**: 可视化进度面板，区分已完成 / 存疑 / 待标注 / 未保存状态
- **存疑标记**: 对不确定样本标记为存疑（Doubtful），导出时单独追踪
- **自动保存**: LocalStorage 持久化，支持草稿保存与断点续标
- **返工模式**: 可重新导入已导出结果，继续修改

### 分析看板（Analysis Dashboard）

- **数据总览**: 统计对比标注数 / 打分标注数 / 模型数 / 一致性率
- **结果浏览器**: 按标注员筛选、搜索、查看所有标注结果详情
- **模型排名**: 基于 Bradley-Terry 模型的 ELO 评分，展示胜/负/平统计与各维度均分
- **一致性分析**: 对比 Pair 与 Score 标注结果的一致性（Hard Match / Soft Match），定位不一致样本
- **质量审核（QA）**: 上传 Golden Set 标准答案，与标注员结果自动比对，支持按维度、按标注员筛选，详情弹窗展示差异，结果导出为 Excel

### 通用特性

- **键盘快捷键**: 全面的快捷键支持，大幅提升操作效率
- **纯前端架构**: 无需后端服务，所有数据在浏览器本地处理
- **GitHub Pages 部署**: GitHub Actions 自动构建部署

## 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 标注首页 | 加载任务包后进入对比/打分标注 |
| `/analysis` | 分析总览 | 数据统计概览 |
| `/analysis/results` | 结果浏览 | 查看所有标注结果 |
| `/analysis/models` | 模型排名 | ELO 评分与胜率排行 |
| `/analysis/consistency` | 一致性分析 | Pair vs Score 一致性检查 |
| `/analysis/qa` | 质量审核 | Golden Set 对比与标注员质检 |

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 打开平台。

### 构建生产版本

```bash
npm run build
```

## 使用说明

### 1. 标注流程

#### 加载任务包

点击"加载任务包"或拖拽 JSON 文件到上传区域。

**任务包格式（对比模式）：**

```json
{
  "task_id": "pair_20260129_01",
  "annotator_id": "annotator_01",
  "mode": "pair",
  "samples": [
    {
      "sample_id": "sample_001",
      "prompt": "视频描述文本...",
      "first_frame_url": "https://...",
      "video_a_url": "https://...",
      "video_b_url": "https://..."
    }
  ]
}
```

**任务包格式（打分模式）：**

```json
{
  "task_id": "score_20260129_01",
  "annotator_id": "annotator_01",
  "mode": "score",
  "samples": [
    {
      "sample_id": "sample_001",
      "prompt": "视频描述文本...",
      "first_frame_url": "https://...",
      "video_url": "https://..."
    }
  ]
}
```

#### 进行标注

- 使用 `Tab` / `Shift+Tab` 在五个维度间切换
- 参考右侧检查清单定位问题
- 使用问题模板快速填写描述
- 选择对比结果或评分，点击"保存并下一个"

#### 导出结果

点击右上角"导出结果"按钮，下载 JSON 格式标注结果。导出包含已完成结果、存疑样本列表及未完成草稿。

#### 返工

将已导出的 JSON 结果重新拖入任务加载器，即可恢复所有标注状态继续修改。

### 2. 分析看板

在 `/analysis` 页面上传一个或多个标注结果 JSON 文件，平台将自动合并数据并展示：

- **总览**: 标注数据统计
- **结果浏览**: 逐条查看标注详情
- **模型排名**: ELO 评分排行（基于 Pair 对比数据）、各维度均分（基于 Score 数据）
- **一致性分析**: 匹配相同 sample_id 的 Pair 与 Score 结果，计算 Hard/Soft Match 率

### 3. 质量审核（QA）

在 `/analysis/qa` 页面：

1. 上传 Golden Set（标准答案 JSON）
2. 上传一个或多个标注员结果 JSON
3. 平台自动计算匹配率，支持：
   - **Hard Match**: 所有维度完全一致
   - **Soft Match**: 按维度 / 按问题等级匹配
   - 按维度、按标注员筛选
   - 查看不一致样本详情（含视频回放）
   - 导出 QA 报告为 Excel

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Tab` | 切换到下一个评估维度 |
| `Shift + Tab` | 切换到上一个评估维度 |
| `Ctrl/⌘ + S` | 保存并下一个 |
| `Ctrl/⌘ + Enter` | 保存并下一个 |
| `Ctrl/⌘ + ←` | 上一个样本 |
| `Ctrl/⌘ + →` | 下一个样本 |
| `Space` | 播放/暂停视频 |
| `←` / `→` | 快退/快进 5 秒 |
| `1-5` | 快速评分（打分模式） |

## 技术栈

- **框架**: React 18 + TypeScript
- **构建**: Vite 6
- **状态管理**: Zustand
- **样式**: Tailwind CSS
- **路由**: React Router DOM v6
- **图表**: Recharts
- **视频播放**: React Player
- **文件导出**: FileSaver + XLSX
- **部署**: GitHub Pages + GitHub Actions

## 项目结构

```
src/
├── components/          # UI 组件
│   ├── common/          # 通用组件（Header, VideoPlayer, ImageModal 等）
│   ├── TaskLoader/      # 任务加载器
│   ├── PairAnnotation/  # 对比标注页面
│   ├── ScoreAnnotation/ # 打分标注页面
│   └── analysis/        # 分析看板组件
├── pages/
│   └── analysis/        # 分析页面（Dashboard, Results, Models, Consistency, QA）
├── stores/              # Zustand 状态管理（annotationStore, analysisStore, qaStore）
├── types/               # TypeScript 类型定义
├── utils/               # 工具函数（ELO 计算, 统计, 一致性分析, QA 比对, 导出等）
├── App.tsx              # 路由配置
└── main.tsx             # 入口文件
```

## License

MIT
