#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { validateEnvironment, getPackageDirectories } from './env.js';
import { fetchObjectList, fetchFieldsForObject, discoverPermissionSets } from './org-fetch.js';
import {
  promptObjectSelection,
  promptFieldSelection,
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
  OBJECT_PERMISSION_LABELS,
} from './types.js';
import { readFileSync } from 'node:fs';

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
  console.log('🔧 Permcraft — Salesforce Permission Set Editor\n');

  // Step 0: Validate environment
  console.log('Checking environment...');
  const { projectRoot, project, org } = validateEnvironment();
  console.log(`✓ SFDX project found at ${projectRoot}`);
  console.log(`✓ Connected to org: ${org.username}\n`);

  const packageDirs = getPackageDirectories(project, projectRoot);
  const defaultPackageDir = packageDirs[0];

  // Step 1: Fetch and select objects
  console.log('Fetching objects from org...');
  const objects = fetchObjectList();
  console.log(`Found ${objects.length} objects.\n`);

  const selectedObjects = await promptObjectSelection(objects);

  // Step 1b: Fetch fields for selected objects and optionally select fields
  const allSelections: SelectionItem[] = [];
  const selectedFieldsByObject: Map<string, string[]> = new Map();

  for (const obj of selectedObjects) {
    allSelections.push({ type: 'object', name: obj });

    console.log(`\nFetching fields for ${obj}...`);
    const fields = fetchFieldsForObject(obj);
    console.log(`Found ${fields.length} fields.`);

    const selectedFields = await promptFieldSelection(obj, fields);
    if (selectedFields.length > 0) {
      selectedFieldsByObject.set(obj, selectedFields);
      for (const field of selectedFields) {
        allSelections.push({ type: 'field', name: field, object: obj });
      }
    }
  }

  // Step 2: Select permissions
  const changes: PermissionChange[] = [];

  // Object permissions
  const objectSelections = allSelections.filter((s) => s.type === 'object');
  if (objectSelections.length > 0) {
    const rawPerms = await promptObjectPermissions(objectSelections.map((s) => s.name));
    const { resolved, autoEnabled } = resolveObjectDependencies(rawPerms);
    const autoLabels = autoEnabled.map((k) => OBJECT_PERM_LABEL_MAP[k] || k);

    if (autoLabels.length > 0) {
      console.log(`  ↳ Auto-enabled dependencies: ${autoLabels.join(', ')}`);
    }

    for (const sel of objectSelections) {
      changes.push({ selection: sel, permissions: resolved, autoEnabled: autoLabels });
    }
  }

  // Field permissions
  const fieldSelections = allSelections.filter((s) => s.type === 'field');
  if (fieldSelections.length > 0) {
    const rawPerms = await promptFieldPermissions(fieldSelections.map((s) => s.name));
    const { resolved, autoEnabled } = resolveFieldDependencies(rawPerms);
    const autoLabels = autoEnabled.map((k) => FIELD_PERM_LABEL_MAP[k] || k);

    if (autoLabels.length > 0) {
      console.log(`  ↳ Auto-enabled dependencies: ${autoLabels.join(', ')}`);
    }

    for (const sel of fieldSelections) {
      changes.push({ selection: sel, permissions: resolved, autoEnabled: autoLabels });
    }
  }

  if (changes.length === 0) {
    console.log('No permissions selected. Exiting.');
    process.exit(0);
  }

  // Step 3: Select permission sets
  console.log('\nDiscovering permission sets...');
  const allTargets = discoverPermissionSets(packageDirs, defaultPackageDir);
  console.log(`Found ${allTargets.length} permission sets.\n`);

  const selectedTargets = await promptPermissionSetSelection(allTargets);

  // Step 4: Preview
  printPreview(changes, selectedTargets);

  // Step 5: Confirm
  const confirmed = await promptConfirm();
  if (!confirmed) {
    console.log('Cancelled.');
    process.exit(0);
  }

  // Step 6: Apply changes
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
        applyObjectPermission(parsed, change.selection.name, change.permissions as ObjectPermissions);
      } else {
        applyFieldPermission(parsed, change.selection.name, change.permissions as FieldPermissions);
      }
    }

    const xml = serializePermissionSetXml(parsed, indent);
    writePermissionSetFile(filePath, xml);
  }

  console.log('\n✓ All changes applied successfully!');
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
