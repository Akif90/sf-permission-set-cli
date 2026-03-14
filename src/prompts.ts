import inquirer from 'inquirer';
import autocomplete from 'inquirer-autocomplete-prompt';
import Fuse from 'fuse.js';
import type {
  ObjectPermissions,
  FieldPermissions,
  PermissionSetTarget,
  PermissionChange,
} from './types.js';

inquirer.registerPrompt('autocomplete', autocomplete);

export async function promptObjectSearch(objects: string[]): Promise<string[]> {
  const selected: string[] = [];
  const remaining = [...objects];

  console.log('Start typing to search for an object. Select it to add.\n');

  while (true) {
    const fuse = new Fuse(remaining, { threshold: 0.4, includeScore: true });

    const { object } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'object',
        message: selected.length > 0
          ? `Selected: [${selected.join(', ')}] — Search for another object (or type "done"):`
          : 'Search for an object:',
        source: (_answers: unknown, input: string | undefined) => {
          const query = (input || '').trim();
          if (!query) {
            const opts = selected.length > 0 ? ['>> Done selecting objects <<', ...remaining] : remaining;
            return Promise.resolve(opts);
          }
          if ('done'.startsWith(query.toLowerCase()) && selected.length > 0) {
            return Promise.resolve(['>> Done selecting objects <<', ...fuse.search(query).map((r) => r.item)]);
          }
          return Promise.resolve(fuse.search(query).map((r) => r.item));
        },
        pageSize: 15,
      } as never,
    ]);

    if (object === '>> Done selecting objects <<') break;

    selected.push(object);
    remaining.splice(remaining.indexOf(object), 1);
    console.log(`  Added: ${object}`);

    if (remaining.length === 0) break;

    const { addMore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addMore',
        message: 'Add another object?',
        default: false,
      },
    ]);

    if (!addMore) break;
  }

  if (selected.length === 0) {
    console.log('No objects selected. Exiting.');
    process.exit(0);
  }

  return selected;
}

export async function promptFieldSearch(objectName: string, fields: string[]): Promise<string[]> {
  const selected: string[] = [];
  const remaining = [...fields];

  console.log(`\nStart typing to search for a field on ${objectName}.\n`);

  while (true) {
    const fuse = new Fuse(remaining, { threshold: 0.4, includeScore: true });

    const { field } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'field',
        message: selected.length > 0
          ? `Selected: [${selected.map(f => f.split('.')[1]).join(', ')}] — Search for another field (or type "done"):`
          : `Search for a field on ${objectName}:`,
        source: (_answers: unknown, input: string | undefined) => {
          const query = (input || '').trim();
          if (!query) {
            const opts = selected.length > 0 ? ['>> Done selecting fields <<', ...remaining] : remaining;
            return Promise.resolve(opts);
          }
          if ('done'.startsWith(query.toLowerCase()) && selected.length > 0) {
            return Promise.resolve(['>> Done selecting fields <<', ...fuse.search(query).map((r) => r.item)]);
          }
          return Promise.resolve(fuse.search(query).map((r) => r.item));
        },
        pageSize: 15,
      } as never,
    ]);

    if (field === '>> Done selecting fields <<') break;

    selected.push(field);
    remaining.splice(remaining.indexOf(field), 1);
    console.log(`  Added: ${field}`);

    if (remaining.length === 0) break;

    const { addMore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addMore',
        message: 'Add another field?',
        default: false,
      },
    ]);

    if (!addMore) break;
  }

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
  if (targets.length === 0) {
    console.log('No permission set files found in the project.');
    process.exit(1);
  }

  const choices = targets.map((t) => ({
    name: t.name,
    value: t.name,
  }));

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select permission sets to update (press <space> to select, <enter> to confirm):',
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
    console.log(`Permission Set: ${target.name}`);

    for (const change of changes) {
      const itemName = change.selection.name;

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
