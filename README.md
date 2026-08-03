# 稳声 Coach

稳声 Coach 是一个本地优先的个人声音训练 MVP：手机端负责训练推荐、记录、录音和隐私边界，AI 服务端负责 Qwen 复盘、训练稿生成和录音转写分析。

## 项目结构

```text
voice-coach/
  apps/
    mobile/       Expo React Native App
    ai-service/   Node.js + Express AI service
```

## 安装依赖

```bash
npm install
npm --workspace apps/mobile install
npm --workspace apps/ai-service install
```

## AI 服务端配置

复制 `apps/ai-service/.env.example` 为 `apps/ai-service/.env`，填入 DashScope API Key：

```env
AI_PROVIDER=dashscope
DASHSCOPE_API_KEY=your_dashscope_api_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_TEXT_MODELS=qwen3.7-max,qwen3.7-plus,qwen-plus
QWEN_TEXT_TIMEOUT_MS=30000
DASHSCOPE_TRANSCRIBE_MODEL=qwen3-asr-flash
PORT=8787
```

API Key 只放在服务端 `.env`，不会进入移动端。

## 启动

```bash
npm run dev:ai
npm run dev:mobile
```

真机测试时，把 App 设置页里的 AI 服务端地址改成本机局域网地址，例如：

```text
http://192.168.1.20:8787
```

## 功能验收

- 首页显示今日推荐和近期训练摘要。
- 可选择 3 / 5 / 10 / 20 分钟、当前状态和训练偏重。
- 本地推荐引擎根据安全规则、断训间隔、弱项和阶段生成训练包。
- 训练执行页包含步骤说明、倒计时和示范音频占位。
- 训练后可填写自评并保存到 SQLite。
- 进展页显示 7 天 / 30 天训练统计和薄弱项。
- 录音页支持录制、播放、删除和 AI 分析前确认。
- 设置页支持服务端地址、健康检查、删除本地数据、导出 JSON。
- AI 服务端提供健康检查、周复盘、训练稿生成、转写、录音分析、教练解释。

## 隐私注意事项

- 训练记录默认保存在本机。
- 录音默认保存在本机。
- 只有点击 AI 分析或 AI 复盘时，才上传指定内容到自己的 AI 服务端。
- API Key 不保存在手机端。
- 可以随时删除本地训练记录、录音和 AI 报告。

## 后续 TODO

- 高级音频声学指标。
- 音高走势和实时反馈。
- 共鸣位置自动判断。
- 云同步、多设备同步。
- Apple Watch 提醒和日历联动。
- 更复杂的阶段自动晋级。

## 许可证

本项目以 [MIT License](LICENSE) 开源。仓库中另有许可证声明的第三方组件，继续适用其各自条款。
