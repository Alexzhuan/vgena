# VGenA - Video Generation Annotation Platform

视频生成质量标注平台，支持对比式（Pair-wise）和打分式（Score-wise）两种标注模式。

## 功能特点

- **双模式支持**: 对比式标注（两视频对比）和打分式标注（单视频评分）
- **五维度评估**: 文本一致性、时序一致性、视觉质量、畸变、运动质量
- **智能问题模板**: 预设的主要问题/次要问题模板，一键快速填写
- **键盘快捷键**: 全面的快捷键支持，大幅提升标注效率
- **自动保存**: LocalStorage 持久化存储，防止数据丢失

## 在线使用

访问 GitHub Pages 部署版本：

```
https://YOUR_USERNAME.github.io/vgena/
```

## 本地开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 打开标注平台。

### 构建生产版本

```bash
npm run build
```

## 使用说明

### 1. 加载任务包

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

### 2. 进行标注

- 使用 `Tab` 键在五个维度间切换
- 参考右侧检查清单定位问题
- 使用问题模板快速填写描述
- 选择对比结果或评分

### 3. 导出结果

点击右上角"导出结果"按钮，下载 JSON 格式标注结果。

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Tab` | 切换到下一个评估维度 |
| `Shift + Tab` | 切换到上一个评估维度 |
| `Ctrl/⌘ + S` | 保存并下一个 |
| `Space` | 播放/暂停视频 |
| `←` / `→` | 快退/快进 5 秒 |
| `1-5` | 快速评分（打分模式） |

## 技术栈

- React 18 + TypeScript
- Vite 6
- Zustand（状态管理）
- Tailwind CSS

## License

MIT
