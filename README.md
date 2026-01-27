# rhda-mcp-server

Red Hat Dependency Analytics MCP Server - An MCP server that provides tools for analyzing vulnerabilities in dependencies and container images.

## Installation

```bash
npm install
```

## Usage

The server requires the `--backend-url` argument to specify the Trustify Dependency Analytics backend URL. An optional `--nvd-api-key` can be provided for higher rate limits when querying the NVD API.

### Using npx (Recommended)

```bash
npx /path/to/rhda-mcp-server --backend-url <TRUSTIFY_DA_BACKEND_URL> [--nvd-api-key <NVD_API_KEY>]
```

Or if you're in the project directory:

```bash
npx . --backend-url <TRUSTIFY_DA_BACKEND_URL> [--nvd-api-key <NVD_API_KEY>]
```

### Using tsx directly

```bash
npx tsx index.ts --backend-url <TRUSTIFY_DA_BACKEND_URL> [--nvd-api-key <NVD_API_KEY>]
```

Example:

```bash
npx /Users/rromerom/workspace/github.com/trustification/rhda-mcp-server --backend-url https://exhort.stage.devshift.net
```

## Adding as an MCP Server

To use this server with an MCP client (like Claude Desktop, Cursor, or other MCP-compatible tools), add the following configuration:

### For Claude Desktop

Add to your Claude Desktop configuration file (location varies by OS):

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

#### Option 1: Using npx directly (Recommended)

```json
{
  "mcpServers": {
    "rhda": {
      "command": "npx",
      "args": [
        "/path/to/rhda-mcp-server",
        "--backend-url",
        "https://api.trustify.dev",
        "--nvd-api-key",
        "your-nvd-api-key"
      ]
    }
  }
}
```

**Note**: When using npx with a local directory, it will automatically use the `bin` entry from `package.json` which points to `run.sh`. This script uses `npx tsx` internally to run the TypeScript file.

#### Option 2: Using npx with tsx explicitly

```json
{
  "mcpServers": {
    "rhda": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/path/to/rhda-mcp-server/index.ts",
        "--backend-url",
        "https://api.trustify.dev",
        "--nvd-api-key",
        "your-nvd-api-key"
      ]
    }
  }
}
```

### For Cursor

Add to your Cursor settings (`.cursor/mcp.json` or in Cursor settings):

```json
{
  "mcpServers": {
    "rhda": {
      "command": "npx",
      "args": [
        "/path/to/rhda-mcp-server",
        "--backend-url",
        "https://api.trustify.dev",
        "--nvd-api-key",
        "your-nvd-api-key"
      ]
    }
  }
}
```

### Using npx directly (without local installation)

If you want to run it directly from a git repository:

```json
{
  "mcpServers": {
    "rhda": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "https://raw.githubusercontent.com/your-org/rhda-mcp-server/main/index.ts",
        "--backend-url",
        "https://api.trustify.dev",
        "--nvd-api-key",
        "your-nvd-api-key"
      ]
    }
  }
}
```

**Important Notes:**
- Replace `/path/to/rhda-mcp-server` with the **absolute path** to this project on your system
- Update the `--backend-url` and `--nvd-api-key` values as needed
- The `-y` flag in npx automatically installs tsx if it's not available
- After updating the configuration, restart your MCP client (Claude Desktop, Cursor, etc.) for changes to take effect

## Available Tools

### 1. `analyze_stack_vulnerabilities`
Analyze vulnerabilities in the direct or transitive dependencies of your project.

**Input:**
- `manifestPath`: Path to package manager file (pom.xml, package.json, build.gradle, build.gradle.kts, go.mod, requirements.txt)
- `directOnly`: (optional) If true, analyze only direct dependencies. If false or omitted, analyze the whole stack

### 2. `analyze_image_vulnerabilities`
Analyze vulnerabilities in container images.

**Input:**
- `imageRef`: Container image reference to analyze (e.g., `registry.access.redhat.com/ubi9/nodejs-20:latest` or `httpd:2.4.49^^amd64`)

### 3. `describe_vulnerability`
Retrieve generic information about a vulnerability given a CVE ID.

**Input:**
- `cveId`: CVE ID (e.g., CVE-2024-2700)

### 4. `verify_vulnerability`
Analyze how a vulnerability affects the current code and generate a verification checklist.

**Input:**
- `dependencyRef`: Dependency reference (e.g., io.quarkus/quarkus-agroal@2.13.5.Final)
- `dependencyHierarchy`: (optional) Dependency hierarchy (e.g., root -> dep A -> vulnerable dep X)
- `cveId`: CVE ID
- `isDirect`: (optional) Whether the dependency is direct (true) or transitive (false)
- `remediation`: (optional) Remediation data from the report
- `affectedVersions`: (optional) Affected version ranges

### 5. `ignore_dependency`
Mark a dependency as ignored from the RHDA dependency scan.

**Input:**
- `dependencyName`: Dependency name to ignore
- `manifestPath`: Path to the manifest file where the dependency is declared

## Implementation Details

- Uses stdio transport for MCP communication
- Saves full analysis reports to temporary directories
- Integrates with NVD API for CVE information
- Supports GitHub Security Advisories (GHSA) for additional vulnerability context
- Uses Zod for schema validation

This project uses Node.js and TypeScript, and can be run with `npx` or `tsx`.
