#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { validateEnvironment, getPackageDirectories } from './env.js';
import { fetchObjectList, fetchFieldsForObject, discoverLocalPermissionSets } from './org-fetch.js';
import {
  promptObjectSearch,
  promptFieldSearch,
  promptPermissionMode,
  promptObjectPermissions,
  promptFieldPermissions,
  promptPermissionSetSelection,
  printPreview,
  promptConfirm,
} from './prompts.js';
import { resolveObjectDependencies, resolveFieldDependencies } from './dependencies.js';
import {
  parsePermissionSetXml,
  createEmptyPermissionSet,
  applyObjectPermission,
  applyFieldPermission,
  serializePermissionSetXml,
  writePermissionSetFile,
  detectIndentation,
} from './xml-mutator.js';
import type {
  SelectionItem,
  PermissionChange,
  ObjectPermissions,
  FieldPermissions,
} from './types.js';

const OBJECT_PERM_LABEL_MAP: Record<string, string> = {
  allowRead: 'Read',
  allowCreate: 'Create',
  allowEdit: 'Edit',
  allowDelete: 'Delete',
  viewAllRecords: 'View All',
  modifyAllRecords: 'Modify All',
};

const FIELD_PERM_LABEL_MAP: Record<string, string> = {
  readable: 'Read',
  editable: 'Edit',
};

// Handle --version and --help
const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-v')) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
  console.log(pkg.version);
  process.exit(0);
}
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
permcraft — Interactive Salesforce permission set editor

Usage: permcraft

Interactively select objects, fields, and permissions, then apply
them to one or more permission set XML files in your SFDX project.

Options:
  -h, --help     Show this help message
  -v, --version  Show version number

Requirements:
  - Must be run inside an SFDX project (sfdx-project.json)
  - Must have an authenticated Salesforce org (sf org login web)
`);
  process.exit(0);
}

async function main(): Promise<void> {
  console.log('Permcraft — Salesforce Permission Set Editor\n');

  // Step 0: Validate environment
  console.log('Checking environment...');
  const { projectRoot, project, org } = validateEnvironment();
  console.log(`  Project: ${projectRoot}`);
  console.log(`  Org: ${org.username}\n`);

  const packageDirs = getPackageDirectories(project, projectRoot);

  // Step 1: Fetch object list from org
  console.log('Fetching objects from org...');
  const objects = fetchObjectList();
  console.log(`Found ${objects.length} objects.\n`);

  // Step 2: Fuzzy search and select objects
  const selectedObjects = await promptObjectSearch(objects);
  console.log(`\nSelected objects: ${selectedObjects.join(', ')}`);

  // Step 3: For each object, fetch fields and fuzzy search to select
  const allSelections: SelectionItem[] = [];

  for (const obj of selectedObjects) {
    allSelections.push({ type: 'object', name: obj });

    console.log(`\nFetching fields for ${obj}...`);
    const fields = fetchFieldsForObject(obj);
    console.log(`Found ${fields.length} fields.`);

    const selectedFields = await promptFieldSearch(obj, fields);
    for (const field of selectedFields) {
      allSelections.push({ type: 'field', name: field, object: obj });
    }
  }

  // Step 4: Choose permission mode and assign permissions
  const changes: PermissionChange[] = [];
  const objectSelections = allSelections.filter((s) => s.type === 'object');
  const fieldSelections = allSelections.filter((s) => s.type === 'field');

  const hasMultipleItems = objectSelections.length + fieldSelections.length > 1;
  const mode = hasMultipleItems ? await promptPermissionMode() : 'bulk';

  if (mode === 'bulk') {
    // Same permissions for all objects, same permissions for all fields
    if (objectSelections.length > 0) {
      console.log();
      const rawPerms = await promptObjectPermissions(objectSelections.map((s) => s.name));
      const { resolved, autoEnabled } = resolveObjectDependencies(rawPerms);
      const autoLabels = autoEnabled.map((k) => OBJECT_PERM_LABEL_MAP[k] || k);
      if (autoLabels.length > 0) {
        console.log(`  Auto-enabled dependencies: ${autoLabels.join(', ')}`);
      }
      for (const sel of objectSelections) {
        changes.push({ selection: sel, permissions: resolved, autoEnabled: autoLabels });
      }
    }

    if (fieldSelections.length > 0) {
      console.log();
      const rawPerms = await promptFieldPermissions(fieldSelections.map((s) => s.name));
      const { resolved, autoEnabled } = resolveFieldDependencies(rawPerms);
      const autoLabels = autoEnabled.map((k) => FIELD_PERM_LABEL_MAP[k] || k);
      if (autoLabels.length > 0) {
        console.log(`  Auto-enabled dependencies: ${autoLabels.join(', ')}`);
      }
      for (const sel of fieldSelections) {
        changes.push({ selection: sel, permissions: resolved, autoEnabled: autoLabels });
      }
    }
  } else {
    // Granular: individual permissions for each object and field
    for (const sel of objectSelections) {
      console.log();
      const rawPerms = await promptObjectPermissions([sel.name]);
      const { resolved, autoEnabled } = resolveObjectDependencies(rawPerms);
      const autoLabels = autoEnabled.map((k) => OBJECT_PERM_LABEL_MAP[k] || k);
      if (autoLabels.length > 0) {
        console.log(`  Auto-enabled dependencies: ${autoLabels.join(', ')}`);
      }
      changes.push({ selection: sel, permissions: resolved, autoEnabled: autoLabels });
    }

    for (const sel of fieldSelections) {
      console.log();
      const rawPerms = await promptFieldPermissions([sel.name]);
      const { resolved, autoEnabled } = resolveFieldDependencies(rawPerms);
      const autoLabels = autoEnabled.map((k) => FIELD_PERM_LABEL_MAP[k] || k);
      if (autoLabels.length > 0) {
        console.log(`  Auto-enabled dependencies: ${autoLabels.join(', ')}`);
      }
      changes.push({ selection: sel, permissions: resolved, autoEnabled: autoLabels });
    }
  }

  if (changes.length === 0) {
    console.log('No permissions selected. Exiting.');
    process.exit(0);
  }

  // Step 5: Select local permission sets
  console.log('\nScanning local permission sets...');
  const allTargets = discoverLocalPermissionSets(packageDirs);
  console.log(`Found ${allTargets.length} permission sets.\n`);

  const selectedTargets = await promptPermissionSetSelection(allTargets);

  // Step 6: Preview
  printPreview(changes, selectedTargets);

  // Step 7: Confirm and apply
  const confirmed = await promptConfirm();
  if (!confirmed) {
    console.log('Cancelled.');
    process.exit(0);
  }

  console.log('\nApplying changes...\n');

  for (const target of selectedTargets) {
    const filePath = target.filePath!;
    let parsed;
    let indent = '    ';

    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      indent = detectIndentation(content);
      parsed = parsePermissionSetXml(filePath);
      console.log(`  Updating ${filePath}`);
    } else {
      parsed = createEmptyPermissionSet(target.name, target.label);
      console.log(`  Creating ${filePath}`);
    }

    for (const change of changes) {
      if (change.selection.type === 'object') {
        applyObjectPermission(
          parsed,
          change.selection.name,
          change.permissions as ObjectPermissions,
        );
      } else {
        applyFieldPermission(parsed, change.selection.name, change.permissions as FieldPermissions);
      }
    }

    const xml = serializePermissionSetXml(parsed, indent);
    writePermissionSetFile(filePath, xml);
  }

  console.log('\nAll changes applied successfully!');
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
