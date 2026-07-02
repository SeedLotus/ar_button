# Object Drum Studio

**中文** | [English](./README.en.md)

> 本项目基于 [object-drum-studio-public](https://github.com/Electro-Dig/object-drum-studio-public) 迭代而来。原项目是一个开源的浏览器演示，可将桌面上的日常物件识别为可演奏的鼓区。

Object Drum Studio 是一个浏览器里的日常物件鼓机：把桌面上的彩色物件、贴纸、玩具、文具或纸上色块识别成可演奏区域，再用手指触碰或敲击触发 Kick / Snare / Clap / Tom / Pad / Hi-hat 等音色。它也支持不依赖实体物件的「虚拟打击垫」模式，在摄像头画面里直接摆放可演奏的虚拟垫。

在线体验：<https://electro-dig.github.io/object-drum-studio-public/>

## 这个公开版包含什么

- 摄像头实时输入与画面预览，支持多设备选择、镜像、热插拔自动刷新
- MediaPipe 手部追踪，绘制手部骨架与指尖触发圈
- 两种检测模式：
  - **实物物件**：基于 HSV 颜色分割识别真实物件/色块
  - **虚拟打击垫**：在画面中手动放置虚拟垫，不依赖实体颜色
- ROI 演奏区域框选，减少背景误识别
- 演奏模式锁定已确认区域，降低边界抖动
- 物件音色规则：H / S / V 颜色阈值、画面取色、RGB/Hex 色板、常用颜色预设
- 虚拟打击垫：自动/手动桌面区域检测，拖拽放置，按住移动，右键删除
- Touch / Tap 两种触发模式，默认 Touch
- Gesture Gate：敲击阈值、噪声门、平滑、Dwell、Release、Z 权重、冷却时间
- Tone.js 内置鼓组（Kick / Snare / Hi-hat / Clap / Tom）与 Pad 和弦音色
- 本地 sample 文件夹导入与单个音色分配，支持试听、音高/音量/Decay 调节
- 开发日志面板：DEBUG / INFO / WARN / ERROR 四级过滤、导出 JSON、触发事件回放
- 纯浏览器运行，不需要账号、后端或云服务器
- 同时提供 Electron 桌面封装，双击即可本地运行

## 隐私说明

这个公开版是 local-first：

- 摄像头画面只在浏览器里处理。
- 上传的 sample 只保留在当前浏览器会话里。
- 设置与虚拟打击垫位置保存在浏览器 `localStorage`，不会上传。
- 不包含私有云端音色服务。
- 不包含实验性的远程音色生成模块。
- 不需要任何账号、密钥或私有服务器配置。

## 本地运行

### 浏览器方式

```powershell
git clone https://github.com/SeedLotus/ar_button.git
cd ar_button
npm.cmd test
npm.cmd run dev
```

然后打开 `http://localhost:5178`。

### Electron 桌面方式

```powershell
npm.cmd start
```

项目本身没有构建步骤；GitHub Pages 会直接从仓库根目录托管静态文件。Electron 入口 `main.cjs` 会启动一个本地 HTTP 服务器并打开窗口。

## 基本使用流程

1. 打开页面后先看「指南」面板，了解推荐顺序。
2. 点击 `启动` 并允许摄像头权限。
3. 在「设置」里选择摄像头，必要时打开镜像，并框选演奏区域。
4. 选择检测模式：
   - **实物物件**：在「物件」里为 Kick / Snare / Clap 等音色取色，或者打开色板手动选色。
   - **虚拟打击垫**：在「Virtual」里检测/框选桌面区域，然后从面板拖拽打击垫到画面放置。
5. 在 `Gesture` 里调 Dwell、噪声门、冷却时间等参数，减少误触发。
6. 在 `Sound` 里试听内置音色，或导入本地 sample 文件夹。

## 目录结构

```
object-drum-studio-public/
├── index.html              # 主页面
├── main.cjs                # Electron 入口（本地 HTTP 服务器 + 窗口）
├── styles.css              # 样式
├── src/                    # 源码
│   ├── app.js              # 应用入口与主循环
│   ├── audio/              # 音频引擎、鼓组配置、Sample Library、Pad 和弦
│   ├── detection/          # 颜色分割、手部稳定、敲击检测、虚拟打击垫、桌面检测
│   ├── ui/                 # UI 控件（颜色面板、虚拟打击垫面板、桌面编辑器）
│   └── utils/              # 日志、工具函数
├── tests/                  # 单元测试
├── scripts/                # 本地工具脚本（setup、no-cache-server）
├── models/                 # MediaPipe 模型文件
├── vendor/                 # MediaPipe 打包脚本
└── wasm/                   # MediaPipe WASM 运行时
```

## 技术栈

- MediaPipe Tasks Vision HandLandmarker
- Tone.js
- Canvas 2D
- HSV 颜色分割
- 连通区域提取
- 跨帧区域平滑与丢失容忍
- 浏览器 `localStorage` 保存本地颜色、音色与虚拟打击垫设置
- Electron（可选桌面封装）

## 开发说明

内部研究版曾探索远程音色生成。这个公开仓库删除了那部分私有/实验层，只保留更安全、更容易体验和 fork 的浏览器版本。
