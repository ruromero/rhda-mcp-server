import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createAnalyzeStackVulnerabilitiesTool, analyzeStackVulnerabilitiesSchema } from "./tools/analyzeStackVulnerabilities.js";
import { createDescribeVulnerabilityTool, describeVulnerabilitySchema } from "./tools/describeVulnerability.js";
import { generateRemediationPlanTool, remediationPlanSchema } from "./tools/remediationPlan.js";
import { createIgnoreDependencyTool, ignoreDependencySchema } from "./tools/ignoreDependency.js";
import type { Config } from "./config/cli.js";

export function createServer(config: Config): McpServer {
  const server = new McpServer(
    {
      name: "rhda-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );
  
  server.registerTool(
    "analyze_dependency_vulnerabilities",
    {
      description:
        "Scan and find vulnerabilities in project dependencies. Use this when the user asks: 'What vulnerabilities are in my dependencies?', 'Scan my dependencies', 'Check for security issues', 'Find vulnerabilities in my project', 'What CVEs affect my dependencies?', or similar queries about discovering vulnerabilities. Takes a manifestPath (pom.xml, package.json, etc.) and returns a list of CVEs with affected packages, severity, and remediation status. This is the FIRST step - use this before explain_vulnerability or generate_remediation_plan.",
      inputSchema: analyzeStackVulnerabilitiesSchema,
    },
    createAnalyzeStackVulnerabilitiesTool(config.backendUrl)
  );
  
  server.registerTool(
    "explain_vulnerability",
    {
      description:
        "Explain and describe a specific CVE vulnerability. Use this when the user asks: 'What is CVE-XXXX?', 'Explain CVE-XXXX', 'Tell me about this CVE', 'What does this vulnerability do?', 'Details about CVE-XXXX', or similar queries asking to understand or explain a specific CVE. Requires cve (CVE ID) and packageRef (obtained from analyze_dependency_vulnerabilities results). Provides detailed security assessment including exploitability, impact, limitations, confidence, and evidence-backed claims. Do NOT use manifestPath here - first call analyze_dependency_vulnerabilities, then use the cve and packageRef from those results.",
      inputSchema: describeVulnerabilitySchema,
    },
    createDescribeVulnerabilityTool(config.intelServerUrl)
  );
  
  server.registerTool(
    "generate_remediation_plan",
    {
      description:
        "Generate a fix, solution, or remediation plan for a specific CVE vulnerability. Use this when the user asks: 'How do I fix CVE-XXXX?', 'What's the solution for this CVE?', 'How to remediate this vulnerability?', 'Fix this vulnerability', 'Remediation plan for CVE-XXXX', 'How to solve this CVE?', or similar queries asking for solutions or fixes. Requires cve (CVE ID) and packageRef (obtained from analyze_dependency_vulnerabilities results). Provides actionable remediation options and step-by-step instructions for fixing, mitigating, or safely ignoring the issue. Do NOT use manifestPath here - first call analyze_dependency_vulnerabilities, then use the cve and packageRef from those results. IMPORTANT: This tool returns INFORMATION ONLY - you MUST present the remediation plan to the user and MUST NOT take any actions automatically. Do NOT modify code, update dependencies, or make any changes without explicit user approval. The remediation plan is for the user to review and implement themselves.",
      inputSchema: remediationPlanSchema,
    },
    generateRemediationPlanTool(config.intelServerUrl)
  );
  
  server.registerTool(
    "suppress_dependency_vulnerability",
    {
      description:
        "Suppress or ignore a vulnerability finding when it's confirmed as a false positive or not applicable. Use this when you identify that a CVE is: 'not applicable', 'false positive', 'does not affect this version', 'only affects different version', or when the user EXPLICITLY asks to 'ignore this vulnerability', 'suppress this finding', 'mark as false positive', 'this CVE doesn't apply'. Takes dependencyName and manifestPath to add the dependency to the ignore list. This does not fix the vulnerability - it only suppresses the finding from future scans. Should be used when a vulnerability is confirmed as not affecting the current setup (e.g., 'CVE-XXXX only affects version 3.x, but we're on 2.x'). IMPORTANT: Only call this tool when the user EXPLICITLY requests to suppress/ignore a vulnerability. Do NOT call this automatically just because you identified a false positive - present the information to the user first and wait for their explicit instruction to suppress it.",
      inputSchema: ignoreDependencySchema,
    },
    createIgnoreDependencyTool()
  );

  return server;
}
