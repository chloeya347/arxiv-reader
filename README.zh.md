# Paper Agent

[English](README.md)

一个 Chrome 扩展，通过提取 LaTeX 源码并调用大模型，自动为 arXiv 论文生成摘要。

## 功能特性

- 自动识别 arXiv 论文页面（PDF 或摘要页）
- 使用 `arxiv-to-prompt` 提取完整 LaTeX 源码
- 流式输出大模型摘要
- 支持多个模型提供商：Anthropic、OpenAI、通义千问、Kimi、DeepSeek
- 本地缓存论文和摘要
- 支持 Markdown 和 LaTeX 数学公式渲染

---

## 快速上手（约 5 分钟）

### 前置要求

- **[conda](https://docs.conda.io/en/latest/miniconda.html)** — 用于 Python 环境管理
- **Chrome**（或任意基于 Chromium 的浏览器 — Arc、Brave、Edge 等均可）
- **至少一个支持的大模型提供商的 API Key**：
  - [Anthropic](https://console.anthropic.com/)（Claude）
  - [OpenAI](https://platform.openai.com/api-keys)（GPT-4o）
  - [阿里云百炼 / DashScope](https://dashscope.aliyun.com/)（通义千问）
  - [Moonshot AI](https://platform.moonshot.cn/)（Kimi）
  - [DeepSeek](https://platform.deepseek.com/)（DeepSeek）

---

### 第一步 — 克隆仓库

```bash
git clone <repo-url>
cd paperagent
```

---

### 第二步 — 运行安装脚本

```bash
./setup.sh
```

该交互式脚本将依次完成：

1. 从 `environment.yml` 创建名为 `paperagent` 的 conda 环境
2. 询问你要使用哪些大模型提供商，并提示输入对应 API Key
3. 设置摘要的输出语言（默认：中文）
4. 将所有配置写入 `.env` 文件

可以配置多个提供商——第一个配置的将作为默认提供商。如需切换，编辑 `.env` 文件，修改 `LLM_PROVIDER=` 的值即可。

---

### 第三步 — 启动后端服务

```bash
./start.sh
```

启动成功后，你应看到：

```
* Running on http://127.0.0.1:5000
```

使用扩展期间请保持此终端窗口开启。后端负责论文下载、大模型调用和本地缓存。

---

### 第四步 — 在 Chrome 中加载扩展（仅需一次）

1. 打开 Chrome，在地址栏输入并访问 **`chrome://extensions/`**
2. 开启右上角的**开发者模式**开关
3. 点击**加载已解压的扩展程序**
4. 在文件选择器中，选择 **`paperagent` 文件夹**（即本仓库根目录）
5. 扩展列表中将出现 **Paper Agent** 及其图标

> **小提示：** 固定扩展以便快速访问 —— 点击 Chrome 工具栏的拼图图标，找到 Paper Agent，点击固定图标即可。

---

### 第五步 — 开始使用

1. 打开任意一篇 arXiv 论文，例如：
   - 摘要页：`https://arxiv.org/abs/2303.08774`
   - PDF 页：`https://arxiv.org/pdf/2303.08774`
2. 点击 Chrome 工具栏中的 **Paper Agent 图标**，打开侧边栏
3. 点击 **Summarize Paper**
4. 摘要将以流式方式呈现，支持 Markdown 和 LaTeX 数学公式

---

### 更新扩展

拉取新代码后，需要在 Chrome 中重新加载扩展以使更改生效：

1. 前往 `chrome://extensions/`
2. 找到 Paper Agent，点击**刷新图标**（↺）

除非 `environment.yml` 有变动，否则无需重新运行 `setup.sh`。

---

## 架构

```
Chrome 扩展 (sidepanel.js)
        │
        │  HTTP 请求至 localhost:5000
        ▼
Flask 后端 (server.py)
        │
        ├── arxiv-to-prompt  →  下载并处理 LaTeX 源码
        └── 大模型 API       →  流式生成论文摘要
```

## 常见问题

### 提示"Python server not running"

- 确认已运行 `./start.sh` 且终端窗口仍处于开启状态
- 检查终端是否显示 "Running on http://127.0.0.1:5000"

### 扩展未识别 arXiv 论文

- 确认当前页面 URL 为 `arxiv.org/pdf/{id}` 或 `arxiv.org/abs/{id}`
- 打开浏览器控制台检查报错（F12 → Console）

### 直接测试后端接口

```bash
curl -X POST http://localhost:5000/process-arxiv \
  -H "Content-Type: application/json" \
  -d '{"arxiv_id": "2303.08774"}'
```
