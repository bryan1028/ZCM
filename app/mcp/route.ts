import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createZistServer } from "@/lib/mcp";

export const dynamic = "force-dynamic";

/**
 * Remote MCP server for the ChatGPT plugin (Streamable HTTP). Stateless: a fresh server per request, JSON responses.
 * Tool inputs (diets, search text) are never logged: diet and allergy filters are sensitive.
 */
async function handle(req: Request): Promise<Response> {
  const server = createZistServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } catch (e) {
    console.error("mcp error:", (e as Error).message); // message only, never request bodies
    return Response.json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
