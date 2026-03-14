import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { PermissionSetTarget } from './types.js';

function runSfCommand(args: string): unknown {
  const result = execSync(`sf ${args} --json`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
  });
  const parsed = JSON.parse(result);
  if (parsed.status !== 0 && parsed.status !== undefined) {
    throw new Error(`sf command failed: ${parsed.message || JSON.stringify(parsed)}`);
  }
  return parsed.result;
}

export function fetchObjectList(): string[] {
  const result = runSfCommand('sobject list') as string[];
  return result.sort();
}

export function fetchFieldsForObject(objectName: string): string[] {
  const result = runSfCommand(`sobject describe --sobject ${objectName}`) as {
    fields: Array<{ name: string }>;
  };
  return result.fields.map((f) => `${objectName}.${f.name}`).sort();
}

function scanLocalPermissionSets(packageDirs: string[]): PermissionSetTarget[] {
  const targets: PermissionSetTarget[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = resolve(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.permissionset-meta.xml')) {
          const name = basename(entry, '.permissionset-meta.xml');
          targets.push({ name, filePath: fullPath, label: name });
        }
      } catch {
        // skip inaccessible entries
      }
    }
  }

  for (const dir of packageDirs) {
    walk(dir);
  }
  return targets;
}

function fetchOrgPermissionSets(): string[] {
  try {
    const result = runSfCommand(
      'data query --query "SELECT Name, Label FROM PermissionSet WHERE IsCustom = true"',
    ) as { records: Array<{ Name: string; Label: string }> };
    return result.records.map((r) => r.Name);
  } catch {
    return [];
  }
}

export function discoverPermissionSets(
  packageDirs: string[],
  defaultPackageDir: string,
): PermissionSetTarget[] {
  const localTargets = scanLocalPermissionSets(packageDirs);
  const localNames = new Set(localTargets.map((t) => t.name));

  const orgNames = fetchOrgPermissionSets();
  for (const name of orgNames) {
    if (!localNames.has(name)) {
      // Permission set exists in org but not locally — will create a new file
      const filePath = join(
        defaultPackageDir,
        'main',
        'default',
        'permissionsets',
        `${name}.permissionset-meta.xml`,
      );
      localTargets.push({ name, filePath, label: name });
    }
  }

  return localTargets.sort((a, b) => a.name.localeCompare(b.name));
}
