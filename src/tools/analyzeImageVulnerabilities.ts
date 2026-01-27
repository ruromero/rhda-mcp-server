import { z } from "zod";
import client from "@trustify-da/trustify-da-javascript-client";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getTempDir } from "../utils/temp.js";
import { formatStackAnalysisOutput } from "../utils/formatting.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";

export const analyzeImageVulnerabilitiesSchema = z.object({
  imageRef: z
    .string()
    .describe(
      "Container image reference to analyze (e.g., registry.access.redhat.com/ubi9/nodejs-20:latest or httpd:2.4.49^^amd64)"
    ),
});

export function createAnalyzeImageVulnerabilitiesTool(
  backendUrl: string
): ToolCallback<typeof analyzeImageVulnerabilitiesSchema> {
  return async (args) => {
    try {
      const { imageRef } = args;
      const options = {
        TRUSTIFY_DA_BACKEND_URL: backendUrl,
      };

      const report = await client.imageAnalysis([imageRef], false, options);

      // Save full JSON to temp directory
      const tempDirPath = await getTempDir();
      const timestamp = Date.now();
      const filename = `image-analysis-${timestamp}.json`;
      const filepath = join(tempDirPath, filename);
      await writeFile(filepath, JSON.stringify(report, null, 2));

      // Format output similar to stack analysis
      // The report is a batch report where keys are image refs
      const imageReport = report[imageRef] || report;
      const formatted = formatStackAnalysisOutput(imageReport, imageRef, false);

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
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message || "Failed to analyze image vulnerabilities",
            }),
          },
        ],
        isError: true,
      };
    }
  };
}

