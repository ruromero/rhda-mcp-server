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

/** Filename for the latest scan result (in temp dir). Used by analyze tool and rhda://scan/latest resource. */
export const RHDA_SCAN_LATEST_FILE = "rhda-scan-latest.json";

/** Filename for the latest remediation plan (in temp dir). Used by remediation tool and rhda://remediation/latest resource. */
export const RHDA_REMEDIATION_LATEST_FILE = "rhda-remediation-latest.json";

