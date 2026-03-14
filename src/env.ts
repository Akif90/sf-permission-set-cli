import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OrgInfo, SfdxProject } from './types.js';

export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = startDir;
  while (true) {
    if (existsSync(resolve(dir, 'sfdx-project.json'))) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) {
      throw new Error(
        'Not inside a Salesforce DX project. No sfdx-project.json found.\n' +
          'Run this command from within an SFDX project directory.',
      );
    }
    dir = parent;
  }
}

export function readSfdxProject(projectRoot: string): SfdxProject {
  const filePath = resolve(projectRoot, 'sfdx-project.json');
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as SfdxProject;
}

export function getPackageDirectories(project: SfdxProject, projectRoot: string): string[] {
  return project.packageDirectories.map((d) => resolve(projectRoot, d.path));
}

export function getAuthenticatedOrg(): OrgInfo {
  try {
    const result = execSync('sf org display --json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(result);
    if (parsed.status !== 0) {
      throw new Error(parsed.message || 'Failed to get org info');
    }
    const { username, id: orgId, instanceUrl } = parsed.result;
    return { username, orgId, instanceUrl };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('No default org found')) {
      throw new Error(
        'No authenticated Salesforce org found.\n' +
          'Run `sf org login web` or `sf config set target-org <alias>` first.',
      );
    }
    throw new Error(
      'Failed to connect to Salesforce org. Ensure `sf` CLI is installed and you have an authenticated org.\n' +
        `Details: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function validateEnvironment(): { projectRoot: string; project: SfdxProject; org: OrgInfo } {
  const projectRoot = findProjectRoot();
  const project = readSfdxProject(projectRoot);
  const org = getAuthenticatedOrg();
  return { projectRoot, project, org };
}
