import { describe, it, expect, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parsePermissionSetXml,
  createEmptyPermissionSet,
  applyObjectPermission,
  applyFieldPermission,
  readExistingObjectPermissions,
  readExistingFieldPermissions,
  serializePermissionSetXml,
  writePermissionSetFile,
  detectIndentation,
} from '../xml-mutator.js';

const FIXTURES_DIR = resolve(import.meta.dirname, 'fixtures');

describe('detectIndentation', () => {
  it('should detect 4-space indentation', () => {
    const xml = '<?xml version="1.0"?>\n    <tag>value</tag>';
    expect(detectIndentation(xml)).toBe('    ');
  });

  it('should detect tab indentation', () => {
    const xml = '<?xml version="1.0"?>\n\t<tag>value</tag>';
    expect(detectIndentation(xml)).toBe('\t');
  });

  it('should default to 4 spaces', () => {
    const xml = '<?xml version="1.0"?><tag>value</tag>';
    expect(detectIndentation(xml)).toBe('    ');
  });
});

describe('parsePermissionSetXml', () => {
  it('should parse existing permission set file', () => {
    const parsed = parsePermissionSetXml(join(FIXTURES_DIR, 'Admin.permissionset-meta.xml'));
    expect(parsed).toBeDefined();
    expect(parsed.length).toBeGreaterThan(0);
  });
});

describe('createEmptyPermissionSet', () => {
  it('should create a valid permission set structure', () => {
    const parsed = createEmptyPermissionSet('Test_PS', 'Test PS');
    const xml = serializePermissionSetXml(parsed);
    expect(xml).toContain('<PermissionSet');
    expect(xml).toContain('<label>Test PS</label>');
    expect(xml).toContain('<hasActivationRequired>false</hasActivationRequired>');
  });
});

describe('applyObjectPermission', () => {
  it('should add new object permission to empty file', () => {
    const parsed = createEmptyPermissionSet('Test', 'Test');
    applyObjectPermission(parsed, 'Account', {
      allowRead: true,
      allowCreate: false,
      allowEdit: true,
      allowDelete: false,
      viewAllRecords: false,
      modifyAllRecords: false,
    });
    const xml = serializePermissionSetXml(parsed);
    expect(xml).toContain('<object>Account</object>');
    expect(xml).toContain('<allowRead>true</allowRead>');
    expect(xml).toContain('<allowEdit>true</allowEdit>');
    expect(xml).toContain('<allowCreate>false</allowCreate>');
  });

  it('should update existing object permission', () => {
    const parsed = parsePermissionSetXml(join(FIXTURES_DIR, 'Admin.permissionset-meta.xml'));
    applyObjectPermission(parsed, 'Account', {
      allowRead: true,
      allowCreate: true,
      allowEdit: true,
      allowDelete: true,
      viewAllRecords: true,
      modifyAllRecords: true,
    });
    const xml = serializePermissionSetXml(parsed);
    expect(xml).toContain('<object>Account</object>');
    expect(xml).toContain('<modifyAllRecords>true</modifyAllRecords>');
    expect(xml).toContain('<viewAllRecords>true</viewAllRecords>');
    // Should not duplicate the Account entry
    const accountCount = (xml.match(/<object>Account<\/object>/g) || []).length;
    expect(accountCount).toBe(1);
  });
});

describe('applyFieldPermission', () => {
  it('should add new field permission', () => {
    const parsed = createEmptyPermissionSet('Test', 'Test');
    applyFieldPermission(parsed, 'Account.Name', {
      readable: true,
      editable: false,
    });
    const xml = serializePermissionSetXml(parsed);
    expect(xml).toContain('<field>Account.Name</field>');
    expect(xml).toContain('<readable>true</readable>');
    expect(xml).toContain('<editable>false</editable>');
  });

  it('should write exact field permission state (allow toggle off)', () => {
    // Admin fixture has Account.Industry with editable=true, readable=true
    const parsed = parsePermissionSetXml(join(FIXTURES_DIR, 'Admin.permissionset-meta.xml'));
    applyFieldPermission(parsed, 'Account.Industry', {
      readable: true,
      editable: false, // user explicitly toggled Edit off
    });
    const xml = serializePermissionSetXml(parsed);
    expect(xml).toContain('<field>Account.Industry</field>');
    expect(xml).toContain('<editable>false</editable>'); // toggled off
    const fieldCount = (xml.match(/<field>Account\.Industry<\/field>/g) || []).length;
    expect(fieldCount).toBe(1);
  });
});

