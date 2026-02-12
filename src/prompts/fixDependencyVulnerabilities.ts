import { z } from "zod";
import type { PromptCallback } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Raw shape for the "Fix with AI" prompt args (registerPrompt expects this shape, not a ZodObject).
 */
export const fixDependencyVulnerabilitiesArgsShape = {
  manifestPath: z
    .string()
    .describe(
      "Path to the manifest file (e.g. pom.xml, package.json). This is the file the user is fixing."
    ),
  errorContent: z
    .string()
    .optional()
    .describe(
      "Optional vulnerability/error snippet from the IDE (e.g. dependency list and CVE lines). Use this to identify the highest-severity CVE when present."
    ),
  fileContext: z
    .string()
    .optional()
    .describe(
      "Optional file location hint (e.g. pom.xml:22-25) for where the user is focused."
    ),
};

export const fixDependencyVulnerabilitiesArgsSchema =
  z.object(fixDependencyVulnerabilitiesArgsShape);

export type FixDependencyVulnerabilitiesArgs = z.infer<
  typeof fixDependencyVulnerabilitiesArgsSchema
>;

const REMEDIATION_WORKFLOW_INSTRUCTIONS = `
You MUST follow this workflow exactly:

1. **Analyze**
   Call \`analyze_dependency_vulnerabilities\` with manifestPath: "{{manifestPath}}" to get the full vulnerability report. This report is the source of truth for all CVE and packageRef values.

2. **Choose target**
   From the report, identify the **highest-severity vulnerability** (Critical > High > Medium > Low). If the user provided an error snippet with specific CVEs (e.g. CVE-2020-36518), prefer that CVE when it appears in the report.

3. **Remediation plan**
   Call \`generate_remediation_plan\` with:
   - \`cve\`: the CVE ID from the report
   - \`packageRef\`: the exact package object from the report (purl, scope, dependency_graph)
   - \`trustedContent\`: when the report has a recommended vendor fix, pass it. In the fullReport, find the dependency and the issue whose id matches this CVE; if that issue has \`remediation.trustedContent.ref\` (e.g. \`pkg:maven/...@2.12.6.1-redhat-00004?type=jar\`), pass that exact string as \`trustedContent\` so the plan includes the Red Hat (or other vendor) option.

4. **Present the plan and STOP - YOU MUST NOT IMPLEMENT**
   The \`generate_remediation_plan\` tool returns a formatted markdown report that includes:
   - STOP instruction at the very top
   - Overall risks
   - Recommended safe default option (with risks)
   - Available remediation options (numbered list)
   - Explicit "MUST NOT" constraints

   After calling \`generate_remediation_plan\`:
   - **Present the markdown output to the user exactly as returned**
   - **Ask: "Which option do you want to implement (1, 2, 3, or the safe default)?"**
   - **STOP and WAIT for the user's reply**
   - Do NOTHING else until user responds

   **You MUST NOT (until user chooses):**
   - Search for versions online or query package registries (npm, maven, etc.)
   - Read the \`rhda://remediation/latest\` resource
   - Modify package.json, pom.xml, or any manifest file
   - Run npm install, mvn, or any command
   - Look up version numbers or release information

   **Only after the user explicitly chooses an option:**
   1. Read the \`rhda://remediation/latest\` resource to get the full JSON plan with detailed instructions
   2. Find the matching action in \`plan.actions[]\` or \`plan.safe_defaults[]\`
   3. Extract the specific \`instructions\` array for the chosen option
   4. Implement following the **VERSION RULE** below

   **VERSION RULE (mandatory when implementing):**
   - The version to apply is the one in the chosen option's \`instructions\` (e.g. \`parameters.version\`, \`parameters.new_version\`). Use that exact value.
   - Do NOT upgrade to a higher major version (e.g. if the plan says 7.5.4, do NOT set 8.x or "latest").
   - Do NOT use a different minor/patch (e.g. if the plan says 7.5.4, do NOT set 7.5.7 or ^7.5.4). Use the exact version from the plan.
   - Do NOT look up or use "latest" from npm or anywhere else. The plan's version is the one that has been validated for the CVE.
`.trim();

function buildPromptText(args: FixDependencyVulnerabilitiesArgs): string {
  const parts: string[] = [];

  if (args.errorContent) {
    parts.push(
      "For the code present, we get this error:",
      "```",
      args.errorContent.trim(),
      "```",
      ""
    );
  }

  parts.push(
    "Fix it, verify, and then give a concise explanation." +
      (args.fileContext ? ` ${args.fileContext}` : ""),
    "",
    "---",
    "",
    REMEDIATION_WORKFLOW_INSTRUCTIONS.replace(
      "{{manifestPath}}",
      args.manifestPath
    )
  );

  return parts.join("\n");
}

/**
 * Prompt callback for "Fix with AI" from a manifest.
 * Returns a single user message that instructs the model to run the full
 * analyze → pick highest CVE → generate_remediation_plan → present options only workflow.
 */
function fixDependencyVulnerabilitiesPromptCallback(
  args: FixDependencyVulnerabilitiesArgs,
  _extra: unknown
) {
  const text = buildPromptText(args);
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text,
        },
      },
    ],
  };
}

/**
 * Creates the prompt callback for "Fix with AI". Exposed as a factory for consistency with tools.
 */
export function createFixDependencyVulnerabilitiesPrompt(): PromptCallback<
  typeof fixDependencyVulnerabilitiesArgsShape
> {
  return fixDependencyVulnerabilitiesPromptCallback as PromptCallback<
    typeof fixDependencyVulnerabilitiesArgsShape
  >;
}
