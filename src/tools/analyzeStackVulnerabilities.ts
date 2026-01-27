import { z } from "zod";
import client from "@trustify-da/trustify-da-javascript-client";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getTempDir } from "../utils/temp.js";
import { formatStackAnalysisOutput } from "../utils/formatting.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";

export const analyzeStackVulnerabilitiesSchema = z.object({
  manifestPath: z
    .string()
    .describe(
      "Path to package manager file (pom.xml, package.json, build.gradle, build.gradle.kts, go.mod, requirements.txt)"
    ),
  directOnly: z
    .boolean()
    .optional()
    .describe(
      "If true, analyze only direct dependencies. If false or omitted, analyze the whole stack"
    ),
});

export function createAnalyzeStackVulnerabilitiesTool(
  backendUrl: string
): ToolCallback<typeof analyzeStackVulnerabilitiesSchema> {
  return async (args) => {
    try {
      const { manifestPath, directOnly = false } = args;
      const options = {
        TRUSTIFY_DA_BACKEND_URL: backendUrl,
      };

      console.error(`[analyzeStackVulnerabilities] Starting analysis: manifestPath=${manifestPath}, directOnly=${directOnly}`);

      let report: any;
      try {
        if (directOnly) {
          console.error(`[analyzeStackVulnerabilities] Calling componentAnalysis for direct dependencies only`);
          report = await client.componentAnalysis(manifestPath, options);
          console.error(`[analyzeStackVulnerabilities] componentAnalysis completed successfully`);
        } else {
          console.error(`[analyzeStackVulnerabilities] Calling stackAnalysis for full stack`);
          report = await client.stackAnalysis(manifestPath, false, options);
          console.error(`[analyzeStackVulnerabilities] stackAnalysis completed successfully`);
        }
      } catch (analysisError: any) {
        console.error(`[analyzeStackVulnerabilities] Analysis call failed:`, {
          error: analysisError.message,
          stack: analysisError.stack,
          name: analysisError.name,
          cause: analysisError.cause,
          directOnly,
          manifestPath,
        });
        throw analysisError;
      }

      console.error(`[analyzeStackVulnerabilities] Report received, type: ${typeof report}, keys: ${report && typeof report === 'object' ? Object.keys(report).join(', ') : 'N/A'}`);

      // Save full JSON to temp directory
      const tempDirPath = await getTempDir();
      const timestamp = Date.now();
      const filename = `stack-analysis-${timestamp}.json`;
      const filepath = join(tempDirPath, filename);
      
      try {
        await writeFile(filepath, JSON.stringify(report, null, 2));
        console.error(`[analyzeStackVulnerabilities] Report saved to: ${filepath}`);
      } catch (writeError: any) {
        console.error(`[analyzeStackVulnerabilities] Failed to save report:`, writeError.message);
        throw writeError;
      }

      // Format output
      let formatted;
      try {
        formatted = formatStackAnalysisOutput(report, manifestPath, directOnly);
        console.error(`[analyzeStackVulnerabilities] Formatting completed successfully`);
      } catch (formatError: any) {
        console.error(`[analyzeStackVulnerabilities] Formatting failed:`, {
          error: formatError.message,
          stack: formatError.stack,
        });
        throw formatError;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                summary: formatted.summary,
                affectedPackages: formatted.affectedPackages,
                reportPath: filepath,
                fullReport: report,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      console.error(`[analyzeStackVulnerabilities] Error caught:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause,
        toString: error.toString(),
      });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message || "Failed to analyze stack vulnerabilities",
              errorType: error.name,
              stack: error.stack,
              details: error.cause ? String(error.cause) : undefined,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  };
}

