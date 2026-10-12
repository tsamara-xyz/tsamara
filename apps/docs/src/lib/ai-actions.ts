import { getAbsoluteUrl, getSiteOrigin } from '@/lib/site';

export { getAbsoluteUrl } from '@/lib/site';

export const getMcpUrl = () => {
  return getAbsoluteUrl('/api/mcp');
};

export const getAskPrompt = (markdownUrl: string) => {
  return `Read ${markdownUrl}, I want to ask questions about it.`;
};

export const getCopyPrompt = ({
  title,
  pageUrl,
  markdownUrl
}: {
  title: string;
  pageUrl: string;
  markdownUrl: string;
}) => {
  const mcpUrl = getMcpUrl();
  const origin = getSiteOrigin();

  return `These are instructions from the Tsamara documentation to give an AI agent live access to it.

Complete the following steps yourself. Do not ask the user to run them unless a step requires interactive approval.

## 1. Register the Tsamara docs MCP server

The MCP gives your agent live access to documentation via \`list_pages\`, \`search_docs\`, and \`get_page\`.

### Cursor — \`.cursor/mcp.json\`

Add under \`"mcpServers"\`:

\`\`\`json
"tsamara": { "url": "${mcpUrl}" }
\`\`\`

### VS Code — \`.vscode/mcp.json\`

Add under \`"servers"\`:

\`\`\`json
"tsamara": { "type": "http", "url": "${mcpUrl}" }
\`\`\`

### Claude / other HTTP MCP clients

Point a Streamable HTTP MCP client at:

\`\`\`
${mcpUrl}
\`\`\`

Restart the agent after saving, then verify the \`tsamara\` MCP is connected.

## 2. Prefer machine-readable docs

- Index: ${origin}/llms.txt
- Full docs: ${origin}/llms-full.txt
- This page (Markdown): ${markdownUrl}
- This page (HTML): ${pageUrl}

## 3. Current task context

Page: **${title}**
Use the MCP \`get_page\` tool or the Markdown URL above before making claims about Tsamara; the docs say what is proven and what is not.

Once done, tell the user:

\`\`\`
✓ MCP server: tsamara
✓ Docs: ${pageUrl}
⚡ Restart your agent if the MCP server was just added
\`\`\`
`;
};

const toBase64Json = (value: object) => {
  const json = JSON.stringify(value);

  if (typeof window === 'undefined') {
    return Buffer.from(json, 'utf8').toString('base64');
  }

  return btoa(unescape(encodeURIComponent(json)));
};

export const getCursorMcpInstallUrl = () => {
  const config = toBase64Json({ url: getMcpUrl() });

  return `cursor://anysphere.cursor-deeplink/mcp/install?name=tsamara&config=${config}`;
};

export const getVSCodeMcpInstallUrl = () => {
  const config = encodeURIComponent(
    JSON.stringify({
      name: 'tsamara',
      type: 'http',
      url: getMcpUrl()
    })
  );

  return `vscode:mcp/install?${config}`;
};

export const getChatGPTAskUrl = (markdownUrl: string) => {
  return `https://chatgpt.com/?${new URLSearchParams({
    hints: 'search',
    q: getAskPrompt(markdownUrl)
  })}`;
};

export const getClaudeAskUrl = (markdownUrl: string) => {
  return `https://claude.ai/new?${new URLSearchParams({
    q: getAskPrompt(markdownUrl)
  })}`;
};
