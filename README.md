# TikTok Brand Presence Mapper MCP Server

[![Smithery](https://smithery.ai/badge/mambabuilt/mcp-tiktok-brand-presence-mapper)](https://smithery.ai/servers/mambabuilt/mcp-tiktok-brand-presence-mapper) [![Glama score](https://glama.ai/mcp/servers/mambalabsdev/mcp-tiktok-brand-presence-mapper/badges/score.svg)](https://glama.ai/mcp/servers/mambalabsdev/mcp-tiktok-brand-presence-mapper) [![npm version](https://img.shields.io/npm/v/@mambalabsdev/mcp-tiktok-brand-presence-mapper)](https://www.npmjs.com/package/@mambalabsdev/mcp-tiktok-brand-presence-mapper) [![npm downloads](https://img.shields.io/npm/dm/@mambalabsdev/mcp-tiktok-brand-presence-mapper)](https://www.npmjs.com/package/@mambalabsdev/mcp-tiktok-brand-presence-mapper) [![license](https://img.shields.io/github/license/mambalabsdev/mcp-tiktok-brand-presence-mapper)](https://github.com/mambalabsdev/mcp-tiktok-brand-presence-mapper/blob/main/LICENSE)

MCP server for the Mamba Labs **TikTok Brand Presence Mapper** actor on Apify.

Resolve a TikTok handle or a company domain to the brand account with follower, like and video counts.

## What it does

Resolve a TikTok handle, or a company domain, to that brand's official TikTok account. Returns follower, following, like and video counts, verification status, display name, bio and the account's outbound bio link, as one flat Clay ready row. Counts above roughly ten thousand are rounded by TikTok and the row flags that. A guessed account that fails the identity check is reported as identity_mismatch with no counts rather than being returned as the company's. Read only; requires an APIFY_TOKEN and consumes Apify credits per call.

## Quick start

Add this to your MCP client configuration:

```json
{
  "mcpServers": {
    "mamba-tiktok-brand-presence-mapper": {
      "command": "npx",
      "args": ["-y", "@mambalabsdev/mcp-tiktok-brand-presence-mapper"],
      "env": { "APIFY_TOKEN": "your-apify-token" }
    }
  }
}
```

## Prerequisites

- Node.js 18 or newer
- An Apify API token from [console.apify.com/account/integrations](https://console.apify.com/account/integrations)

The actor is pay per event and consumes Apify credits per call. Pricing is on the
[actor page](https://apify.com/mambalabs/tiktok-brand-presence-mapper).

## Example prompts

- "How many TikTok followers does Gymshark have?"
- "Find the TikTok account for allbirds.com and tell me if it is verified."
- "Check whether patagonia.com has a TikTok presence at all."

## Tool and inputs

Tool: `map_tiktok_brand_presence`

| Input | Type | Meaning |
|---|---|---|
| `handle` | string | The TikTok handle, with or without the leading @, for example shopify. This is the PRIMARY input: only 4 of 14 B2B homepages declare a TikTok link, so |
| `company_domain` | string | Bare company domain, for example shopify.com. Used to FIND the handle when you do not have one, and to identity check a handle that discovery guessed. |
| `company_name` | string | Optional. Improves search accuracy and is what the identity gate checks a discovered account against. |
| `includeFollowerCounts` | boolean | When "true" (default) the profile page is fetched and the counts are extracted. Set "false" to resolve the profile URL only, which is cheaper and need |
| `skipCache` | boolean | When "false" (default) a successful lookup is cached for seven days and reused. Set "true" to force a fresh fetch. Sent as a string for Clay compatibi |
| `escalateOnBlock` | boolean | TikTok answers most requests over cheap datacenter routing and blocks a minority with a bot detection page. When "true" (default) a blocked fetch is r |

## Reading the output

Every row carries a per platform `_status` field, and it is the field to read
first. The vocabulary is the same across the whole Mamba Labs social family:

| Status | Meaning |
|---|---|
| `ok` | fetched and parsed, the value is there |
| `not_found` | we looked and there is no such profile |
| `not_extractable` | the profile exists and the value is not on the wire to us |
| `blocked` | the platform refused us, worth retrying later |
| `identity_mismatch` | we found a real profile and it belongs to someone else |
| `skipped` | you did not ask for this platform |

**`false` and `null` are never interchangeable.** `false` means we looked and the
answer is no. `null` means we could not look. If you filter for companies with no
presence, filter on `false`, because `null` rows are unknown rather than absent.

## Full actor documentation

[apify.com/mambalabs/tiktok-brand-presence-mapper](https://apify.com/mambalabs/tiktok-brand-presence-mapper)

## Mamba Labs GTM Suite

Mamba Labs builds a fleet of GTM enrichment actors that share one flat, Clay
ready output convention, so their rows join on `company_domain` with no cleaning
step. Full fleet: [apify.com/mambalabs](https://apify.com/mambalabs)

## License

MIT
