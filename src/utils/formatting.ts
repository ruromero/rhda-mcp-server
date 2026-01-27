export interface FormattedOutput {
  summary: string;
  affectedPackages: string[];
}

export function formatStackAnalysisOutput(
  report: any,
  manifestPath: string,
  directOnly: boolean
): FormattedOutput {
  console.error(`[formatStackAnalysisOutput] Starting formatting: directOnly=${directOnly}, report type: ${typeof report}`);
  
  if (!report || typeof report !== "object") {
    console.error(`[formatStackAnalysisOutput] Invalid report:`, { report, type: typeof report });
    throw new Error(`Invalid report format: expected object, got ${typeof report}`);
  }

  const summaries: string[] = [];
  const affectedPackages: string[] = [];

  summaries.push(
    `The Red Hat Dependency Analytics report shows that your ${manifestPath} has the following vulnerabilities.\n`
  );

  // Extract summaries from each provider
  const reportKeys = Object.keys(report);
  console.error(`[formatStackAnalysisOutput] Report keys: ${reportKeys.join(', ')}`);
  
  // Handle case where componentAnalysis might return a different structure
  // It might return a single object with summary/dependencies directly, not nested by provider
  let hasProviderStructure = false;
  for (const [key, value] of Object.entries(report)) {
    if (typeof value === "object" && value !== null && "summary" in value) {
      hasProviderStructure = true;
      break;
    }
  }

  let reportToProcess = report;
  if (!hasProviderStructure && "summary" in report) {
    // componentAnalysis likely returns a flat structure
    console.error(`[formatStackAnalysisOutput] Detected flat structure (componentAnalysis), wrapping in provider structure`);
    const data = report;
    const provider = "component-analysis";
    reportToProcess = { [provider]: data };
  }
  
  for (const [provider, data] of Object.entries(reportToProcess)) {
    console.error(`[formatStackAnalysisOutput] Processing provider: ${provider}`);
    if (typeof data === "object" && data !== null && "summary" in data) {
      const summary = (data as any).summary;
      if (summary && typeof summary === "object") {
        const total = summary.total || 0;
        const direct = summary.direct || 0;
        const transitive = summary.transitive || 0;
        const dependencies = summary.dependencies || 0;
        const critical = summary.critical || 0;
        const high = summary.high || 0;
        const medium = summary.medium || 0;
        const low = summary.low || 0;

        if (total > 0) {
          summaries.push(
            `\`${provider}\` Has found a total of ${total} Vulnerabilities (${direct} direct / ${transitive} transitive) in ${dependencies} different dependencies`
          );
          if (critical > 0) summaries.push(`* Critical: ${critical}`);
          if (high > 0) summaries.push(`* High: ${high}`);
          if (medium > 0) summaries.push(`* Medium: ${medium}`);
          if (low > 0) summaries.push(`* Low: ${low}`);
          summaries.push("");
        }
      }
    }

    // Extract affected packages
    if (typeof data === "object" && data !== null && "dependencies" in data) {
      const deps = (data as any).dependencies;
      if (Array.isArray(deps)) {
        for (const dep of deps) {
          if (dep.ref && dep.issues && Array.isArray(dep.issues)) {
            for (const issue of dep.issues) {
              if (issue.id) {
                const depName = dep.ref;
                const hierarchy = dep.transitive
                  ? `${dep.ref} -> ${dep.transitive}`
                  : dep.ref;
                affectedPackages.push(`${hierarchy} (${issue.id})`);
              }
            }
          }
        }
      }
    }
  }

  if (affectedPackages.length > 0) {
    summaries.push("\nThe affected packages are:\n");
    affectedPackages.forEach((pkg) => {
      summaries.push(`* ${pkg}`);
    });
  }

  summaries.push(
    "\nDo you want me to address any vulnerability or dependency in particular or prefer to know more about a given CVE?"
  );

  return {
    summary: summaries.join("\n"),
    affectedPackages,
  };
}

