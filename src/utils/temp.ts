import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string | null = null;

export async function getTempDir(): Promise<string> {
  if (!tempDir) {
    tempDir = await mkdtemp(join(tmpdir(), "rhda-mcp-"));
  }
  return tempDir;
}

