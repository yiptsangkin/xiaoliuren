const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_URL =
  process.env.BIGMODEL_API_URL ||
  process.env.ZHIPU_API_URL ||
  "https://open.bigmodel.cn/api/paas/v4/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function formatBearerToken(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (/^Bearer\s+/i.test(trimmed)) return trimmed;
  if (/^Bearer/i.test(trimmed)) {
    return `Bearer ${trimmed.slice(6).trim()}`;
  }
  return `Bearer ${trimmed}`;
}

function buildMessages(payload) {
  const question = payload.question || "";
  const palace = payload.palace || "";
  const lunarMonth = payload.lunarMonth || "";
  const lunarDay = payload.lunarDay || "";
  const shichen = payload.shichen || "";

  const system = [
    "You are a helpful assistant for XiaoliuRen readings.",
    "Respond in Simplified Chinese.",
    "Keep it concise and practical; avoid extreme claims.",
    "Use the result palace as the primary signal and tie it to the question.",
    "If the question is missing or vague, ask for clarification briefly."
  ].join(" ");

  const user = [
    `Question: ${question || "(empty)"}`,
    `Result palace: ${palace}`,
    `Lunar month/day: ${lunarMonth}/${lunarDay}`,
    `Shichen index: ${shichen} (1=Zi ... 12=Hai)`,
    "Reference meanings (optional):",
    "Da An=stability; Liu Lian=delay; Su Xi=good news; Chi Kou=dispute;",
    "Xiao Ji=small fortune; Kong Wang=uncertainty/empty.",
    "Provide a short reading and 2-4 actionable suggestions."
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

function callBigModel(messages, options = {}) {
  const apiKey = formatBearerToken(
    options.apiKey ||
      process.env.BIGMODEL_API_KEY ||
      process.env.ZHIPU_API_KEY ||
      process.env.API_KEY ||
      ""
  );
  if (!apiKey) {
    return Promise.reject(new Error("Missing BIGMODEL_API_KEY"));
  }

  const model =
    options.model ||
    process.env.BIGMODEL_MODEL ||
    process.env.ZHIPU_MODEL ||
    "glm-4.7";
  const maxTokens = parseInt(
    process.env.BIGMODEL_MAX_TOKENS || "4096",
    10
  );
  const temperature = parseFloat(
    process.env.BIGMODEL_TEMPERATURE || "0.7"
  );
  const thinkingType = process.env.BIGMODEL_THINKING || "";

  const body = {
    model,
    messages,
    max_tokens: Number.isFinite(maxTokens) ? maxTokens : 4096,
    temperature: Number.isFinite(temperature) ? temperature : 0.7
  };
  if (thinkingType) {
    body.thinking = { type: thinkingType };
  }

  const payload = JSON.stringify(body);
  const url = new URL(API_URL);
  const isHttps = url.protocol === "https:";
  const client = isHttps ? https : http;
  const headers = {
    "Content-Type": "application/json",
    Authorization: apiKey
  };

  const options = {
    method: "POST",
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    headers
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode || 0, data })
      );
    });
    req.on("error", reject);
    req.setTimeout(60000, () =>
      req.destroy(new Error("Upstream timeout"))
    );
    req.write(payload);
    req.end();
  });
}

function extractContent(bodyText) {
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch (err) {
    throw new Error("Invalid JSON from upstream");
  }

  const content =
    json &&
    json.choices &&
    json.choices[0] &&
    json.choices[0].message &&
    json.choices[0].message.content;

  if (!content) {
    throw new Error("No content in upstream response");
  }

  return content;
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const raw = await readBody(req);
    let payload;
    try {
      payload = JSON.parse(raw || "{}");
    } catch (err) {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    const {
      question,
      palace,
      lunarMonth,
      lunarDay,
      shichen,
      apiKey,
      model
    } = payload;
    if (!question || !palace) {
      sendJson(res, 400, { error: "question and palace are required" });
      return;
    }

    const messages = buildMessages({
      question,
      palace,
      lunarMonth,
      lunarDay,
      shichen
    });

    const upstream = await callBigModel(messages, { apiKey, model });
    if (upstream.status < 200 || upstream.status >= 300) {
      sendJson(res, 502, {
        error: `Upstream error ${upstream.status}`,
        detail: upstream.data
      });
      return;
    }

    let advice;
    try {
      advice = extractContent(upstream.data);
    } catch (err) {
      sendJson(res, 502, { error: err.message });
      return;
    }

    sendJson(res, 200, { advice });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Server error" });
  }
};
