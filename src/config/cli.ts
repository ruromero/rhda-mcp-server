export interface Config {
  backendUrl: string;
  intelServerUrl: string;
}

export function parseCliArgs(): Config {
  const args = process.argv.slice(2);
  let backendUrl: string | undefined;
  let intelServerUrl: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--backend-url" && i + 1 < args.length) {
      backendUrl = args[i + 1];
      i++;
    } else if (args[i] === "--intel-server-url" && i + 1 < args.length) {
      intelServerUrl = args[i + 1];
      i++;
    }
  }

  if (!backendUrl) {
    console.error("Error: --backend-url is required");
    process.exit(1);
  }
  if (!intelServerUrl) {
    console.error("Error: --intel-server-url is required");
    process.exit(1);
  }

  return {
    backendUrl,
    intelServerUrl,
  };
}

