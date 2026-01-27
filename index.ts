#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseCliArgs } from "./src/config/cli.js";
import { createServer } from "./src/server.js";

// Parse CLI arguments
const config = parseCliArgs();

// Create and configure server
const server = createServer(config);

// Connect to stdio transport and start server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("RHDA MCP Server started");
