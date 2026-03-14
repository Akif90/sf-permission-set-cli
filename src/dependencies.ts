import type { ObjectPermissions, FieldPermissions, ObjectPermissionKey } from './types.js';

// Each key implies all keys listed in its array (transitive dependencies)
const OBJECT_DEPENDENCY_CHAIN: ObjectPermissionKey[] = [
  'modifyAllRecords',
  'viewAllRecords',
  'allowDelete',
  'allowEdit',
  'allowRead',
];

export function resolveObjectDependencies(perms: ObjectPermissions): {
  resolved: ObjectPermissions;
  autoEnabled: string[];
} {
  const resolved = { ...perms };
  const autoEnabled: string[] = [];

  // Find the highest permission that's enabled, then enable everything below it
  let highestIndex = -1;
  for (let i = 0; i < OBJECT_DEPENDENCY_CHAIN.length; i++) {
    if (resolved[OBJECT_DEPENDENCY_CHAIN[i]]) {
      highestIndex = i;
      break;
    }
  }

  if (highestIndex >= 0) {
    for (let i = highestIndex + 1; i < OBJECT_DEPENDENCY_CHAIN.length; i++) {
      const key = OBJECT_DEPENDENCY_CHAIN[i];
      if (!resolved[key]) {
        resolved[key] = true;
        autoEnabled.push(key);
      }
    }
  }

  // Also handle Edit → Read independently (Edit without Delete should still imply Read)
  if (resolved.allowEdit && !resolved.allowRead) {
    resolved.allowRead = true;
    if (!autoEnabled.includes('allowRead')) autoEnabled.push('allowRead');
  }
  if (resolved.allowCreate && !resolved.allowRead) {
    resolved.allowRead = true;
    if (!autoEnabled.includes('allowRead')) autoEnabled.push('allowRead');
  }

  return { resolved, autoEnabled };
}

export function resolveFieldDependencies(perms: FieldPermissions): {
  resolved: FieldPermissions;
  autoEnabled: string[];
} {
  const resolved = { ...perms };
  const autoEnabled: string[] = [];

  if (resolved.editable && !resolved.readable) {
    resolved.readable = true;
    autoEnabled.push('readable');
  }

  return { resolved, autoEnabled };
}
