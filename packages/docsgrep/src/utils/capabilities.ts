import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface CapabilityStatus {
  git: boolean;
  npm: boolean;
  docker: boolean;
  osvScanner: boolean;
}

/**
 * Checks for the presence of external tools in the execution environment.
 * Handles the "gap" between different agent environments by identifying
 * available capabilities before attempting to use them.
 */
export async function checkCapabilities(): Promise<CapabilityStatus> {
  const status: CapabilityStatus = {
    git: false,
    npm: false,
    docker: false,
    osvScanner: false,
  };

  // Check git
  try {
    await execAsync("git --version");
    status.git = true;
  } catch (e) {
    // Git not available
  }

  // Check npm
  try {
    await execAsync("npm --version");
    status.npm = true;
  } catch (e) {
    // npm not available
  }

  // Check docker
  try {
    await execAsync("docker --version");
    status.docker = true;
  } catch (e) {
    // docker not available
  }

  // Check osv-scanner (OSS security specialist)
  try {
    await execAsync("osv-scanner --version");
    status.osvScanner = true;
  } catch (e) {
    // osv-scanner not available
  }

  return status;
}

/**
 * Returns a user-friendly message about missing tools and how to get them.
 */
export function getCapabilityGapMessage(status: CapabilityStatus): string[] {
  const missing: string[] = [];
  
  if (!status.git) {
    missing.push("Git is missing. Remote repository features and git-based audit will be limited.");
  }
  
  if (!status.osvScanner) {
    missing.push("OSV-Scanner is missing. Deep dependency vulnerability scanning is disabled. (Install: https://github.com/google/osv-scanner)");
  }
  
  return missing;
}
