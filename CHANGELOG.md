# Changelog

## Unreleased

### feat: project scaffold and core CLI
- Initialized project with TypeScript, ESM, vitest, eslint, prettier
- Created CLI entry point with `--help` and `--version` flags
- Environment validation: checks for `sfdx-project.json` and authenticated org

### feat: org metadata fetch
- Fetch object list from org via `sf sobject list`
- On-demand field fetch per object via `sf sobject describe`
- Discover local permission set files by scanning package directories

### feat: interactive wizard with fuzzy search
- Fuzzy search for objects using `inquirer-autocomplete-prompt` and `fuse.js`
- Fuzzy search for fields per selected object
- Iterative selection: pick one, confirm to add another, or finish

### feat: permission assignment modes (bulk and granular)
- Bulk mode: same permissions applied to all selected objects/fields
- Granular mode: individual permission selection per object/field
- Mode prompt shown automatically when multiple items are selected

### feat: permission dependency auto-enforcement
- Object: Modify All -> View All -> Delete -> Edit -> Read
- Field: Edit -> Read
- Auto-enabled dependencies shown in preview

### feat: XML mutation engine
- Parse and serialize permission set XML via `fast-xml-parser` with `preserveOrder`
- Update existing object/field permission entries (merge, never downgrade)
- Insert new entries in alphabetical order
- Create new permission set files from scratch
- Preserve indentation style of existing files
- Clean output with no blank lines

### fix: XML blank lines on re-serialization
- Switched to `trimValues: true` in parser to prevent whitespace text node duplication
- Added safety-net regex to collapse any remaining blank lines

### fix: existing permissions never overwritten
- When updating an existing entry, only permissions explicitly set to `true` are applied
- Permissions the user did not select are left untouched in the file

### docs: README and unlink instructions
- Added README.md with installation, usage, examples, and feature list
- Added UNLINK.txt with steps to remove the global CLI link