describe('apply writes exact state (supports toggle off)', () => {
  it('should allow revoking existing object permissions', () => {
    // Admin fixture: Account has allowCreate=true, allowDelete=true, allowEdit=true, allowRead=true
    const parsed = parsePermissionSetXml(join(FIXTURES_DIR, 'Admin.permissionset-meta.xml'));
    applyObjectPermission(parsed, 'Account', {
      allowRead: true,
      allowCreate: false, // revoke
      allowEdit: false,   // revoke
      allowDelete: false,  // revoke
      viewAllRecords: true, // add
      modifyAllRecords: false,
    });
    const xml = serializePermissionSetXml(parsed);
    expect(xml).toContain('<allowCreate>false</allowCreate>');
    expect(xml).toContain('<allowEdit>false</allowEdit>');
    expect(xml).toContain('<allowDelete>false</allowDelete>');
    expect(xml).toContain('<viewAllRecords>true</viewAllRecords>');
  });
});

describe('readExistingObjectPermissions', () => {
  it('should read existing object permissions', () => {
    const parsed = parsePermissionSetXml(join(FIXTURES_DIR, 'Admin.permissionset-meta.xml'));
    const perms = readExistingObjectPermissions(parsed, 'Account');
    expect(perms).not.toBeNull();
    expect(perms!.allowRead).toBe(true);
    expect(perms!.allowCreate).toBe(true);
    expect(perms!.allowEdit).toBe(true);
    expect(perms!.allowDelete).toBe(true);
    expect(perms!.modifyAllRecords).toBe(false);
    expect(perms!.viewAllRecords).toBe(false);
  });

  it('should return null for non-existent object', () => {
    const parsed = parsePermissionSetXml(join(FIXTURES_DIR, 'Admin.permissionset-meta.xml'));
    const perms = readExistingObjectPermissions(parsed, 'NonExistent__c');
    expect(perms).toBeNull();
  });
});

describe('readExistingFieldPermissions', () => {
  it('should read existing field permissions', () => {
    const parsed = parsePermissionSetXml(join(FIXTURES_DIR, 'Admin.permissionset-meta.xml'));
    const perms = readExistingFieldPermissions(parsed, 'Account.Industry');
    expect(perms).not.toBeNull();
    expect(perms!.readable).toBe(true);
    expect(perms!.editable).toBe(true);
  });

  it('should return null for non-existent field', () => {
    const parsed = parsePermissionSetXml(join(FIXTURES_DIR, 'Admin.permissionset-meta.xml'));
    const perms = readExistingFieldPermissions(parsed, 'Account.NonExistent');
    expect(perms).toBeNull();
  });
});

describe('round-trip', () => {
  it('should preserve structure on parse-serialize round-trip', () => {
    const filePath = join(FIXTURES_DIR, 'Admin.permissionset-meta.xml');
    const parsed = parsePermissionSetXml(filePath);
    const serialized = serializePermissionSetXml(parsed);

    expect(serialized).toContain('<PermissionSet');
    expect(serialized).toContain('<object>Account</object>');
    expect(serialized).toContain('<field>Account.Industry</field>');
    expect(serialized).toContain('<label>Admin</label>');
  });

  it('should not produce blank lines in output', () => {
    const filePath = join(FIXTURES_DIR, 'Admin.permissionset-meta.xml');
    const parsed = parsePermissionSetXml(filePath);
    applyObjectPermission(parsed, 'Contact', {
      allowRead: true, allowCreate: false, allowEdit: false,
      allowDelete: false, viewAllRecords: false, modifyAllRecords: false,
    });
    const serialized = serializePermissionSetXml(parsed);
    // No consecutive blank lines
    expect(serialized).not.toMatch(/\n\s*\n/);
  });
});

describe('writePermissionSetFile', () => {
  it('should create directories and write file', () => {
    const tmpDir = join(tmpdir(), `permcraft-test-${Date.now()}`);
    const filePath = join(tmpDir, 'nested', 'dir', 'Test.permissionset-meta.xml');

    try {
      writePermissionSetFile(filePath, '<xml>test</xml>');
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toBe('<xml>test</xml>');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
