import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";

export const ignoreDependencySchema = z.object({
  dependencyName: z.string().describe("Dependency name to ignore"),
  manifestPath: z
    .string()
    .describe("Path to the manifest file where the dependency is declared"),
});

export function createIgnoreDependencyTool(): ToolCallback<
  typeof ignoreDependencySchema
> {
  return async (args) => {
    try {
      const { dependencyName, manifestPath } = args;

      // Read the manifest file
      const manifestContent = await readFile(manifestPath, "utf-8");

      // Pattern matching for manifest types
      const getManifestConfig = (path: string) => {
        if (path.endsWith("package.json")) {
          return { type: "json", commentFormat: null, canUpdate: true };
        }
        if (path.endsWith("pom.xml")) {
          return { type: "xml", commentFormat: "<!--trustify-da-ignore-->", canUpdate: false };
        }
        if (path.endsWith("go.mod")) {
          return { type: "go", commentFormat: "//trustify-da-ignore", canUpdate: false };
        }
        if (path.endsWith("requirements.txt")) {
          return { type: "python", commentFormat: "#trustify-da-ignore", canUpdate: false };
        }
        if (path.endsWith("build.gradle") || path.endsWith("build.gradle.kts")) {
          return { type: "gradle", commentFormat: "//trustify-da-ignore", canUpdate: false };
        }
        if (path.endsWith("Cargo.toml")) {
          return { type: "toml", commentFormat: "#trustify-da-ignore", canUpdate: false };
        }
        return null;
      };

      const config = getManifestConfig(manifestPath);
      if (!config) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Unsupported manifest type: ${manifestPath}`,
              }),
            },
          ],
          isError: true,
        };
      }

      let updatedContent: string = manifestContent;
      let updated = false;

      switch (config.type) {
        case "json": {
          // NPM: Add to trustify-da-ignore array
          const pkg = JSON.parse(manifestContent);
          if (!pkg["trustify-da-ignore"]) {
            pkg["trustify-da-ignore"] = [];
          }
          if (!pkg["trustify-da-ignore"].includes(dependencyName)) {
            pkg["trustify-da-ignore"].push(dependencyName);
            updated = true;
          }
          updatedContent = JSON.stringify(pkg, null, 2);
          break;
        }
        case "xml":
        case "go":
        case "python":
        case "gradle":
        case "toml": {
          // For formats that need manual comment addition
          // updatedContent already set to manifestContent
          break;
        }
      }

      // For JSON (package.json), we can actually update it
      if (config.canUpdate && updated) {
        await writeFile(manifestPath, updatedContent, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: `Dependency ${dependencyName} has been added to the trustify-da-ignore list in ${manifestPath}`,
                updated: true,
              }),
            },
          ],
        };
      } else {
        // For other formats, return instructions
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: `To ignore ${dependencyName}, add the comment "${config.commentFormat}" next to the dependency declaration in ${manifestPath}`,
                instruction: `Add "${config.commentFormat}" as a comment next to ${dependencyName} in ${manifestPath}`,
                updated: false,
              }),
            },
          ],
        };
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message || "Failed to ignore dependency",
            }),
          },
        ],
        isError: true,
      };
    }
  };
}

