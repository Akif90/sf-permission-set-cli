import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ObjectPermissions, FieldPermissions } from './types.js';

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  preserveOrder: true,
  commentPropName: '#comment',
  parseTagValue: false,
  trimValues: false,
};

const BUILDER_OPTIONS = {
  ignoreAttributes: false,
  preserveOrder: true,
  commentPropName: '#comment',
  format: true,
  indentBy: '    ',
  suppressEmptyNode: false,
};

interface PermSetNode {
  [key: string]: unknown;
}

function boolStr(val: boolean): string {
  return val ? 'true' : 'false';
}

function buildObjectPermissionNode(objectName: string, perms: ObjectPermissions): PermSetNode[] {
  return [
    {
      objectPermissions: [
        { allowCreate: [{ '#text': boolStr(perms.allowCreate) }] },
        { allowDelete: [{ '#text': boolStr(perms.allowDelete) }] },
        { allowEdit: [{ '#text': boolStr(perms.allowEdit) }] },
        { allowRead: [{ '#text': boolStr(perms.allowRead) }] },
        { modifyAllRecords: [{ '#text': boolStr(perms.modifyAllRecords) }] },
        { object: [{ '#text': objectName }] },
        { viewAllRecords: [{ '#text': boolStr(perms.viewAllRecords) }] },
      ],
    },
  ];
}

function buildFieldPermissionNode(fieldName: string, perms: FieldPermissions): PermSetNode[] {
  return [
    {
      fieldPermissions: [
        { editable: [{ '#text': boolStr(perms.editable) }] },
        { field: [{ '#text': fieldName }] },
        { readable: [{ '#text': boolStr(perms.readable) }] },
      ],
    },
  ];
}

function getTextValue(nodes: PermSetNode[], tagName: string): string | undefined {
  for (const node of nodes) {
    if (tagName in node) {
      const children = node[tagName] as PermSetNode[];
      if (children && children.length > 0 && '#text' in children[0]) {
        return children[0]['#text'] as string;
      }
    }
  }
  return undefined;
}

function setTextValue(nodes: PermSetNode[], tagName: string, value: string): void {
  for (const node of nodes) {
    if (tagName in node) {
      const children = node[tagName] as PermSetNode[];
      if (children && children.length > 0) {
        children[0]['#text'] = value;
      }
      return;
    }
  }
  // If not found, add it
  nodes.push({ [tagName]: [{ '#text': value }] });
}

export function detectIndentation(content: string): string {
  const match = content.match(/^( +|\t+)</m);
  return match ? match[1] : '    ';
}

export function parsePermissionSetXml(filePath: string): PermSetNode[] {
  const content = readFileSync(filePath, 'utf-8');
  const parser = new XMLParser(PARSER_OPTIONS);
  return parser.parse(content);
}

export function createEmptyPermissionSet(name: string, label: string): PermSetNode[] {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <hasActivationRequired>false</hasActivationRequired>
    <label>${label}</label>
</PermissionSet>`;
  const parser = new XMLParser(PARSER_OPTIONS);
  return parser.parse(xml);
}

function findPermSetRoot(parsed: PermSetNode[]): PermSetNode[] {
  for (const node of parsed) {
    if ('PermissionSet' in node) {
      return node['PermissionSet'] as PermSetNode[];
    }
  }
  throw new Error('Invalid permission set XML: no <PermissionSet> root element found');
}

function findExistingNode(
  children: PermSetNode[],
  tag: 'objectPermissions' | 'fieldPermissions',
  identifierTag: string,
  identifierValue: string,
): { node: PermSetNode; index: number } | null {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (tag in child) {
      const innerNodes = child[tag] as PermSetNode[];
      const val = getTextValue(innerNodes, identifierTag);
      if (val === identifierValue) {
        return { node: child, index: i };
      }
    }
  }
  return null;
}

function findInsertionIndex(
  children: PermSetNode[],
  tag: 'objectPermissions' | 'fieldPermissions',
  identifierTag: string,
  identifierValue: string,
): number {
  let lastTagIndex = -1;
  let insertAfterAll = -1;

  for (let i = 0; i < children.length; i++) {
    if (tag in children[i]) {
      lastTagIndex = i;
      const innerNodes = children[i][tag] as PermSetNode[];
      const val = getTextValue(innerNodes, identifierTag);
      if (val && val.localeCompare(identifierValue) < 0) {
        insertAfterAll = i;
      }
    }
  }

  if (lastTagIndex === -1) {
    // No existing nodes of this type — insert before closing tag
    return children.length;
  }

  return insertAfterAll + 1 === 0 ? lastTagIndex : insertAfterAll + 1;
}

export function applyObjectPermission(
  parsed: PermSetNode[],
  objectName: string,
  perms: ObjectPermissions,
): void {
  const root = findPermSetRoot(parsed);
  const existing = findExistingNode(root, 'objectPermissions', 'object', objectName);

  if (existing) {
    const inner = existing.node['objectPermissions'] as PermSetNode[];
    setTextValue(inner, 'allowCreate', boolStr(perms.allowCreate));
    setTextValue(inner, 'allowDelete', boolStr(perms.allowDelete));
    setTextValue(inner, 'allowEdit', boolStr(perms.allowEdit));
    setTextValue(inner, 'allowRead', boolStr(perms.allowRead));
    setTextValue(inner, 'modifyAllRecords', boolStr(perms.modifyAllRecords));
    setTextValue(inner, 'viewAllRecords', boolStr(perms.viewAllRecords));
  } else {
    const newNode = buildObjectPermissionNode(objectName, perms);
    const idx = findInsertionIndex(root, 'objectPermissions', 'object', objectName);
    root.splice(idx, 0, ...newNode);
  }
}

export function applyFieldPermission(
  parsed: PermSetNode[],
  fieldName: string,
  perms: FieldPermissions,
): void {
  const root = findPermSetRoot(parsed);
  const existing = findExistingNode(root, 'fieldPermissions', 'field', fieldName);

  if (existing) {
    const inner = existing.node['fieldPermissions'] as PermSetNode[];
    setTextValue(inner, 'editable', boolStr(perms.editable));
    setTextValue(inner, 'readable', boolStr(perms.readable));
  } else {
    const newNode = buildFieldPermissionNode(fieldName, perms);
    const idx = findInsertionIndex(root, 'fieldPermissions', 'field', fieldName);
    root.splice(idx, 0, ...newNode);
  }
}

export function serializePermissionSetXml(parsed: PermSetNode[], indent: string = '    '): string {
  const builder = new XMLBuilder({ ...BUILDER_OPTIONS, indentBy: indent });
  let xml = builder.build(parsed) as string;

  // Ensure trailing newline
  if (!xml.endsWith('\n')) {
    xml += '\n';
  }

  return xml;
}

export function writePermissionSetFile(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, content, 'utf-8');
}
