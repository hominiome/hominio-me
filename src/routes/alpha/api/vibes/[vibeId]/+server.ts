import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

/**
 * Dynamic MCP endpoint for any vibe
 * Route: /alpha/api/vibes/[vibeId]
 * 
 * This loads the appropriate vibe handler based on vibeId
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const { vibeId } = params;

  if (!vibeId) {
    return error(400, 'vibeId is required');
  }

  try {
    // Import vibe handlers (static imports required by SvelteKit)
    // Each vibe exports a createMcpServer function
    let createMcpServer: () => McpServer;
    
    // Registry of available vibes
    switch (vibeId) {
      case 'todos':
        const todosModule = await import('../todos/mcp-server.js');
        createMcpServer = todosModule.createMcpServer;
        break;
      // Add more vibes here as they're created
      // case 'produce':
      //   const produceModule = await import('../produce/mcp-server.js');
      //   createMcpServer = produceModule.createMcpServer;
      //   break;
      default:
        return error(404, `Vibe "${vibeId}" not found`);
    }

    if (typeof createMcpServer !== 'function') {
      return error(500, `Vibe "${vibeId}" does not export createMcpServer function`);
    }

    // Create the MCP server instance for this request
    const server = createMcpServer();

    // Parse request body - MCP transport expects parsed JSON object, not a stream
    const body = await request.json();

    // Create a mock Express-like request/response for the transport
    // The transport expects Express req/res objects
    const mockReq = {
      method: 'POST',
      url: request.url,
      body, // Parsed JSON object (as Express middleware would provide)
      headers: Object.fromEntries(request.headers.entries())
    };

    let responseBody: any = null;
    let statusCode = 200;
    let headersSent = false;
    const responseHeaders: Record<string, string> = {};
    const responseChunks: string[] = [];
    
    // Promise that resolves when res.end() is called
    let resolveEnd: () => void;
    const endPromise = new Promise<void>((resolve) => {
      resolveEnd = resolve;
    });

    const mockRes = {
      status: (code: number) => {
        console.log(`[MCP ${vibeId}] res.status(${code}) called`);
        statusCode = code;
        return mockRes;
      },
      json: (data: any) => {
        console.log(`[MCP ${vibeId}] res.json() called:`, JSON.stringify(data).substring(0, 200));
        responseBody = data;
        headersSent = true;
        return mockRes;
      },
      writeHead: (code: number, headers?: Record<string, string>) => {
        console.log(`[MCP ${vibeId}] res.writeHead(${code}) called`, headers);
        statusCode = code;
        headersSent = true;
        if (headers) {
          Object.assign(responseHeaders, headers);
        }
        return mockRes;
      },
      setHeader: (name: string, value: string) => {
        console.log(`[MCP ${vibeId}] res.setHeader(${name}, ${value}) called`);
        responseHeaders[name] = value;
        return mockRes;
      },
      getHeader: (name: string) => {
        return responseHeaders[name];
      },
      write: (chunk: string | Buffer) => {
        const chunkStr = Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
        console.log(`[MCP ${vibeId}] res.write() called:`, chunkStr.substring(0, 100));
        responseChunks.push(chunkStr);
        return true;
      },
      end: (chunk?: string | Buffer) => {
        if (chunk) {
          const chunkStr = Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
          console.log(`[MCP ${vibeId}] res.end() called with chunk:`, chunkStr.substring(0, 100));
          responseChunks.push(chunkStr);
        } else {
          console.log(`[MCP ${vibeId}] res.end() called without chunk`);
        }
        headersSent = true;
        if (responseChunks.length > 0 && !responseBody) {
          try {
            responseBody = JSON.parse(responseChunks.join(''));
            console.log(`[MCP ${vibeId}] Parsed responseBody from chunks:`, JSON.stringify(responseBody).substring(0, 200));
          } catch {
            responseBody = { text: responseChunks.join('') };
          }
        }
        // Resolve the promise to signal that the response has been written
        resolveEnd();
        return mockRes;
      },
      get headersSent() {
        return headersSent;
      },
      on: (event: string, callback: () => void) => {
        if (event === 'close') {
          // Handle cleanup if needed
        }
      }
    };

    // Create a new transport for each request (stateless mode)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    // Connect server to transport
    await server.connect(transport);

    // Handle the request using the transport
    // According to MCP docs: transport.handleRequest(req, res, req.body)
    // The third parameter is the parsed JSON body object
    try {
      await transport.handleRequest(mockReq as any, mockRes as any, body);
    } catch (error: any) {
      console.error(`[MCP ${vibeId}] handleRequest error:`, error);
      throw error;
    }
    
    // Wait for res.end() to be called (response to be written)
    // The MCP SDK writes responses asynchronously, so we need to wait
    // Increased timeout to 10 seconds to account for AI API calls (Red Pill)
    await Promise.race([
      endPromise,
      new Promise((resolve) => setTimeout(resolve, 10000)) // 10 second timeout for AI calls
    ]);

    // Check if response was written via json() or write()/end()
    // Note: responseBody is set in res.end() handler, so it should be available here
    console.log(`[MCP ${vibeId}] Checking responseBody:`, responseBody, 'type:', typeof responseBody, 'isTruthy:', !!responseBody, 'chunks:', responseChunks.length);
    
    // Return responseBody if it was set (even if it contains an error)
    if (responseBody !== null && responseBody !== undefined) {
      console.log(`[MCP ${vibeId}] Returning responseBody:`, JSON.stringify(responseBody).substring(0, 200));
      return json(responseBody, { status: statusCode });
    }

    // If responseBody wasn't set but we have chunks, try to parse them
    if (responseChunks.length > 0) {
      try {
        const parsed = JSON.parse(responseChunks.join(''));
        console.log(`[MCP ${vibeId}] Returning parsed chunks:`, JSON.stringify(parsed).substring(0, 200));
        return json(parsed, { status: statusCode });
      } catch (parseError) {
        console.error(`[MCP ${vibeId}] Failed to parse response chunks:`, responseChunks.join(''));
      }
    }

    // Fallback if no response was set
    console.error(`[MCP ${vibeId}] No response generated. Status: ${statusCode}, responseBody:`, responseBody, 'chunks:', responseChunks.length, 'Body:', body);
    return json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'No response generated'
        },
        id: body.id || null
      },
      { status: 500 }
    );
  } catch (err: any) {
    console.error(`[MCP ${vibeId}] Error:`, err);
    return json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: err.message
        },
        id: null
      },
      { status: 500 }
    );
  }
};

