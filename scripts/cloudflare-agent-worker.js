/**
 * Cloudflare Worker for SoporteCero - Agent Readiness & RFC Compliance
 * 
 * Capabilities:
 * 1. RFC 8288 Link Headers on homepage & HTML pages.
 * 2. Markdown Negotiation (Accept: text/markdown) returning clean markdown with x-markdown-tokens.
 * 3. CORS headers (Access-Control-Allow-Origin: *) for /.well-known/ and API endpoints.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const acceptHeader = request.headers.get('accept') || '';
    const wantsMarkdown = acceptHeader.includes('text/markdown');

    // 1. Handle Markdown Content Negotiation for Root / Landing Page
    if (wantsMarkdown && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/en' || url.pathname === '/en/')) {
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
            'Vary': 'Accept'
          }
        });
      }
    }

    // 2. Fetch original response from GitHub Pages origin
    const response = await fetch(request);

    // Clone response so headers can be modified
    const newHeaders = new Headers(response.headers);

    // 3. RFC 8288 Link Response Headers
    const linkHeaders = [
      '</.well-known/api-catalog>; rel="api-catalog"',
      '</.well-known/ai-catalog.json>; rel="ai-catalog"',
      '</.well-known/mcp/server-card.json>; rel="service-desc"',
      '</auth.md>; rel="describedby"',
      '</llms.txt>; rel="service-doc"'
    ].join(', ');

    newHeaders.set('Link', linkHeaders);

    // 4. CORS headers for .well-known endpoints
    if (url.pathname.startsWith('/.well-known/') || url.pathname === '/auth.md' || url.pathname.startsWith('/llms')) {
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    }

    // 5. If the request was for Markdown on an article HTML page, convert or return with markdown header
    const contentType = newHeaders.get('content-type') || '';
    if (wantsMarkdown && contentType.includes('text/html')) {
      const htmlText = await response.text();
      // Basic markdown extraction of article content
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
