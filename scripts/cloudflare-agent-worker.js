/**
 * Cloudflare Worker for SoporteCero - Agent Readiness & RFC Compliance
 * 
 * Capabilities:
 * 1. Markdown Content Negotiation (Accept: text/markdown):
 *    - For homepage (/), returns /llms.txt with Content-Type: text/markdown and x-markdown-tokens.
 *    - For articles (/articulos/*.html), fetches the corresponding raw .md file or converts to markdown.
 * 2. RFC 8288 Link Response Headers:
 *    - Advertises API Catalog, MCP Server Card, ARD AI-Catalog, Auth.md, and LLM documentation.
 * 3. CORS headers:
 *    - Enables Access-Control-Allow-Origin: * on .well-known, API endpoints, and markdown files.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const acceptHeader = request.headers.get('accept') || '';
    const wantsMarkdown = acceptHeader.includes('text/markdown');

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
            'Cache-Control': 'public, max-age=600'
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
            'Cache-Control': 'public, max-age=600'
          }
        });
      }
    }

    // 3. Fetch original response from GitHub Pages origin
    const response = await fetch(request);

    // Clone headers to inject RFC discovery metadata
    const newHeaders = new Headers(response.headers);

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

    // Fallback markdown conversion if requested for other HTML pages
    const contentType = newHeaders.get('content-type') || '';
    if (wantsMarkdown && contentType.includes('text/html')) {
      const htmlText = await response.text();
      const tokenEstimate = Math.round(htmlText.length / 4);
      newHeaders.set('Content-Type', 'text/markdown; charset=utf-8');
      newHeaders.set('x-markdown-tokens', tokenEstimate.toString());
      newHeaders.set('Vary', 'Accept');
      return new Response(htmlText, {
        status: response.status,
        headers: newHeaders
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
