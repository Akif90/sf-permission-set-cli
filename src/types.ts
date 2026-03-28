export interface OrgInfo {
  username: string;
  orgId: string;
  instanceUrl: string;
}

export interface SfdxProject {
  packageDirectories: Array<{ path: string; default?: boolean }>;
}

export type SelectionItem =
  | { type: 'object'; name: string }
  | { type: 'field'; name: string; object: string };

export interface ObjectPermissions {
  allowCreate: boolean;
  allowDelete: boolean;
  allowEdit: boolean;
  allowRead: boolean;
  modifyAllRecords: boolean;
  viewAllRecords: boolean;
}

export interface FieldPermissions {
  editable: boolean;
  readable: boolean;
}

export type ObjectPermissionKey = keyof ObjectPermissions;
export type FieldPermissionKey = keyof FieldPermissions;

export interface PermissionChange {
  selection: SelectionItem;
  permissions: ObjectPermissions | FieldPermissions;
  autoEnabled: string[];
}

export interface PermissionSetTarget {
  name: string;
  filePath: string | null; // null = new file to create
  label: string;
}

