# 即梦 AI 图片生成 MCP 服务 V4.0

基于火山引擎即梦 AI 的图片生成 MCP（Model Context Protocol）服务。最新即梦生图 mcp servers, 支持最新的即梦 Seedream4.0 模型:jimeng_t2i_v40

## 功能特性

- 使用火山引擎即梦 AI API 生成高质量图片
- 支持多种图片比例：4:3、3:4、16:9、9:16
- 标准化的 MCP 接口，兼容各种 MCP 客户端
- 环境变量配置，安全便捷

## 安装依赖

```bash
cd jimeng-mcp-v4
npm install
```

## 编译项目

```bash
npm run build
```

## 环境变量配置

设置以下环境变量：

```bash
export JIMENG_ACCESS_KEY="你的火山引擎AccessKey"
export JIMENG_SECRET_KEY="你的火山引擎SecretKey"
```

### 获取 API 密钥

1. 访问 [火山引擎控制台](https://console.volcengine.com/)
2. 登录后进入"即梦 AI"产品页面，开通服务（可选择免费试用）
3. 在"访问控制"页面创建访问密钥，获取 Access Key 和 Secret Key
4. 确保账号已开通即梦 AI 图像生成相关权限和策略

**注意：** 根据官方文档，请确保使用正确的 req_key 参数值 `jimeng_high_aes_general_v21_L`

## 使用方法

### 直接运行

```bash
node build/index.js
```

### 作为 MCP 服务器

在 MCP 客户端（如 Claude Desktop、Cursor 等）中配置此服务：

```json
{
  "mcpServers": {
    "jimeng-mcp-v4": {
      "command": "node",
      "args": ["/path/to/jimeng-mcp-v4/build/index.js"],
      "env": {
        "JIMENG_ACCESS_KEY": "你的AccessKey",
        "JIMENG_SECRET_KEY": "你的SecretKey"
      }
    }
  }
}
```

## API 接口

### generate-image

当用户需要生成图片时使用的工具。

**参数：**

- `text` (string): 用户需要在图片上显示的文字
- `illustration` (string): 根据用户要显示的文字，提取 3-5 个可以作为图片配饰的插画元素关键词
- `color` (string): 图片的背景主色调
- `ratio` (enum): 图片比例，支持以下选项：
  - `"4:3"`: 512×384
  - `"3:4"`: 384×512
  - `"16:9"`: 512×288
  - `"9:16"`: 288×512

**提示词生成规则：**
工具会自动将输入参数组合成以下格式的提示词：

```
字体设计："{text}"，黑色字体，斜体，带阴影。干净的背景，白色到{color}渐变。点缀浅灰色、半透明{illustration}等元素插图做配饰插画。
```

**返回：**

- 成功时返回图片 URL 和详细信息
- 失败时返回错误信息

## 使用示例

```typescript
// 在MCP客户端中调用
const result = await mcp.callTool('generate-image', {
  text: '新年快乐',
  illustration: '烟花, 灯笼, 祥云, 星星, 礼花',
  color: '红色',
  ratio: '4:3',
});
```

## 项目结构

```
jimeng-mcp-v4/
├── src/
│   └── index.ts          # 主服务文件
├── build/                # 编译输出目录
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript配置
└── README.md            # 项目说明
```

## 注意事项

1. 确保网络连接正常，能够访问火山引擎 API
2. API 调用需要消耗积分，请注意使用量
3. 生成的图片 URL 有时效性，建议及时下载保存
4. 请遵守火山引擎的使用条款和即梦 AI 的内容政策

## 故障排除

### 常见错误

1. **环境变量未设置**：确保设置了正确的 ACCESS_KEY 和 SECRET_KEY
2. **网络连接问题**：检查网络连接和防火墙设置
3. **API 配额不足**：检查火山引擎账户余额和 API 调用次数
4. **提示词不合规**：确保提示词符合内容安全规范

### 调试方法

运行时添加调试信息：

```bash
DEBUG=* node build/index.js
```

## 许可证

ISC License
