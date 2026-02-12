import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createAnalyzeStackVulnerabilitiesTool, analyzeStackVulnerabilitiesSchema } from "./tools/analyzeStackVulnerabilities.js";
import { createDescribeVulnerabilityTool as createExplainVulnerabilityTool, describeVulnerabilitySchema as explainVulnerabilitySchema } from "./tools/describeVulnerability.js";
import { generateRemediationPlanTool as createGenerateRemediationPlanTool, remediationPlanSchema as generateRemediationPlanSchema } from "./tools/remediationPlan.js";
import { createIgnoreDependencyTool, ignoreDependencySchema } from "./tools/ignoreDependency.js";
import type { Config } from "./config/cli.js";
import { createRetrieveSupportingDocumentsTool, retrieveSupportingDocumentsSchema } from "./tools/retrieveSupportingDocuments.js";
import { addRedhatRepositorySchema, createAddRedhatRepositoryTool } from "./tools/addRedHatRepository.js";
import {
  fixDependencyVulnerabilitiesArgsShape,
  createFixDependencyVulnerabilitiesPrompt,
} from "./prompts/fixDependencyVulnerabilities.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getTempDir,
  RHDA_SCAN_LATEST_FILE,
  RHDA_REMEDIATION_LATEST_FILE,
} from "./utils/temp.js";

const SCAN_LATEST_URI = "rhda://scan/latest";
const REMEDIATION_LATEST_URI = "rhda://remediation/latest";

const NO_SCAN_JSON = JSON.stringify(
  {
    error: "No scan result available.",
    hint: "Run analyze_dependency_vulnerabilities first to populate this resource.",
  },
  null,
  2
);

