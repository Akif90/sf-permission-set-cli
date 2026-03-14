import { describe, it, expect } from 'vitest';
import { resolveObjectDependencies, resolveFieldDependencies } from '../dependencies.js';

describe('resolveObjectDependencies', () => {
  it('should auto-enable Read when Edit is selected', () => {
    const { resolved, autoEnabled } = resolveObjectDependencies({
      allowRead: false,
      allowCreate: false,
      allowEdit: true,
      allowDelete: false,
      viewAllRecords: false,
      modifyAllRecords: false,
    });
    expect(resolved.allowRead).toBe(true);
    expect(autoEnabled).toContain('allowRead');
  });

  it('should auto-enable Read when Create is selected', () => {
    const { resolved, autoEnabled } = resolveObjectDependencies({
      allowRead: false,
      allowCreate: true,
      allowEdit: false,
      allowDelete: false,
      viewAllRecords: false,
      modifyAllRecords: false,
    });
    expect(resolved.allowRead).toBe(true);
  });

  it('should auto-enable full chain for Modify All', () => {
    const { resolved, autoEnabled } = resolveObjectDependencies({
      allowRead: false,
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
      viewAllRecords: false,
      modifyAllRecords: true,
    });
    expect(resolved.allowRead).toBe(true);
    expect(resolved.allowEdit).toBe(true);
    expect(resolved.allowDelete).toBe(true);
    expect(resolved.viewAllRecords).toBe(true);
    expect(resolved.modifyAllRecords).toBe(true);
  });

  it('should auto-enable Read, Edit, Delete for View All', () => {
    const { resolved } = resolveObjectDependencies({
      allowRead: false,
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
      viewAllRecords: true,
      modifyAllRecords: false,
    });
    expect(resolved.allowRead).toBe(true);
    expect(resolved.allowEdit).toBe(true);
    expect(resolved.allowDelete).toBe(true);
    expect(resolved.viewAllRecords).toBe(true);
  });

  it('should not auto-enable anything when only Read is selected', () => {
    const { resolved, autoEnabled } = resolveObjectDependencies({
      allowRead: true,
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
      viewAllRecords: false,
      modifyAllRecords: false,
    });
    expect(autoEnabled).toEqual([]);
    expect(resolved.allowEdit).toBe(false);
  });

  it('should not change already-enabled permissions', () => {
    const { autoEnabled } = resolveObjectDependencies({
      allowRead: true,
      allowCreate: false,
      allowEdit: true,
      allowDelete: true,
      viewAllRecords: true,
      modifyAllRecords: false,
    });
    expect(autoEnabled).toEqual([]);
  });
});

describe('resolveFieldDependencies', () => {
  it('should auto-enable Read when Edit is selected', () => {
    const { resolved, autoEnabled } = resolveFieldDependencies({
      readable: false,
      editable: true,
    });
    expect(resolved.readable).toBe(true);
    expect(autoEnabled).toContain('readable');
  });

  it('should not change when only Read is selected', () => {
    const { autoEnabled } = resolveFieldDependencies({
      readable: true,
      editable: false,
    });
    expect(autoEnabled).toEqual([]);
  });
});
