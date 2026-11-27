/**
 * Cloudflare Worker for SoporteCero - Agent Readiness, RFC Compliance & Security Headers
 * 
 * Capabilities:
 * 1. Markdown Content Negotiation (Accept: text/markdown):
 *    - For homepage (/), returns /llms.txt with Content-Type: text/markdown and x-markdown-tokens.
 *    - For articles (/articulos/*.html), fetches the corresponding raw .md file.
 * 2. MCP (/mcp) & A2A (/a2a) Live Endpoints:
 *    - Responds to GET, HEAD, OPTIONS, and JSON-RPC 2.0 POST requests for AI agents.
 * 3. RFC 9727 & ARD 1.0 Media Types:
 *    - Forces application/linkset+json on /.well-known/api-catalog.
 * 4. RFC 8288 Link Response Headers & HTTP Security Headers (HSTS, X-Content-Type-Options, etc.).
 */

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, MCP-Protocol-Version'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const acceptHeader = request.headers.get('accept') || '';
    const wantsMarkdown = acceptHeader.includes('text/markdown');

    // Canonical 301 redirects (eliminate duplicate index.html / trailing-slash / legacy paths)
    if (url.pathname === '/index.html') {
      return Response.redirect(`https://soportecero.com/${url.search}`, 301);
    }
    if (url.pathname === '/en/index.html' || url.pathname === '/en') {
      return Response.redirect(`https://soportecero.com/en/${url.search}`, 301);
    }
    if (url.pathname === '/tools/index.html' || url.pathname === '/tools') {
      return Response.redirect(`https://soportecero.com/tools/${url.search}`, 301);
    }
    if (url.pathname === '/en/contacto.html') {
      return Response.redirect('https://soportecero.com/en/contact.html', 301);
    }

    // Handle CORS preflight for agent endpoints
    if (request.method === 'OPTIONS' && (url.pathname === '/mcp' || url.pathname === '/a2a' || url.pathname.startsWith('/.well-known/'))) {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, ...SECURITY_HEADERS }
      });
    }

    // 0A. Live MCP Endpoint (/mcp) — Streamable HTTP & Discovery
    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      if (request.method === 'POST') {
        let rpcReq = {};
        try {
          rpcReq = await request.json();
        } catch (_) {}
        const id = rpcReq.id !== undefined ? rpcReq.id : 1;
        const method = rpcReq.method || 'initialize';

        let result = {
          protocolVersion: '2025-03-26',
          serverInfo: { name: 'SoporteCero MCP Server', version: '1.0.0' },
          capabilities: { tools: { listChanged: false }, resources: { listChanged: false } }
        };

        if (method === 'tools/list') {
          result = {
            tools: [
              {
                name: 'search_troubleshooting_guides',
                description: 'Search verified Linux, Docker, Web Development, and Gaming troubleshooting guides on SoporteCero.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'Error code, command, or topic to search' }
                  },
                  required: ['query']
                }
              },
              {
                name: 'get_llms_directory',
                description: 'Retrieve the complete SoporteCero directory of 285 technical guides and 6 financial calculators (llms-full.txt).',
                inputSchema: { type: 'object', properties: {} }
              }
            ]
          };
        }

        return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...CORS_HEADERS,
            ...SECURITY_HEADERS
          }
        });
      }

      // GET / HEAD on /mcp returns MCP Server metadata
      const mcpDescriptor = {
        serverInfo: { name: 'SoporteCero MCP Server', version: '1.0.0' },
        status: 'online',
        protocol: 'mcp-streamable-http',
        serverCardUrl: 'https://soportecero.com/.well-known/mcp/server-card.json',
        llmsIndexUrl: 'https://soportecero.com/llms.txt',
        llmsFullUrl: 'https://soportecero.com/llms-full.txt'
      };
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(mcpDescriptor, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...CORS_HEADERS,
          ...SECURITY_HEADERS
        }
      });
    }

    // 0B. Live A2A Endpoint (/a2a) — Agent-to-Agent Protocol
    if (url.pathname === '/a2a' || url.pathname === '/a2a/') {
      const a2aDescriptor = {
        name: 'SoporteCero Technical Troubleshooting Agent',
        version: '1.0.0',
        status: 'online',
        protocol: 'a2a-http-v1',
        agentCardUrl: 'https://soportecero.com/.well-known/agent-card.json',
        knowledgeIndexUrl: 'https://soportecero.com/llms-full.txt',
        capabilities: ['troubleshooting-search', 'code-remediation', 'diagnostic-lookup']
      };
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(a2aDescriptor, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...CORS_HEADERS,
          ...SECURITY_HEADERS
        }
      });
    }

    // 1. Markdown Negotiation for Homepage / Landing Pages
    if (wantsMarkdown && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/en' || url.pathname === '/en/' || url.pathname === '/en/index.html')) {
      const llmsUrl = new URL('/llms.txt', url.origin);
      const llmsResponse = await fetch(llmsUrl);
      if (llmsResponse.ok) {
        const text = await llmsResponse.text();
        const tokenEstimate = Math.round(text.length / 4);
        return new Response(text, {
          status: 200,
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'x-markdown-tokens': tokenEstimate.toString(),
            'Access-Control-Allow-Origin': '*',
            'Vary': 'Accept',
            'Cache-Control': 'public, max-age=600',
            ...SECURITY_HEADERS
          }
        });
      }
    }

    // 2. Markdown Negotiation for Technical Articles (/articulos/*.html -> /articulos/*.md)
    if (wantsMarkdown && url.pathname.includes('/articulos/') && url.pathname.endsWith('.html')) {
      const mdPath = url.pathname.replace(/\.html$/, '.md');
      const mdUrl = new URL(mdPath, url.origin);
      const mdResponse = await fetch(mdUrl);
      if (mdResponse.ok) {
        const mdText = await mdResponse.text();
        const tokenEstimate = Math.round(mdText.length / 4);
        return new Response(mdText, {
          status: 200,
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'x-markdown-tokens': tokenEstimate.toString(),
            'Access-Control-Allow-Origin': '*',
            'Vary': 'Accept',
            'Cache-Control': 'public, max-age=600',
            ...SECURITY_HEADERS
          }
        });
      }
    }

    // 3. Fetch original response from GitHub Pages origin
    const response = await fetch(request);

    // Clone headers to inject RFC discovery metadata and Security Headers
    const newHeaders = new Headers(response.headers);

    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      newHeaders.set(k, v);
    }

    // Keep Vary clean on standard HTML/asset responses to avoid CDN/Googlebot cache fragmentation
    newHeaders.set('Vary', 'Accept-Encoding');

    // RFC 9727: Fix Content-Type for /.well-known/api-catalog
    if (url.pathname === '/.well-known/api-catalog') {
      newHeaders.set('Content-Type', 'application/linkset+json; charset=utf-8');
    }

    // RFC 8288 Link Response Headers
    const linkHeaders = [
      '</.well-known/api-catalog>; rel="api-catalog"',
      '</.well-known/ai-catalog.json>; rel="ai-catalog"',
      '</.well-known/mcp/server-card.json>; rel="service-desc"',
      '</auth.md>; rel="describedby"',
      '</llms.txt>; rel="service-doc"'
    ].join(', ');
    newHeaders.set('Link', linkHeaders);

    // CORS for discovery endpoints
    if (url.pathname.startsWith('/.well-known/') || url.pathname === '/auth.md' || url.pathname.startsWith('/llms')) {
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
