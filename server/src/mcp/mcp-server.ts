/**
 * Claimsure MCP Server — exposes domain tools over the Model Context Protocol.
 * Any MCP-compatible client (Claude Desktop, custom agents) can call these tools.
 * Tools reuse the same services as the REST API — zero duplicated logic.
 */

<<<<<<< HEAD
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Import individual tools
import { policySearchTool } from './tools/policy-search.js';
import { denyParseTool } from './tools/denial-parse.js';
import { evidenceScanTool } from './tools/evidence-scan.js';
import { caseUpdateTool } from './tools/case-update.js';
import { sendNotificationTool } from './tools/send-notification.js';
import { googleDriveTools } from './tools/google-drive.js';
import { googleSheetsTools } from './tools/google-sheets.js';
import { googleCalendarTools } from './tools/google-calendar.js';
import { gmailTools } from './tools/gmail.js';
=======
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import individual tools
import { policySearchTool } from "./tools/policy-search.js";
import { denyParseTool } from "./tools/denial-parse.js";
import { evidenceScanTool } from "./tools/evidence-scan.js";
import { caseUpdateTool } from "./tools/case-update.js";
import { sendNotificationTool } from "./tools/send-notification.js";
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d

import { logger } from "../lib/logger.js";

// ─── MCP Server Instance ───────────────────────────────────────────────────────

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "claimsure-mcp",
    version: "1.0.0",
  });

  // Register all tools
  policySearchTool(server);
  denyParseTool(server);
  evidenceScanTool(server);
  caseUpdateTool(server);
  sendNotificationTool(server);
  googleDriveTools(server);
  googleSheetsTools(server);
  googleCalendarTools(server);
  gmailTools(server);

<<<<<<< HEAD
  logger.info('MCP server initialized with 11 tools');
=======
  logger.info("MCP server initialized with 5 tools");
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d
  return server;
}

// ─── Standalone MCP Runner ─────────────────────────────────────────────────────
// Run with: npx tsx src/mcp/mcp-server.ts

async function runStandalone(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info("Claimsure MCP server running on stdio");
}

// Only run standalone if this is the entry point
if (
  process.argv[1]?.endsWith("mcp-server.ts") ||
  process.argv[1]?.endsWith("mcp-server.js")
) {
  runStandalone().catch((err) => {
    logger.error("MCP server failed to start", err);
    process.exit(1);
  });
}
