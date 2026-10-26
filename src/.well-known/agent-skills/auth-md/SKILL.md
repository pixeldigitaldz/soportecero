# Auth.md Agent Registration

Register and authenticate autonomous AI agents with SoporteCero.

## When to Use

Use this skill when an automated agent or LLM client needs to discover authentication requirements, obtain access tokens, or register for high-throughput API endpoints.

## Requirements

- Inspect `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`.
- For public access, use anonymous bearer credentials.
- Include `Authorization: Bearer <token>` in HTTP request headers.
- Verify tokens against the public JWKS endpoint at `/.well-known/jwks.json`.
