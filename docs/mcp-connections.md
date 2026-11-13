# Agent tool connections

The API Worker is served at `https://api.indices.app`. Its existing authenticated REST facade uses `GET /api/v1/mcp/tools` and `POST /api/v1/mcp/call` with `{ "tool": "name", "arguments": {} }`. It is not a JSON-RPC or Streamable HTTP MCP endpoint. `/api/mcp` is not the registered path.

`GET /.well-known/mcp.json` on the API Worker publishes metadata and the registry-derived count without credentials or tenant content. It explicitly sets `mcpTransportAvailable: false`; do not configure it as a native MCP transport. Tool listing and calls require a valid Better Auth session or bearer session token in production. Tenant identity comes from that session.

The SDK server in `src/mcp/server.ts` is separate from the HTTP facade. A future native MCP transport must bind verified tenant identity per request, validate tool arguments, preserve approval gates and receive a security review before deployment. Do not attach the current default `unknown` tenant callbacks to public HTTP.

Campaign tools create/edit drafts and read previews; human approval and Zeluto sending remain separate. This discovery change adds no send, approval or spending capability. Deploy separately from a reviewed merge; this PR does not change Cloudflare routes or production state.
