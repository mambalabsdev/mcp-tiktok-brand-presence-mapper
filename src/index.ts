#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(here, "..", "package.json"), "utf8"),
) as { version: string; name: string };

// Distinctive UA so Apify run meta.userAgent marks MCP-originated runs.
const USER_AGENT = `mambalabs-mcp ${pkg.name}@${pkg.version}`;

const APIFY_TOKEN = process.env.APIFY_TOKEN;

type ToolResult = {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
};

// Drop undefined values so optional inputs are not sent to the actor at all.
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// The actor types its switches as strings ("true"/"false") for Clay
// compatibility, because Clay sends every input as a string and a boolean typed
// field silently receives "false" and reads it as truthy. The model gets a real
// boolean and the actor gets the string it validates.
function boolToString(v: boolean | undefined): string | undefined {
  return v === undefined ? undefined : v ? "true" : "false";
}

// actorPath is the actor's IMMUTABLE Apify actor id, not its slug, so a Store
// rename never breaks these calls.
async function runActor(
  actorPath: string,
  actorLabel: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  if (!APIFY_TOKEN) {
    return { isError: true, content: [{ type: "text", text: "APIFY_TOKEN is not set. Create a token at https://console.apify.com/account/integrations and set it as the APIFY_TOKEN environment variable." }] };
  }

  // memory=512 is deliberate and matches the actor's declared
  // defaultRunOptions.memoryMbytes. run-sync-get-dataset-items runs at 2048 MB
  // unless told otherwise, and `apify-actor-start` bills once per GB with a
  // minimum of one, so leaving the default in place would charge the caller
  // more start events per run than the actor asks for. Keep this in step with
  // the actor's defaultRunOptions.
  const url = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?timeout=300&memory=512`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${APIFY_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `Could not reach the Apify API: ${message}` }] };
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = ` ${body.error.message}`;
    } catch {
      detail = "";
    }

    let message: string;
    switch (response.status) {
      case 401:
        message = "Invalid Apify token. Check your APIFY_TOKEN environment variable.";
        break;
      case 402:
        message = "Insufficient Apify credits. Check your account balance at https://console.apify.com/billing";
        break;
      case 408:
        message = `The ${actorLabel} run timed out after 300 seconds. Try again, or run the actor on Apify directly for longer jobs.`;
        break;
      default:
        message = `Apify request to ${actorLabel} failed with status ${response.status}.${detail}`;
    }
    return { isError: true, content: [{ type: "text", text: message }] };
  }

  // A 2xx normally carries the dataset array. Pass actor output through
  // unchanged: the wrapper must never reinterpret a status field, because
  // not_extractable, blocked and not_found are different answers and collapsing
  // them is exactly the defect the actor was built to avoid.
  const items = await response.json();
  return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
}

const server = new McpServer({
  name: "mamba-tiktok-brand-presence-mapper",
  version: pkg.version,
});

// TikTok Brand Presence Mapper (immutable actor ID fco8FvoJcSafbeyd1)
server.registerTool(
  "map_tiktok_brand_presence",
  {
    title: "Map TikTok Brand Presence",
    description:
      "Resolve a TikTok handle, or a company domain, to that brand's official TikTok account. Returns follower, following, like and video counts, verification status, display name, bio and the account's outbound bio link, as one flat Clay ready row. Counts above roughly ten thousand are rounded by TikTok and the row flags that. A guessed account that fails the identity check is reported as identity_mismatch with no counts rather than being returned as the company's. Read only; requires an APIFY_TOKEN and consumes Apify credits per call.",
    annotations: {
      title: "Map TikTok Brand Presence",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    inputSchema: {
      handle: z.string()
        .optional()
        .describe("The TikTok handle, with or without the leading @, for example shopify. This is the PRIMARY input: only 4 of 14 B2B homepages declare a TikTok link, so supplying the handle is both cheaper and far more reliable than asking the actor to find it."),
      company_domain: z.string()
        .optional()
        .describe("Bare company domain, for example shopify.com. Used to FIND the handle when you do not have one, and to identity check a handle that discovery guessed. Supplying both is the best case."),
      company_name: z.string()
        .optional()
        .describe("Optional. Improves search accuracy and is what the identity gate checks a discovered account against."),
      includeFollowerCounts: z.boolean()
        .optional()
        .describe("When \"true\" (default) the profile page is fetched and the counts are extracted. Set \"false\" to resolve the profile URL only, which is cheaper and needs no proxy. Sent as a string for Clay compatibility."),
      skipCache: z.boolean()
        .optional()
        .describe("When \"false\" (default) a successful lookup is cached for seven days and reused. Set \"true\" to force a fresh fetch. Sent as a string for Clay compatibility."),
      escalateOnBlock: z.boolean()
        .optional()
        .describe("TikTok answers most requests over cheap datacenter routing and blocks a minority with a bot detection page. When \"true\" (default) a blocked fetch is retried once over residential, which recovers most of them at a higher cost per recovered row. Set \"false\" to accept the block and return status blocked. Sent as a string for Clay compatibility."),
    },
  },
  async ({ handle, company_domain, company_name, includeFollowerCounts, skipCache, escalateOnBlock }) => {
    return runActor(
      "fco8FvoJcSafbeyd1",
      "TikTok Brand Presence Mapper",
      compact({
        handle,
        company_domain,
        company_name,
        includeFollowerCounts: boolToString(includeFollowerCounts),
        skipCache: boolToString(skipCache),
        escalateOnBlock: boolToString(escalateOnBlock),
      }),
    );
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
