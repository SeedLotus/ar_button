<<<<<<< HEAD
# Object Drum Studio

**中文** | [English](./README.en.md)

Object Drum Studio 是一个浏览器里的日常物件鼓机：把桌面上的彩色物件、贴纸、玩具、文具或纸上色块识别成可演奏区域，再用手指触碰或敲击触发 Kick / Snare / Clap / Tom / Pad / Hi-hat 等音色。

在线体验：<https://electro-dig.github.io/object-drum-studio-public/>

## 这个公开版包含什么

- 摄像头实时输入与画面预览
- MediaPipe 手部追踪
- Touch / Tap 两种触发模式，默认 Touch
- 物件/色块区域识别与稳定追踪
- Objects 面板里的 H / S / V 颜色规则、画面取色、RGB/Hex 色板
- Tone.js 内置鼓组和 Pad 音色
- 本地 sample 文件夹导入与单个音色分配
- 纯浏览器运行，不需要账号、后端或云服务器

## 隐私说明

这个公开版是 local-first：

- 摄像头画面只在浏览器里处理。
- 上传的 sample 只保留在当前浏览器会话里。
- 不包含私有云端音色服务。
- 不包含实验性的远程音色生成模块。
- 不需要任何账号、密钥或私有服务器配置。

## 本地运行

```powershell
git clone https://github.com/Electro-Dig/object-drum-studio-public.git
cd object-drum-studio-public
npm.cmd test
npm.cmd start
```

然后打开 `http://localhost:5178`。

这个项目没有构建步骤；GitHub Pages 会直接从仓库根目录托管静态文件。

## 基本使用流程

1. 打开页面后先看“指南”面板，了解推荐顺序。
2. 点击 `启动` 并允许摄像头权限。
3. 在“设置”里选择摄像头，必要时打开镜像，并框选演奏区域。
4. 在“物件”里为 Kick / Snare / Clap 等音色取色，或者打开色板手动选色。
5. 在 `Gesture` 里调 Dwell、噪声门、冷却时间等参数，减少误触发。
6. 在 `Sound` 里试听内置音色，或导入本地 sample 文件夹。

## 目录结构

```
object-drum-studio-public/
├── index.html              # 主页面
├── main.cjs                # Electron 入口
├── styles.css              # 样式
├── src/                    # 源码
│   ├── app.js              # 应用入口
│   ├── audio/              # 音频与鼓组配置
│   ├── detection/          # 颜色分割、手部稳定、敲击检测
│   └── ui/                 # UI 控件
├── tests/                  # 单元测试
├── scripts/                # 本地工具脚本
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
- 浏览器 `localStorage` 保存本地颜色与音色设置

## 开发说明

内部研究版曾探索远程音色生成。这个公开仓库删除了那部分私有/实验层，只保留更安全、更容易体验和 fork 的浏览器版本。
=======
# ar_button
由object-drum-studio-public迭代而来的虚拟按键
>>>>>>> 67600a0a0e5a9f51bf3ca884720180174223ec2a
