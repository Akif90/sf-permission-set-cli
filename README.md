# Permcraft

Interactive CLI tool that lets Salesforce developers manage permission set XML files without manually editing XML. Express your permission intent once, and Permcraft applies it across multiple permission sets.

## What it does

- Fetches objects and fields from your connected Salesforce org
- Lets you search and select objects/fields using fuzzy search
- Assigns object permissions (Read, Create, Edit, Delete, View All, Modify All) and field permissions (Read, Edit)
- Applies selected permissions to one or more local `.permissionset-meta.xml` files
- Automatically enforces permission dependencies (e.g., selecting Edit auto-enables Read)
- Supports two permission modes: **Bulk** (same permissions across all selections) and **Granular** (different permissions per object/field)
- Never downgrades existing permissions — only adds or upgrades

## Prerequisites

- **Node.js** (LTS version)
- **Salesforce CLI (`sf`)** installed and available in your PATH
- An **authenticated Salesforce org** connected via `sf org login web`
- Must be run inside a **Salesforce DX project** (directory containing `sfdx-project.json`)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd salesforce-permission-cli

# Install dependencies
npm install

# Build
npm run build

# Link globally so "permcraft" is available anywhere
npm link
```

## Usage

Navigate to your SFDX project directory and run:

```bash
permcraft
```

### Options

```
-h, --help     Show help message
-v, --version  Show version number
```

### Uninstalling

To remove the global `permcraft` command:

```bash
cd /path/to/salesforce-permission-cli
npm unlink permcraft
```

## Walkthrough

### Example 1: Bulk mode — same permissions for multiple objects

```
$ permcraft

Permcraft — Salesforce Permission Set Editor

Checking environment...
  Project: /Users/dev/my-sfdx-project
  Org: admin@myorg.com

Fetching objects from org...
Found 847 objects.

Start typing to search for an object. Select it to add.

? Search for an object: acc
  Account
  AccountContactRole
  AccountTeamMember
> Account           # user selects Account

  Added: Account
? Add another object? Yes

? Selected: [Account] — Search for another object (or type "done"): cas
> Case              # user selects Case

  Added: Case
? Add another object? No

Selected objects: Account, Case

Fetching fields for Account...
Found 72 fields.

Start typing to search for a field on Account.

? Search for a field on Account: indus
> Account.Industry  # user selects Industry

  Added: Account.Industry
? Add another field? No

Fetching fields for Case...
Found 58 fields.

Start typing to search for a field on Case.

? Search for a field on Case: stat
> Case.Status       # user selects Status

  Added: Case.Status
? Add another field? No

? How would you like to assign permissions?
> Bulk — same permissions for all selected objects/fields

? Permissions for 2 objects (Account, Case) (Press <space> to select)
 [x] Read
 [x] Create
 [x] Edit
 [ ] Delete
 [ ] View All
 [ ] Modify All

? Permissions for 2 fields (Press <space> to select)
 [x] Read
 [ ] Edit

Scanning local permission sets...
Found 3 permission sets.

? Select permission sets to update (press <space> to select, <enter> to confirm)
 [x] Sales_User
 [x] Support_User
 [ ] Admin

--- Preview ---

Permission Set: Sales_User
  + Account: Read, Create, Edit
  + Case: Read, Create, Edit
  + Account.Industry: Read
  + Case.Status: Read

Permission Set: Support_User
  + Account: Read, Create, Edit
  + Case: Read, Create, Edit
  + Account.Industry: Read
  + Case.Status: Read

? Apply these changes? Yes

Applying changes...

  Updating /Users/dev/my-sfdx-project/force-app/main/default/permissionsets/Sales_User.permissionset-meta.xml
  Updating /Users/dev/my-sfdx-project/force-app/main/default/permissionsets/Support_User.permissionset-meta.xml

All changes applied successfully!
```

### Example 2: Granular mode — different permissions per object/field

```
$ permcraft

Permcraft — Salesforce Permission Set Editor

Checking environment...
  Project: /Users/dev/my-sfdx-project
  Org: admin@myorg.com

Fetching objects from org...
Found 847 objects.

Start typing to search for an object. Select it to add.

? Search for an object: Account
  Added: Account
? Add another object? Yes
? Selected: [Account] — Search for another object (or type "done"): Case
  Added: Case
? Add another object? No

Selected objects: Account, Case

Fetching fields for Account...
Found 72 fields.

Start typing to search for a field on Account.

? Search for a field on Account: Revenue
  Added: Account.AnnualRevenue
? Add another field? No

Fetching fields for Case...
Found 58 fields.

Start typing to search for a field on Case.

? Search for a field on Case: Priority
  Added: Case.Priority
? Add another field? No

? How would you like to assign permissions?
> Granular — different permissions for each object/field

? Permissions for Account
 [x] Read
 [x] Create
 [x] Edit
 [x] Delete
 [ ] View All
 [ ] Modify All

? Permissions for Case
 [x] Read
 [x] Create
 [ ] Edit
 [ ] Delete
 [ ] View All
 [ ] Modify All

? Permissions for Account.AnnualRevenue
 [x] Read
 [x] Edit

? Permissions for Case.Priority
 [x] Read
 [ ] Edit

Scanning local permission sets...
Found 2 permission sets.

? Select permission sets to update (press <space> to select, <enter> to confirm)
 [x] Sales_User

--- Preview ---

Permission Set: Sales_User
  + Account: Read, Create, Edit, Delete
  + Case: Read, Create
  + Account.AnnualRevenue: Read, Edit
  + Case.Priority: Read

? Apply these changes? Yes

Applying changes...

  Updating /Users/dev/my-sfdx-project/force-app/main/default/permissionsets/Sales_User.permissionset-meta.xml

All changes applied successfully!
```

### Example 3: Generated XML output

After running permcraft, the permission set XML file is updated cleanly:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <hasActivationRequired>false</hasActivationRequired>
    <label>Sales_User</label>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Case</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Industry</field>
        <readable>true</readable>
    </fieldPermissions>
</PermissionSet>
```

## Permission dependency rules

Permcraft automatically enforces Salesforce permission dependencies. When you select a permission, all its prerequisites are auto-enabled:

**Object permissions** (each implies all below it):

```
Modify All → View All → Delete → Edit → Read
```

**Field permissions:**

```
Edit → Read
```

Auto-enabled dependencies are shown in the preview before applying.

## What it supports

- Fuzzy search across all org objects and fields
- Object-level permissions: Read, Create, Edit, Delete, View All, Modify All
- Field-level permissions: Read, Edit
- Bulk and granular permission assignment modes
- Updating existing permission set XML files
- Creating new permission set XML files (for permission sets that exist in the org but not locally)
- Preserving existing permissions (never downgrades)
- Preserving XML formatting and indentation style of existing files
- Applying permissions across multiple permission sets in a single session

## What it does not support (yet)

- Non-interactive / CI mode (flags and arguments for scripting)
- Tab permissions (TabVisibility)
- Apex class and Visualforce page access
- Record type assignments
- Application visibility
- Custom permission assignments
- Removing or revoking permissions
- Profile metadata editing (only permission sets)
- Deploying changes to the org (use `sf project deploy start` after running permcraft)

## Development

```bash
npm install       # install dependencies
npm run build     # compile TypeScript
npm run dev       # run without building (uses tsx)
npm test          # run test suite
npm run lint      # lint source files
npm run format    # format source files
```

## License

MIT
