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

  it('should not downgrade existing field permission', () => {
    // Admin fixture has Account.Industry with editable=true, readable=true
    const parsed = parsePermissionSetXml(join(FIXTURES_DIR, 'Admin.permissionset-meta.xml'));
    applyFieldPermission(parsed, 'Account.Industry', {
      readable: true,
      editable: false, // user did not select Edit — existing true should remain
    });
    const xml = serializePermissionSetXml(parsed);
    expect(xml).toContain('<field>Account.Industry</field>');
    expect(xml).toContain('<editable>true</editable>'); // preserved, not overwritten
    const fieldCount = (xml.match(/<field>Account\.Industry<\/field>/g) || []).length;
    expect(fieldCount).toBe(1);
  });
});

describe('merge behavior — never downgrade existing permissions', () => {
  it('should preserve existing true permissions when user selects false', () => {
    // Admin fixture: Account has allowCreate=true, allowDelete=true, allowEdit=true, allowRead=true
    const parsed = parsePermissionSetXml(join(FIXTURES_DIR, 'Admin.permissionset-meta.xml'));
    applyObjectPermission(parsed, 'Account', {
      allowRead: true,
      allowCreate: false, // user didn't select Create, but it's already true
      allowEdit: false,   // user didn't select Edit, but it's already true
      allowDelete: false,
      viewAllRecords: true, // user selected this — should upgrade
      modifyAllRecords: false,
    });
    const xml = serializePermissionSetXml(parsed);
    expect(xml).toContain('<allowCreate>true</allowCreate>');  // preserved
    expect(xml).toContain('<allowEdit>true</allowEdit>');      // preserved
    expect(xml).toContain('<allowDelete>true</allowDelete>');  // preserved
    expect(xml).toContain('<viewAllRecords>true</viewAllRecords>'); // upgraded
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
