import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const retrieveSupportingDocumentsSchema = z.array(z.object({
  id: z.string().describe("ID of the evidence item."),
  source: z.string().describe("Source of the evidence item."),
})).describe("Evidence items that support a claim or fact.");

interface Evidence {
  items: EvidenceItem[];
}

interface EvidenceItem {
  id: string;
  source: string;
}

interface ReferenceDocument {
  id: string;
  source: string;
  title: string;
  content: string;
  retrieved_from: string;
  retriever_type: string;
  canonical_url: string;
  content_type: string;
}

async function retrieveSupportingDocuments(
  intelServerUrl: string,
  evidence: EvidenceItem[],
): Promise<ReferenceDocument[]> {
  const documentPromises = evidence.map(async (item) => {
    const url = `${intelServerUrl}/v1/documents/${item.id}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to retrieve document ${item.id}: ${response.statusText}`);
    }
    
    const data = await response.json() as ReferenceDocument;
    return data;
  });
  
  // Wait for all requests to complete concurrently
  const documents = await Promise.all(documentPromises);
  return documents;
}

export function createRetrieveSupportingDocumentsTool(
  intelServerUrl: string,
): ToolCallback<typeof retrieveSupportingDocumentsSchema> {
  return async (args, _extra) => {
    try {
      const evidence = args;
      if (!evidence || evidence.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Missing required parameter: evidence. Claims are supported by evidence which are references to supporting documents.." }, null, 2),
              hint: "Workflow: 1) Call explain_vulnerability or generate_remediation_plan to get the claim or fact 2) Call retrieve_supporting_documents with the claim or fact",
            },
          ],
          isError: true,
        };
      }
      const documents = await retrieveSupportingDocuments(
        intelServerUrl,
        evidence,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(documents, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: error.message || "Failed to retrieve supporting documents" }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
}
