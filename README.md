# 小六壬 + 大模型建议

这是一个小六壬互动占断应用：输入所问之事与农历时间，页面会演示点数并给出六宫结果；结果会传给大模型生成简明建议。前端为单页页面，后端使用 Node 调用模型接口。

## 本地运行

```bash
cd /项目地址
export BIGMODEL_API_KEY="你的智谱key"
node server.js
```

浏览器打开：`http://localhost:3000`

页面支持填写 `API Key` 和模型名，留空则使用服务器环境变量。注意：在前端填写会暴露给浏览器用户。

## Vercel 部署

- 将仓库推到 GitHub/GitLab/Bitbucket
- 在 Vercel 新建项目并选择该仓库（Framework 选 Other）
- 配置环境变量（至少需要 `BIGMODEL_API_KEY`）
- 部署完成后访问 Vercel 提供的域名

说明：Vercel 会将 `index.html` 作为静态页面，`api/advice.js` 作为 Serverless API。

## 环境变量

- `BIGMODEL_API_KEY`/`ZHIPU_API_KEY`：智谱 API Key
- `BIGMODEL_API_URL`：接口地址（默认 `https://open.bigmodel.cn/api/paas/v4/chat/completions`）
- `BIGMODEL_MODEL`：模型名（默认见服务端配置）
- `BIGMODEL_MAX_TOKENS`：最大输出长度（默认 `4096`）
- `BIGMODEL_TEMPERATURE`：温度（默认 `0.7`）
- `BIGMODEL_THINKING`：是否开启思维链（如 `enabled`）
- `PORT`：本地服务端口（默认 `3000`）

## 常见问题

- `Upstream error 401`：API Key 无效或未带上 `Authorization: Bearer <key>`
- `Upstream error 429`：调用频率或额度受限，降低并发或调低 `BIGMODEL_MAX_TOKENS`
