# DirectorDeck-OSS 🎬

![Status](https://img.shields.io/badge/Status-Open--Source-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

## 📺 项目演示
<p align="center">
  <video src="./assets/demo.mp4" width="100%" controls autoplay loop muted></video>
</p>

**DirectorDeck-OSS** 是一款专为导演、分镜师和视觉创作者打造的专业级电影视觉化工具。它利用先进的 AI 模型，将文字构思快速转化为高质量的电影分镜。

这款工具的核心在于打破技术障碍，让创作回归故事本身。它不仅是一个绘图工具，更是一个智能的视觉助手。

---

## ✨ 核心特性

- **🎬 电影级分镜生成**: 深度集成 Gemini 3 等前沿模型，一键生成极具电影感的视觉帧。
- **🖼️ 资产库系统**: 强大的角色柜 (Character Bay) 和 场景库 (Location Library)，支持上传参考图并自动分析，确保视觉连续性。
- **🎨 智能画布 (Creative Canvas)**: 非线性的无限画布工作流，支持剪切、复制、粘贴以及多视图（Multi-view）网格生成。
- **🎥 动态转换**: 支持将静态分镜一键转化为动态视频 (Image-to-Video)，探索镜头运动与节奏。
- **📂 项目管理**: 完善的项目与分区管理系统，支持多项目切换与持久化存储。
- **🌐 多供应商支持**: 兼容 Google Gemini, OpenAI-style Proxies, 以及 Antigravity 代理。

---

## 🛠️ 快速上手

### 环境要求

- **Node.js** (推荐 v18 或更高版本)
- **npm** 或 **yarn**

### 安装步骤

1. **克隆仓库**:
   ```bash
   git clone https://github.com/yww520/DirectorDeck-OSS.git
   cd DirectorDeck-OSS
   ```

2. **安装依赖**:
   ```bash
   npm install
   ```

3. **配置环境变量**:
   - 将 `.env.example` 重命名为 `.env`:
     ```bash
     cp .env.example .env
     ```
   - 在 `.env` 中填入你的 Gemini API Key 或代理配置。

4. **启动开发服务器**:
   ```bash
   npm run dev
   ```

5. **访问应用**:
   在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

---

## 🏗️ 架构概览

- **Frontend**: React (TSX) + TailwindCSS
- **State Management**: Zustand
- **Icons**: Lucide-React
- **Image Processing**: Canvas API + Base64 Optimization
- **Backend-less**: 纯前端驱动，数据持久化于 IndexedDB。

---

## 🎁 如何贡献

我们非常欢迎社区的贡献！无论是提交 Bug 反馈、功能建议，还是直接贡献代码，你的参与都将让 DirectorDeck-OSS 变得更好。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交记录 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 开源协议

本项目采用 **MIT License** 协议开源 - 详情请参阅 [LICENSE](LICENSE) 文件。

---

## 🌟 鸣谢

本项目基于开源项目 [Vibe-Agent](https://github.com/yuyou-dev/Vibe-Agent) 进行二次开发，感谢原作者提供的灵感与基础架构。

同时也感谢所有开发者对开源社区的贡献，特别鸣谢 Google DeepMind 提供的强大模型支持。

---
<p align="center">Made with ❤️ for the Creative Community</p>
