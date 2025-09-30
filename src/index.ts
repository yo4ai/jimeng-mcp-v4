#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import crypto from "crypto";

// 火山引擎即梦AI API配置
const ENDPOINT = "https://visual.volcengineapi.com";
const HOST = "visual.volcengineapi.com";
const REGION = "cn-north-1";
const SERVICE = "cv";

// 环境变量配置
const JIMENG_ACCESS_KEY = process.env.JIMENG_ACCESS_KEY;
const JIMENG_SECRET_KEY = process.env.JIMENG_SECRET_KEY;

if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
  console.error("警告：未设置环境变量 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY");
  console.error("服务将启动但无法调用API功能，仅供测试使用");
}


// 辅助函数：生成签名密钥
function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto.createHmac('sha256', key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('request').digest();
  return kSigning;
}

// 格式化查询参数
function formatQuery(parameters: Record<string, string>): string {
  const sortedKeys = Object.keys(parameters).sort();
  return sortedKeys.map(key => `${key}=${parameters[key]}`).join('&');
}

// 火山引擎V4签名算法
function signV4Request(
  accessKey: string,
  secretKey: string,
  service: string,
  reqQuery: string,
  reqBody: string
): { headers: Record<string, string>; requestUrl: string } {
  const t = new Date();
  const currentDate = t.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const datestamp = currentDate.substring(0, 8);

  const method = 'POST';
  const canonicalUri = '/';
  const canonicalQuerystring = reqQuery;
  const signedHeaders = 'content-type;host;x-content-sha256;x-date';
  const payloadHash = crypto.createHash('sha256').update(reqBody).digest('hex');
  const contentType = 'application/json';

  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${HOST}`,
    `x-content-sha256:${payloadHash}`,
    `x-date:${currentDate}`
  ].join('\n') + '\n';

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const algorithm = 'HMAC-SHA256';
  const credentialScope = `${datestamp}/${REGION}/${service}/request`;
  const stringToSign = [
    algorithm,
    currentDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  const signingKey = getSignatureKey(secretKey, datestamp, REGION, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorizationHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    'X-Date': currentDate,
    'Authorization': authorizationHeader,
    'X-Content-Sha256': payloadHash,
    'Content-Type': contentType
  };

  const requestUrl = `${ENDPOINT}?${canonicalQuerystring}`;

  return { headers, requestUrl };
}


// 调用即梦AI API
async function callJimengAPI(prompt: string): Promise<string | null> {
  // 查询参数
  const queryParams = {
    'Action': 'CVProcess',
    'Version': '2022-08-31'
  };
  const formattedQuery = formatQuery(queryParams);

  // 请求体参数
  const bodyParams = {
    req_key: "jimeng_t2i_v40",
    prompt: prompt,
    return_url: true,
    size: 4194304  // 使用默认2K分辨率，让API智能判断宽高比
  };
  const formattedBody = JSON.stringify(bodyParams);

  try {
    // 生成签名和请求头
    const { headers, requestUrl } = signV4Request(
      JIMENG_ACCESS_KEY!,
      JIMENG_SECRET_KEY!,
      SERVICE,
      formattedQuery,
      formattedBody
    );

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: headers,
      body: formattedBody
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();
    // 替换转义字符，与Python示例保持一致
    const cleanedResponse = responseText.replace(/\\u0026/g, "&");
    const result = JSON.parse(cleanedResponse);

    // 根据火山引擎即梦AI API响应格式解析结果
    if (result.ResponseMetadata && result.ResponseMetadata.Error) {
      throw new Error(`API error: ${result.ResponseMetadata.Error.Message || 'Unknown error'}`);
    }

    // 返回生成的图片URL - 根据搜索结果，即梦AI返回的是data.image_urls数组
    if (result.data && result.data.image_urls && result.data.image_urls.length > 0) {
      return result.data.image_urls[0];
    }

    return null;
  } catch (error) {
    console.error("调用即梦AI API时出错:", error);
    return null;
  }
}

// 创建MCP服务器实例
const server = new McpServer({
  name: "jimeng-mcp-v4",
  version: "1.0.0",
});

// 注册图片生成工具
server.tool(
  "generate-image",
  "当用户需要生成图片时使用的工具",
  {
    prompt: z.string().describe("用于生成图像的提示词，中英文均可，最长不超过800字符。可以在prompt中描述图片内容、风格、尺寸比例等。API会智能判断生成2K分辨率图像。")
  },
  async (args) => {
    const { prompt } = args as { prompt: string };
    // 检查API密钥是否配置
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      return {
        content: [
          {
            type: "text",
            text: "错误：未设置环境变量 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY，无法调用API。"
          }
        ]
      };
    }

    const imageUrl = await callJimengAPI(prompt);

    if (!imageUrl) {
      return {
        content: [
          {
            type: "text",
            text: "生成图片失败，请检查网络连接和API密钥配置。"
          }
        ]
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `图片生成成功！\n\n生成提示词: ${prompt}\n图片URL: ${imageUrl}`
        }
      ]
    };
  }
);

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("即梦AI图片生成MCP服务已启动");
}

main().catch((error) => {
  console.error("启动服务时发生错误:", error);
  process.exit(1);
}); 