# rhda-mcp-server

Red Hat Dependency Analytics MCP Server - An MCP server that provides tools for analyzing vulnerabilities in dependencies and container images.

## Installation

```bash
npm install
```

## Usage

The server requires two arguments:
- `--backend-url`: Trustify Dependency Analytics backend URL (for vulnerability scanning)
- `--intel-server-url`: Trustify Intel Server URL (for vulnerability assessment and remediation planning)

### Using npx (Recommended)

```bash
npx /path/to/rhda-mcp-server --backend-url <TRUSTIFY_DA_BACKEND_URL> --intel-server-url <TRUSTIFY_INTEL_SERVER_URL>
```

Or if you're in the project directory:

```bash
npx . --backend-url <TRUSTIFY_DA_BACKEND_URL> --intel-server-url <TRUSTIFY_INTEL_SERVER_URL>
```

### Using tsx directly

```bash
npx tsx index.ts --backend-url <TRUSTIFY_DA_BACKEND_URL> --intel-server-url <TRUSTIFY_INTEL_SERVER_URL>
```

Example:

```bash
npx /Users/rromerom/workspace/github.com/trustification/rhda-mcp-server --backend-url https://exhort.stage.devshift.net --intel-server-url https://intel.stage.devshift.net
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
        "--intel-server-url",
        "https://intel.trustify.dev"
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
        "--intel-server-url",
        "https://intel.trustify.dev"
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
        "--intel-server-url",
        "https://intel.trustify.dev"
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
        "--intel-server-url",
        "https://intel.trustify.dev"
      ]
    }
  }
}
```

**Important Notes:**
- Replace `/path/to/rhda-mcp-server` with the **absolute path** to this project on your system
- Update the `--backend-url` and `--intel-server-url` values as needed
- The `-y` flag in npx automatically installs tsx if it's not available
- After updating the configuration, restart your MCP client (Claude Desktop, Cursor, etc.) for changes to take effect

## Available Tools

### 1. `analyze_dependency_vulnerabilities`
Scan and find vulnerabilities in project dependencies. This is the **first step** in the vulnerability analysis workflow. Use this when you want to discover what vulnerabilities exist in your project's dependencies.

**When to use:** "What vulnerabilities are in my dependencies?", "Scan my dependencies", "Check for security issues", "Find vulnerabilities in my project", "What CVEs affect my dependencies?"

**Input:**
- `manifestPath` (required): Path to package manager file (pom.xml, package.json, build.gradle, build.gradle.kts, go.mod, requirements.txt, Cargo.toml)
- `directOnly` (optional): If `true`, analyze only direct dependencies. If `false` or omitted, analyze the whole stack including transitive dependencies

**Output:** Returns a list of CVEs with affected packages, severity, and remediation status. The results include `cve` and `packageRef` information needed for the next steps.

### 2. `explain_vulnerability`
Explain and describe a specific CVE vulnerability. Provides detailed security assessment including exploitability, impact, limitations, confidence, and evidence-backed claims.

**When to use:** "What is CVE-XXXX?", "Explain CVE-XXXX", "Tell me about this CVE", "What does this vulnerability do?", "Details about CVE-XXXX"

**Input:**
- `cve` (required): CVE ID (e.g., CVE-2024-2700). **Must be obtained from `analyze_dependency_vulnerabilities` results first**
- `packageRef` (required): Object containing:
  - `purl`: Dependency purl to identify the package (e.g., `pkg:maven/org.postgresql/postgresql@42.7.1`). **Must be obtained from `analyze_dependency_vulnerabilities` results first**
  - `scope`: Dependency scope - one of: `"runtime"`, `"development"`, `"test"`, `"build"`
  - `dependency_graph`: Array of URLs representing the parent dependencies (for transitive dependencies)

**Note:** Do NOT use `manifestPath` here. First call `analyze_dependency_vulnerabilities`, then use the `cve` and `packageRef` from those results.

**Output:** Returns detailed vulnerability assessment data.

### 3. `generate_remediation_plan`
Generate a fix, solution, or remediation plan for a specific CVE vulnerability. Provides actionable remediation options and step-by-step instructions for fixing, mitigating, or safely ignoring the issue.

**When to use:** "How do I fix CVE-XXXX?", "What's the solution for this CVE?", "How to remediate this vulnerability?", "Fix this vulnerability", "Remediation plan for CVE-XXXX", "How to solve this CVE?"

**Input:**
- `cve` (required): CVE ID (e.g., CVE-2024-2700). **Must be obtained from `analyze_dependency_vulnerabilities` results first**
- `packageRef` (required): Object containing:
  - `purl`: Dependency purl to identify the package (e.g., `pkg:maven/org.postgresql/postgresql@42.7.1`). **Must be obtained from `analyze_dependency_vulnerabilities` results first**
  - `scope`: Dependency scope - one of: `"runtime"`, `"development"`, `"test"`, `"build"`
  - `dependency_graph`: Array of URLs representing the parent dependencies (for transitive dependencies)

**Note:** Do NOT use `manifestPath` here. First call `analyze_dependency_vulnerabilities`, then use the `cve` and `packageRef` from those results.

**Output:** Returns remediation plan with `plan` and `intel` data.

**⚠️ Important:** This tool returns **INFORMATION ONLY**. The remediation plan must be presented to the user for review. The IDE must NOT automatically take any actions, modify code, update dependencies, or make changes without explicit user approval. The remediation plan is for the user to review and implement themselves.

### 4. `suppress_dependency_vulnerability`
Suppress or ignore a vulnerability finding when it's confirmed as a false positive or not applicable. This adds the dependency to an ignore list so it won't appear in future scans. **This does not fix the vulnerability** - it only suppresses the finding.

**When to use:** When a CVE is confirmed as:
- "not applicable"
- "false positive"
- "does not affect this version"
- "only affects different version"

Or when the user **explicitly** asks to:
- "ignore this vulnerability"
- "suppress this finding"
- "mark as false positive"
- "this CVE doesn't apply"

**Input:**
- `dependencyName` (required): Dependency name to ignore (e.g., `io.quarkus:quarkus-core`)
- `manifestPath` (required): Path to the manifest file where the dependency is declared (pom.xml, package.json, etc.)

**Output:** 
- For `package.json`: Automatically updates the file to add the dependency to the `trustify-da-ignore` array
- For other formats (pom.xml, go.mod, etc.): Returns instructions on how to manually add the ignore comment

**⚠️ Important:** Only call this tool when the user **EXPLICITLY requests** to suppress/ignore a vulnerability. Do NOT call this automatically just because a false positive was identified - present the information to the user first and wait for their explicit instruction to suppress it.

## Workflow

The recommended workflow for vulnerability analysis is:

1. **Start with `analyze_dependency_vulnerabilities`** - Scan your project to discover vulnerabilities
2. **Use `explain_vulnerability`** - Get detailed information about specific CVEs you want to understand
3. **Use `generate_remediation_plan`** - Get actionable steps to fix vulnerabilities
4. **Use `suppress_dependency_vulnerability`** - Only when explicitly requested, suppress false positives

## Implementation Details

- Uses stdio transport for MCP communication
- Saves full analysis reports to temporary directories
- Integrates with Trustify Dependency Analytics backend for vulnerability scanning
- Integrates with Trustify Intel Server for vulnerability assessment and remediation planning
- Uses Zod for schema validation
- Supports multiple package managers: Maven (pom.xml), NPM (package.json), Gradle (build.gradle, build.gradle.kts), Go (go.mod), Python (requirements.txt), Rust (Cargo.toml)

This project uses Node.js and TypeScript, and can be run with `npx` or `tsx`.
