import inquirer from 'inquirer';
import { existsSync } from 'node:fs';
import type {
  ObjectPermissions,
  FieldPermissions,
  PermissionSetTarget,
  PermissionChange,
} from './types.js';

interface ObjectChoice {
  name: string;
  value: string;
}

export async function promptObjectSelection(objects: string[]): Promise<string[]> {
  const choices: ObjectChoice[] = objects.map((o) => ({ name: o, value: o }));

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select objects (type to filter):',
      choices,
      loop: false,
      pageSize: 20,
    },
  ]);

  if (selected.length === 0) {
    console.log('No objects selected.');
    process.exit(0);
  }

  return selected;
}

export async function promptFieldSelection(
  objectName: string,
  fields: string[],
): Promise<string[]> {
  const { selectFields } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'selectFields',
      message: `Select individual fields from ${objectName}?`,
      default: false,
    },
  ]);

  if (!selectFields) return [];

  const choices = fields.map((f) => ({ name: f, value: f }));

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: `Select fields from ${objectName}:`,
      choices,
      loop: false,
      pageSize: 20,
    },
  ]);

  return selected;
}

export async function promptObjectPermissions(objectNames: string[]): Promise<ObjectPermissions> {
  const permChoices = [
    { name: 'Read', value: 'allowRead' },
    { name: 'Create', value: 'allowCreate' },
    { name: 'Edit', value: 'allowEdit' },
    { name: 'Delete', value: 'allowDelete' },
    { name: 'View All', value: 'viewAllRecords' },
    { name: 'Modify All', value: 'modifyAllRecords' },
  ];

  const label =
    objectNames.length === 1
      ? `Permissions for ${objectNames[0]}`
      : `Permissions for ${objectNames.length} objects (${objectNames.slice(0, 3).join(', ')}${objectNames.length > 3 ? '...' : ''})`;

  const { perms } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'perms',
      message: label,
      choices: permChoices,
    },
  ]);

  const selected = new Set(perms as string[]);

  return {
    allowRead: selected.has('allowRead'),
    allowCreate: selected.has('allowCreate'),
    allowEdit: selected.has('allowEdit'),
    allowDelete: selected.has('allowDelete'),
    viewAllRecords: selected.has('viewAllRecords'),
    modifyAllRecords: selected.has('modifyAllRecords'),
  };
}

export async function promptFieldPermissions(fieldNames: string[]): Promise<FieldPermissions> {
  const permChoices = [
    { name: 'Read', value: 'readable' },
    { name: 'Edit', value: 'editable' },
  ];

  const label =
    fieldNames.length === 1
      ? `Permissions for ${fieldNames[0]}`
      : `Permissions for ${fieldNames.length} fields`;

  const { perms } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'perms',
      message: label,
      choices: permChoices,
    },
  ]);

  const selected = new Set(perms as string[]);

  return {
    readable: selected.has('readable'),
    editable: selected.has('editable'),
  };
}

export async function promptPermissionSetSelection(
  targets: PermissionSetTarget[],
): Promise<PermissionSetTarget[]> {
  const choices = targets.map((t) => ({
    name: t.filePath ? t.name : `${t.name} (new file)`,
    value: t.name,
  }));

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select permission sets to update:',
      choices,
      loop: false,
      pageSize: 20,
    },
  ]);

  if (selected.length === 0) {
    console.log('No permission sets selected.');
    process.exit(0);
  }

  const selectedSet = new Set(selected as string[]);
  return targets.filter((t) => selectedSet.has(t.name));
}

export function printPreview(
  changes: PermissionChange[],
  targets: PermissionSetTarget[],
): void {
  console.log('\n--- Preview ---\n');

  for (const target of targets) {
    const isNew = !target.filePath || !existsSync(target.filePath);
    console.log(`Permission Set: ${target.name}${isNew ? ' (new file)' : ''}`);

    for (const change of changes) {
      const itemName =
        change.selection.type === 'object' ? change.selection.name : change.selection.name;

      const permEntries: string[] = [];
      const perms = change.permissions;

      if ('allowRead' in perms) {
        const p = perms as ObjectPermissions;
        if (p.allowRead) permEntries.push('Read');
        if (p.allowCreate) permEntries.push('Create');
        if (p.allowEdit) permEntries.push('Edit');
        if (p.allowDelete) permEntries.push('Delete');
        if (p.viewAllRecords) permEntries.push('View All');
        if (p.modifyAllRecords) permEntries.push('Modify All');
      } else {
        const p = perms as FieldPermissions;
        if (p.readable) permEntries.push('Read');
        if (p.editable) permEntries.push('Edit');
      }

      let autoStr = '';
      if (change.autoEnabled.length > 0) {
        autoStr = ` (auto-enabled: ${change.autoEnabled.join(', ')})`;
      }

      console.log(`  + ${itemName}: ${permEntries.join(', ')}${autoStr}`);
    }

    console.log();
  }
}

export async function promptConfirm(): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Apply these changes?',
      default: true,
    },
  ]);

  return confirmed;
}
