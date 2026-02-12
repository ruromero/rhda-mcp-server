import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTempDir, RHDA_REMEDIATION_LATEST_FILE } from "../utils/temp.js";

export const remediationPlanSchema = z.object({
  cve: z.string().describe("CVE ID (e.g., CVE-2024-2700). This must be obtained from analyze_dependency_vulnerabilities first - you cannot use manifestPath here."),
  packageRef: z.object({
    purl: z.string().describe("Package URL (purl) from the report, e.g. pkg:maven/org.postgresql/postgresql@42.7.1. Must be obtained from analyze_dependency_vulnerabilities (dependency ref or issue context)."),
    scope: z.enum(["runtime", "development", "test", "build"]).describe("Dependency scope"),
    dependency_graph: z.array(z.string()).describe("Dependency graph: array of purls for parent dependencies if transitive. From the report."),
  }),
  trustedContent: z
    .string()
    .optional()
    .describe(
      "When the report has remediation.trustedContent.ref for this CVE (e.g. Red Hat patched version like pkg:maven/...@2.12.6.1-redhat-00004?type=jar), pass that exact string here. Look in fullReport: for the dependency and issue matching this CVE, use issue.remediation.trustedContent.ref if present. Required to get vendor remediation options in the plan."
    ),
});

interface RemediationPlanResponse {
  plan: any;
  intel: any;
}

async function generateRemediationPlan(
  intelServerUrl: string,
  cve: string,
  packageRef: {
    purl: string,
    scope: "runtime" | "development" | "test" | "build",
    dependency_graph: string[],
  },
  trustedContent: string | null,
): Promise<RemediationPlanResponse> {
  const url = `${intelServerUrl}/v1/vulnerability/remediation_plan`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cve,
      package: packageRef,
      trusted_content: trustedContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to get remediation plan: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as { plan: any; intel: any };
  return {
    plan: data.plan,
    intel: data.intel,
  };
}

function formatRemediationPlanAsMarkdown(
  cve: string,
  plan: any,
  intel: any,
  tempDirPath: string
): string {
  const parts: string[] = [];

  // CRITICAL: Put STOP instruction at the very top
  parts.push("## STOP - DO NOT IMPLEMENT");
  parts.push("");
  parts.push("**You MUST NOT implement any changes, search for versions, or read the stored plan yet.**");
  parts.push("");
  parts.push("**The ONLY action allowed:** Present the options below and ask the user which one to implement.");
  parts.push("");
  parts.push("---");
  parts.push("");

  parts.push(`# Remediation Plan for ${cve}`);
  parts.push("");

  // Package info
  if (intel?.intel?.package_identity?.purl) {
    parts.push(`**Package:** ${intel.intel.package_identity.purl}`);
    parts.push("");
  }

  // Check if plan is applicable
  if (plan.applicable === false) {
    parts.push("## No Remediation Available");
    parts.push("");
    parts.push("No applicable remediation options are available for this vulnerability.");
    return parts.join("\n");
  }

  // Plan-level confirmation risks (shown prominently at the top)
  if (plan.confirmation_risks && plan.confirmation_risks.length > 0) {
    parts.push("## Overall Risks");
    parts.push("");
    plan.confirmation_risks.forEach((risk: string) => {
      parts.push(`- ${risk}`);
    });
    parts.push("");
  }

  // Safe defaults (recommended option) - name and risks only
  if (plan.safe_defaults && plan.safe_defaults.length > 0) {
    parts.push("## Recommended Safe Default");
    parts.push("");
    const safeDefault = plan.safe_defaults[0];
    parts.push(`**${safeDefault.kind}** - ${safeDefault.description}`);
    parts.push("");

    if (safeDefault.confirmation_risks && safeDefault.confirmation_risks.length > 0) {
      parts.push("**Risks:**");
      safeDefault.confirmation_risks.forEach((risk: string) => {
        parts.push(`- ${risk}`);
      });
      parts.push("");
    }
  }

  // All available options - simple list only
  if (plan.options && plan.options.length > 0) {
    parts.push("## Available Remediation Options");
    parts.push("");
    plan.options.forEach((option: any, index: number) => {
      parts.push(`${index + 1}. **${option.kind}** (${option.certainty || 'unknown'} confidence) - ${option.description}`);
    });
    parts.push("");
  }

  // Critical stop message - reinforced
  parts.push("---");
  parts.push("");
  parts.push("## STOP - User Decision Required");
  parts.push("");
  parts.push("**The ONLY action allowed now:**");
  parts.push("Present the options above to the user and ask: 'Which option do you want to implement (1, 2, 3, or the safe default)?'");
  parts.push("");
  parts.push("Then **WAIT for the user's reply.** Do nothing else.");
  parts.push("");
  parts.push("**You MUST NOT:**");
  parts.push("- Search for versions online or query npm/package registries");
  parts.push("- Read the `rhda://remediation/latest` resource before the user chooses");
  parts.push("- Make any file changes (package.json, pom.xml, etc.)");
  parts.push("- Run any commands (npm install, mvn, etc.)");
  parts.push("- Look up version numbers or release information");
  parts.push("");
  parts.push("**After user chooses (workflow):**");
  parts.push("1. Read the `rhda://remediation/latest` resource");
  parts.push("2. Find the matching action in `plan.actions[]` or `plan.safe_defaults[]`");
  parts.push("3. Extract the `instructions` array from that action");
  parts.push("4. Implement those instructions exactly (following the VERSION RULE)");
  parts.push("");
  parts.push("---");
  parts.push("");
  parts.push("**Your next reply MUST only present the options and ask the user to choose. Do not implement, do not search for versions, do not read the plan yet.**");

  return parts.join("\n");
}

export function generateRemediationPlanTool(
  intelServerUrl: string
): ToolCallback<typeof remediationPlanSchema> {
  return async (args, _extra) => {
    try {
      const { cve, packageRef, trustedContent } = args;
      
      // Validate that required parameters are present
      if (!cve || !packageRef) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Missing required parameters: cve and packageRef are required. This tool requires specific vulnerability details obtained from analyze_dependency_vulnerabilities. You cannot use manifestPath here - first call analyze_dependency_vulnerabilities with your manifestPath, then use the cve and packageRef from those results.",
                hint: "Workflow: 1) Call analyze_dependency_vulnerabilities with manifestPath 2) Extract cve and packageRef from results 3) Call generate_remediation_plan with those values",
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
      
      const remediationResult = await generateRemediationPlan(
        intelServerUrl,
        cve,
        packageRef,
        trustedContent ?? null,
      );

      const tempDirPath = await getTempDir();
      await writeFile(
        join(tempDirPath, RHDA_REMEDIATION_LATEST_FILE),
        JSON.stringify(
          {
            cve,
            packageRef: {
              purl: packageRef.purl,
              scope: packageRef.scope,
              dependency_graph: packageRef.dependency_graph ?? [],
            },
            storedAt: new Date().toISOString(),
            plan: remediationResult.plan,
            intel: remediationResult.intel,
          },
          null,
          2
        )
      );

      // Format as markdown for user presentation
      const markdown = formatRemediationPlanAsMarkdown(
        cve,
        remediationResult.plan,
        remediationResult.intel,
        tempDirPath
      );

      return {
        content: [
          {
            type: "text",
            text: markdown,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message || "Failed to get remediation plan",
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  };
}

