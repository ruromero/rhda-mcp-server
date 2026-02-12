import { z } from "zod";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
export const addRedhatRepositorySchema = z.object({
  packageManager: z.enum(["maven", "npm", "gradle", "go", "python", "rust"]).describe("Package manager used in the project")
});

export function createAddRedhatRepositoryTool(): ToolCallback<typeof addRedhatRepositorySchema> {
  return async (args) => {
    const { packageManager } = args;
    switch (packageManager) {
      case "maven":
      case "gradle":
        return {
          content: [
            { type: "text", text: `Check if the Red Hat repository is already in the project (pom.xml or build.gradle). Note that it can be added to the settings.xml file. If not, add a new repository to the project to use the Red Hat repository for the vulnerability. The repository url is 'https://maven.repository.redhat.com/ga/'` }
          ]
        }
      default:
        return {
          content: [
            { type: "text", text: `Unsupported package manager: ${packageManager}. This tool only supports Maven.` }
          ]
        }
    }
  }
}
