import inquirer from 'inquirer';
import autocomplete from 'inquirer-autocomplete-prompt';
import Fuse from 'fuse.js';
import type {
  ObjectPermissions,
  FieldPermissions,
  PermissionSetTarget,
  PermissionChange,
  ObjectPermissionKey,
  FieldPermissionKey,
} from './types.js';
import { OBJECT_PERMISSION_LABELS, FIELD_PERMISSION_LABELS } from './types.js';

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
        message:
          selected.length > 0
            ? `Selected: [${selected.join(', ')}] — Search for another object (or type "done"):`
            : 'Search for an object:',
        source: (_answers: unknown, input: string | undefined) => {
          const query = (input || '').trim();
          if (!query) {
            const opts =
              selected.length > 0 ? ['>> Done selecting objects <<', ...remaining] : remaining;
            return Promise.resolve(opts);
          }
          if ('done'.startsWith(query.toLowerCase()) && selected.length > 0) {
            return Promise.resolve([
              '>> Done selecting objects <<',
              ...fuse.search(query).map((r) => r.item),
            ]);
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
        message:
          selected.length > 0
            ? `Selected: [${selected.map((f) => f.split('.')[1]).join(', ')}] — Search for another field (or type "done"):`
            : `Search for a field on ${objectName}:`,
        source: (_answers: unknown, input: string | undefined) => {
          const query = (input || '').trim();
          if (!query) {
            const opts =
              selected.length > 0 ? ['>> Done selecting fields <<', ...remaining] : remaining;
            return Promise.resolve(opts);
          }
          if ('done'.startsWith(query.toLowerCase()) && selected.length > 0) {
            return Promise.resolve([
              '>> Done selecting fields <<',
              ...fuse.search(query).map((r) => r.item),
            ]);
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

export type PermissionMode = 'bulk' | 'granular';

export async function promptPermissionMode(): Promise<PermissionMode> {
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'How would you like to assign permissions?',
      choices: [
        { name: 'Bulk — same permissions for all selected objects/fields', value: 'bulk' },
        { name: 'Granular — different permissions for each object/field', value: 'granular' },
      ],
    },
  ]);
  return mode;
}

/**
 * Show existing permissions summary across permission sets.
 * e.g. "  Currently set — Sales_User: Read, Edit | Admin: Read"
 */
export function printExistingPermissions(
  itemName: string,
  existingByTarget: Map<string, ObjectPermissions | FieldPermissions>,
): void {
  const entries: string[] = [];
  for (const [targetName, perms] of existingByTarget) {
    const enabled: string[] = [];
    if ('allowRead' in perms) {
      const p = perms as ObjectPermissions;
      if (p.allowRead) enabled.push('Read');
      if (p.allowCreate) enabled.push('Create');
      if (p.allowEdit) enabled.push('Edit');
      if (p.allowDelete) enabled.push('Delete');
      if (p.viewAllRecords) enabled.push('View All');
      if (p.modifyAllRecords) enabled.push('Modify All');
    } else {
      const p = perms as FieldPermissions;
      if (p.readable) enabled.push('Read');
      if (p.editable) enabled.push('Edit');
    }
    if (enabled.length > 0) {
      entries.push(`${targetName}: ${enabled.join(', ')}`);
    } else {
      entries.push(`${targetName}: (none)`);
    }
  }
  if (entries.length > 0) {
    console.log(`  Currently set — ${entries.join(' | ')}`);
  }
}

/**
 * Compute which permissions are enabled in ANY of the selected permission sets.
 * This union becomes the pre-checked default so the user sees everything that's currently on.
 */
function computeObjectPermissionUnion(
  existingByTarget: Map<string, ObjectPermissions | null>,
): ObjectPermissions {
  const union: ObjectPermissions = {
    allowRead: false,
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    viewAllRecords: false,
    modifyAllRecords: false,
  };
  for (const perms of existingByTarget.values()) {
    if (!perms) continue;
    for (const key of Object.keys(union) as ObjectPermissionKey[]) {
      if (perms[key]) union[key] = true;
    }
  }
  return union;
}

function computeFieldPermissionUnion(
  existingByTarget: Map<string, FieldPermissions | null>,
): FieldPermissions {
  const union: FieldPermissions = { readable: false, editable: false };
  for (const perms of existingByTarget.values()) {
    if (!perms) continue;
    for (const key of Object.keys(union) as FieldPermissionKey[]) {
      if (perms[key]) union[key] = true;
    }
  }
  return union;
}

export async function promptObjectPermissions(
  objectNames: string[],
  existingByTarget?: Map<string, ObjectPermissions | null>,
): Promise<ObjectPermissions> {
  const preChecked = existingByTarget
    ? computeObjectPermissionUnion(existingByTarget)
    : undefined;

  const permChoices = [
    { name: 'Read', value: 'allowRead', checked: preChecked?.allowRead ?? false },
    { name: 'Create', value: 'allowCreate', checked: preChecked?.allowCreate ?? false },
    { name: 'Edit', value: 'allowEdit', checked: preChecked?.allowEdit ?? false },
    { name: 'Delete', value: 'allowDelete', checked: preChecked?.allowDelete ?? false },
    { name: 'View All', value: 'viewAllRecords', checked: preChecked?.viewAllRecords ?? false },
    { name: 'Modify All', value: 'modifyAllRecords', checked: preChecked?.modifyAllRecords ?? false },
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

export async function promptFieldPermissions(
  fieldNames: string[],
  existingByTarget?: Map<string, FieldPermissions | null>,
): Promise<FieldPermissions> {
  const preChecked = existingByTarget
    ? computeFieldPermissionUnion(existingByTarget)
    : undefined;

  const permChoices = [
    { name: 'Read', value: 'readable', checked: preChecked?.readable ?? false },
    { name: 'Edit', value: 'editable', checked: preChecked?.editable ?? false },
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
  existingPerms: Map<string, Map<string, ObjectPermissions | FieldPermissions | null>>,
): void {
  console.log('\n--- Preview ---\n');

  for (const target of targets) {
    console.log(`Permission Set: ${target.name}`);
    const targetExisting = existingPerms.get(target.name);

    for (const change of changes) {
      const itemName = change.selection.name;
      const existing = targetExisting?.get(itemName) ?? null;
      const perms = change.permissions;

      const added: string[] = [];
      const removed: string[] = [];
      const unchanged: string[] = [];

      if ('allowRead' in perms) {
        const p = perms as ObjectPermissions;
        const e = (existing as ObjectPermissions | null) ?? {
          allowRead: false, allowCreate: false, allowEdit: false,
          allowDelete: false, viewAllRecords: false, modifyAllRecords: false,
        };
        const labels: [ObjectPermissionKey, string][] = [
          ['allowRead', 'Read'], ['allowCreate', 'Create'], ['allowEdit', 'Edit'],
          ['allowDelete', 'Delete'], ['viewAllRecords', 'View All'], ['modifyAllRecords', 'Modify All'],
        ];
        for (const [key, label] of labels) {
          if (p[key] && !e[key]) added.push(label);
          else if (!p[key] && e[key]) removed.push(label);
          else if (p[key] && e[key]) unchanged.push(label);
        }
      } else {
        const p = perms as FieldPermissions;
        const e = (existing as FieldPermissions | null) ?? { readable: false, editable: false };
        if (p.readable && !e.readable) added.push('Read');
        else if (!p.readable && e.readable) removed.push('Read');
        else if (p.readable && e.readable) unchanged.push('Read');

        if (p.editable && !e.editable) added.push('Edit');
        else if (!p.editable && e.editable) removed.push('Edit');
        else if (p.editable && e.editable) unchanged.push('Edit');
      }

      const parts: string[] = [];
      if (added.length > 0) parts.push(`+${added.join(', ')}`);
      if (removed.length > 0) parts.push(`-${removed.join(', ')}`);
      if (unchanged.length > 0) parts.push(`=${unchanged.join(', ')}`);

      let autoStr = '';
      if (change.autoEnabled.length > 0) {
        autoStr = ` (auto-enabled: ${change.autoEnabled.join(', ')})`;
      }

      console.log(`  ${itemName}: ${parts.join('  ')}${autoStr}`);
    }

    console.log();
  }

  console.log('  Legend: +added  -removed  =unchanged\n');
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
