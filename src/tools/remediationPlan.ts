import { z } from "zod";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";

export const remediationPlanSchema = z.object({
  cve: z.string().describe("CVE ID (e.g., CVE-2024-2700). This must be obtained from analyze_dependency_vulnerabilities first - you cannot use manifestPath here."),
  packageRef: z.object({
    purl: z.url().describe("Dependency purl to identify the package (e.g., pkg:maven/org.postgresql/postgresql@42.7.1). This must be obtained from analyze_dependency_vulnerabilities first."),
    scope: z.enum(["runtime", "development", "test", "build"]).describe("Dependency scope"),
    dependency_graph: z.array(z.url()).describe("Dependency graph representing the parent dependencies of the package in case it is a transitive dependency"),
  }),
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

export function generateRemediationPlanTool(
  intelServerUrl: string
): ToolCallback<typeof remediationPlanSchema> {
  return async (args, _extra) => {
    try {
      const { cve, packageRef } = args;
      
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
        packageRef);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                plan: remediationResult.plan,
                intel: remediationResult.intel,
              },
              null,
              2
            ),
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

