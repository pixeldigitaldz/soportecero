# SoporteCero auth.md

Technical error troubleshooting guides, Linux command remedies, and AI agent API registration metadata for [SoporteCero](https://soportecero.com).

## Agent Audience

This documentation is intended for automated AI agents, developer assistants, chat copilots, diagnostic runners, and Model Context Protocol (MCP) clients that query, index, or retrieve technical troubleshooting steps and repair guides from SoporteCero.

## Registration & Provisioning Flow

Autonomous agents can register programmatically using the following endpoints:

- **Registration URI**: `https://soportecero.com/agent/register`
- **Claim URI**: `https://soportecero.com/agent/claim`
- **Revocation URI**: `https://soportecero.com/agent/revoke`
- **Authorization Endpoint**: `https://soportecero.com/oauth/authorize`
- **Token Endpoint**: `https://soportecero.com/oauth/token`

### Agent Registration Request

Submit a POST request to register:

```http
POST /agent/register HTTP/1.1
Host: soportecero.com
Content-Type: application/json

{
  "name": "TroubleshootingCopilot",
  "identity_type": "anonymous"
}
```

### Agent Registration Response

```json
{
  "token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Credential Use

Include the access token in all subsequent API queries:

```http
Authorization: Bearer <token>
```

## Supported Identity & Credential Types

- **Anonymous**: Direct read-only access for searching public troubleshooting guides and error resolutions.
- **Verified Email**: Agent identification through email domain verification for higher rate limits.
- **Bearer Tokens**: Standard HTTP Authorization header tokens (`Authorization: Bearer <token>`).

## Authentication & Resource Metadata

Agent clients should discover endpoints and permissions using standard RFC discovery documents:

- **OAuth Protected Resource Metadata (RFC 9728)**: [/.well-known/oauth-protected-resource](https://soportecero.com/.well-known/oauth-protected-resource)
- **OAuth Authorization Server Metadata (RFC 8414)**: [/.well-known/oauth-authorization-server](https://soportecero.com/.well-known/oauth-authorization-server)
- **OpenID Connect Configuration**: [/.well-known/openid-configuration](https://soportecero.com/.well-known/openid-configuration)
- **API Catalog (RFC 9727)**: [/.well-known/api-catalog](https://soportecero.com/.well-known/api-catalog)
- **MCP Server Card (SEP-1649)**: [/.well-known/mcp/server-card.json](https://soportecero.com/.well-known/mcp/server-card.json)
- **Agentic Resource Discovery (ARD)**: [/.well-known/ai-catalog.json](https://soportecero.com/.well-known/ai-catalog.json)
- **Agent Skills Discovery**: [/.well-known/agent-skills/index.json](https://soportecero.com/.well-known/agent-skills/index.json)

## Scopes Supported

- `read`: Read and query technical guides and troubleshooting solutions.
- `search`: Perform full-text search across all error codes and articles.