const NO_REMEDIATION_JSON = JSON.stringify(
  {
    error: "No remediation plan available.",
    hint: "Run generate_remediation_plan first to populate this resource.",
  },
  null,
  2
);

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
      description: `
Run a full dependency analysis: retrieves all dependencies (direct and transitive) and returns a JSON report of vulnerabilities per package (purl).

Use when the user wants to see current vulnerabilities, to fix them, or when you need the vulnerability report. The report is the source of truth for cve, packageRef (purl, scope, dependency_graph), 
and remediation.trustedContent used by explain_vulnerability and generate_remediation_plan. Always call this first before explain_vulnerability or generate_remediation_plan when fixing or explaining a CVE.

After analysis, do NOT assume or state that you will upgrade or patch a dependency—next step is to get the remediation plan, present its options to the user, and wait for user consent before any change.

Takes manifestPath (pom.xml, package.json, etc.); optional directOnly for direct deps only. The result is also written to a temp file and exposed as resource rhda://scan/latest for later queries.
      `.trim(),
      inputSchema: analyzeStackVulnerabilitiesSchema,
    },
    createAnalyzeStackVulnerabilitiesTool(config.backendUrl)
  );
  
  server.registerTool(
    "explain_vulnerability",
    {
      description: `
Get full intel for a CVE: gathers all available sources, generates claims, and analyzes impact.

Use when the user asks what a CVE is, to explain a vulnerability, or to understand impact. Requires cve and packageRef from analyze_dependency_vulnerabilities (do not use manifestPath here). 
Present the assessment (exploitability, impact, limitations, confidence, evidence-backed claims) to the user. This data is also used internally by generate_remediation_plan.
      `.trim(),
      inputSchema: explainVulnerabilitySchema,
    },
    createExplainVulnerabilityTool(config.intelServerUrl)
  );
  
  server.registerTool(
    "generate_remediation_plan",
    {
      description: `
Generate a remediation plan for a CVE and present it to the user for their decision.

**CRITICAL CONSTRAINT: After calling this tool you MUST present the options to the user and WAIT for their choice. You MUST NOT implement, search for versions, or read the stored plan until the user has chosen.**

The response includes:
- A formatted markdown report with:
  - STOP instruction at the very top
  - Overall risks
  - Recommended safe default option (with risks)
  - Available remediation options (numbered list)
  - Explicit "MUST NOT" constraints
  - The ONLY allowed action: present options and ask user to choose

**After calling this tool - REQUIRED BEHAVIOR:**
1. Present the markdown output to the user exactly as returned
2. Ask: "Which option do you want to implement (1, 2, 3, or the safe default)?"
3. STOP and WAIT for the user's reply
4. Do NOTHING else until user responds

**You MUST NOT (until user chooses):**
- Search for versions online or query package registries (npm, maven, etc.)
- Read the rhda://remediation/latest resource
- Make any file changes
- Run any commands
- Look up version numbers or release information

**When implementing (ONLY after user explicitly chooses an option):**
1. Read the rhda://remediation/latest resource to get detailed instructions
2. Find the matching action in plan.actions[] or plan.safe_defaults[]
3. Extract the instructions array from that action
4. Follow the **VERSION RULE**: Use the exact version from the chosen option's instructions (e.g. parameters.version)
   - Do NOT apply a major version upgrade unless the plan explicitly specifies it
   - Do NOT use a different minor/patch (e.g. plan says 7.5.4 → use 7.5.4, not 7.5.7 or ^7.5.4)
   - Do NOT use "latest" or any version from npm
   - The plan's version is the one validated for the CVE

Input: cve, packageRef, trustedContent when present. Full plan stored at rhda://remediation/latest.
      `.trim(),
      inputSchema: generateRemediationPlanSchema,
    },
    createGenerateRemediationPlanTool(config.intelServerUrl)
  );

  server.registerTool(
    "retrieve_supporting_documents",
    {
      description: `
Retrieves documents that support a claim.

Use when the user asks: "Why is this claim true?", "Prove this claim", "Explain this claim", "Why is this claim valid?", "Justify this claim", or similar. Requires claim or fact (to justify) and document (that supports the claim). 
Use after explain_vulnerability or generate_remediation_plan to retrieve the evidence items that support the claim the user asked about.
      `.trim(),
      inputSchema: retrieveSupportingDocumentsSchema,
    },
    createRetrieveSupportingDocumentsTool(config.intelServerUrl)
  );
  
  server.registerTool(
    "suppress_dependency_vulnerability",
    {
      description: `
Suppress or ignore a vulnerability finding when it's confirmed as a false positive or not applicable.

Use when you identify that a CVE is: "not applicable", "false positive", "does not affect this version", "only affects different version", or when the user EXPLICITLY asks to "ignore this vulnerability", "suppress this finding", 
"mark as false positive", "this CVE doesn't apply". Takes dependencyName and manifestPath to add the dependency to the ignore list. This does not fix the vulnerability—it only suppresses the finding from future scans. 
Use when a vulnerability is confirmed as not affecting the current setup (e.g. CVE-XXXX only affects version 3.x, but we're on 2.x).

IMPORTANT: Only call this tool when the user EXPLICITLY requests to suppress/ignore. Do NOT call automatically just because you identified a false positive—present the information to the user first and wait for their explicit instruction to suppress it.
      `.trim(),
      inputSchema: ignoreDependencySchema,
    },
    createIgnoreDependencyTool()
  );

  server.registerTool(
    "add_redhat_repository",
    {
      description: `
When a Red Hat remediation is available, add the Red Hat repository to the project.

Use when there is a Red Hat remediation available for the vulnerability and the user asks to add the Red Hat repository to the project.
      `.trim(),
      inputSchema: addRedhatRepositorySchema,
    },
    createAddRedhatRepositoryTool()
  );

  server.registerPrompt(
    "fix_dependency_vulnerabilities",
    {
      title: "Fix dependency vulnerabilities (Fix with AI)",
      description: `
Use when the user triggers "Fix with AI" on a manifest (e.g. pom.xml) or wants to fix vulnerabilities in dependencies.

Pass the manifest path and optionally the error/vulnerability snippet from the IDE. Returns instructions to analyze dependencies, pick the highest-severity CVE, generate a remediation plan, and present only the plan options (no automatic changes).
      `.trim(),
      argsSchema: fixDependencyVulnerabilitiesArgsShape,
    },
    createFixDependencyVulnerabilitiesPrompt()
  );

  server.registerResource(
    "latest_scan",
    SCAN_LATEST_URI,
    {
      description: `
Latest dependency analysis result (full report and formatted summary). Populated after analyze_dependency_vulnerabilities runs; stored in a temp file. Use for follow-up queries (e.g. highest CVE, affected packages) without re-running the analysis.
      `.trim(),
      mimeType: "application/json",
    },
    async (_uri, _extra) => {
      try {
        const tempDir = await getTempDir();
        const text = await readFile(
          join(tempDir, RHDA_SCAN_LATEST_FILE),
          "utf-8"
        );
        return {
          contents: [
            {
              uri: SCAN_LATEST_URI,
              mimeType: "application/json",
              text,
            },
          ],
        };
      } catch {
        return {
          contents: [
            {
              uri: SCAN_LATEST_URI,
              mimeType: "application/json",
              text: NO_SCAN_JSON,
            },
          ],
        };
      }
    }
  );

  server.registerResource(
    "latest_remediation",
    REMEDIATION_LATEST_URI,
    {
      description: `
Latest remediation plan with full implementation details (plan.options, plan.actions with instructions, plan.safe_defaults, plan.confirmation_risks, intel).

Populated after generate_remediation_plan runs. The tool returns a markdown summary for user display, but THIS resource contains the full JSON plan with detailed step-by-step instructions.

**When to read this resource:**
- After the user chooses a remediation option
- To get detailed implementation instructions (plan.actions[].instructions or plan.safe_defaults[].instructions)
- To extract specific version numbers, file paths, and commands to execute
- For follow-up queries about the plan details

**Do NOT read this before user approval** - the tool's markdown output is for presenting options first.
      `.trim(),
      mimeType: "application/json",
    },
    async (_uri, _extra) => {
      try {
        const tempDir = await getTempDir();
        const text = await readFile(
          join(tempDir, RHDA_REMEDIATION_LATEST_FILE),
          "utf-8"
        );
        return {
          contents: [
            {
              uri: REMEDIATION_LATEST_URI,
              mimeType: "application/json",
              text,
            },
          ],
        };
      } catch {
        return {
          contents: [
            {
              uri: REMEDIATION_LATEST_URI,
              mimeType: "application/json",
              text: NO_REMEDIATION_JSON,
            },
          ],
        };
      }
    }
  );

  return server;
}
