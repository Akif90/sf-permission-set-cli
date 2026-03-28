# Permcraft

Interactive CLI tool that lets Salesforce developers manage permission set XML files without manually editing XML. Express your permission intent once, and Permcraft applies it across multiple permission sets.

## What it does

- Fetches objects and fields from your connected Salesforce org
- Lets you search and select objects/fields using fuzzy search
- Shows existing permissions already set in your permission set files
- Assigns object permissions (Read, Create, Edit, Delete, View All, Modify All) and field permissions (Read, Edit)
- Supports toggling permissions on/off — both granting and revoking
- Applies selected permissions to one or more local `.permissionset-meta.xml` files
- Automatically enforces permission dependencies (e.g., selecting Edit auto-enables Read)
- Supports two permission modes: **Bulk** (same permissions across all selections) and **Granular** (different permissions per object/field)
- Shows a diff preview before applying: `+added`, `-removed`, `=unchanged`

## Prerequisites

- **Node.js** v18 or later
- **Salesforce CLI (`sf`)** installed and available in your PATH
- An **authenticated Salesforce org** connected via `sf org login web`
- Must be run inside a **Salesforce DX project** (directory containing `sfdx-project.json`)

## Installation

```bash
# Install globally
npm install -g permcraft

# Or run without installing
npx permcraft
```

## Usage

Navigate to your SFDX project directory and run:

```bash
permcraft
```

Or without a global install:

```bash
npx permcraft
```

### Options

```
-h, --help     Show help message
-v, --version  Show version number
```

### Uninstalling

```bash
npm uninstall -g permcraft
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
> Account

  Added: Account
? Add another object? Yes

? Selected: [Account] — Search for another object (or type "done"): cas
> Case

  Added: Case
? Add another object? No

Selected objects: Account, Case

Fetching fields for Account...
Found 72 fields.

Start typing to search for a field on Account.

? Search for a field on Account: indus
> Account.Industry

  Added: Account.Industry
? Add another field? No

Fetching fields for Case...
Found 58 fields.

Start typing to search for a field on Case.

? Search for a field on Case: stat
> Case.Status

  Added: Case.Status
? Add another field? No

Scanning local permission sets...
Found 3 permission sets.

? Select permission sets to update (press <space> to select, <enter> to confirm)
 [x] Sales_User
 [x] Support_User
 [ ] Admin

? How would you like to assign permissions?
> Bulk — same permissions for all selected objects/fields

  Currently set — Sales_User: Read | Support_User: (none)
? Permissions for 2 objects (Account, Case) (Press <space> to select)
 [x] Read
 [x] Create
 [x] Edit
 [ ] Delete
 [ ] View All
 [ ] Modify All

  Currently set — Sales_User: Read | Support_User: (none)
? Permissions for 2 fields (Press <space> to select)
 [x] Read
 [ ] Edit

--- Preview ---

Permission Set: Sales_User
  Account: +Create, Edit  =Read
  Case: +Create, Edit  =Read
  Account.Industry: =Read
  Case.Status: +Read

Permission Set: Support_User
  Account: +Read, Create, Edit
  Case: +Read, Create, Edit
  Account.Industry: +Read
  Case.Status: +Read

  Legend: +added  -removed  =unchanged

? Apply these changes? Yes

Applying changes...

  Updating .../permissionsets/Sales_User.permissionset-meta.xml
  Updating .../permissionsets/Support_User.permissionset-meta.xml

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

Scanning local permission sets...
Found 2 permission sets.

? Select permission sets to update (press <space> to select, <enter> to confirm)
 [x] Sales_User

? How would you like to assign permissions?
> Granular — different permissions for each object/field

  Currently set — Sales_User: Read, Create, Edit, Delete
? Permissions for Account
 [x] Read
 [x] Create
 [x] Edit
 [ ] Delete
 [ ] View All
 [ ] Modify All

  Currently set — Sales_User: Read
? Permissions for Case
 [x] Read
 [x] Create
 [ ] Edit
 [ ] Delete
 [ ] View All
 [ ] Modify All

  Currently set — Sales_User: Read, Edit
? Permissions for Account.AnnualRevenue
 [x] Read
 [x] Edit

  Currently set — Sales_User: Read
? Permissions for Case.Priority
 [x] Read
 [ ] Edit

--- Preview ---

Permission Set: Sales_User
  Account: -Delete  =Read, Create, Edit
  Case: +Create  =Read
  Account.AnnualRevenue: =Read, Edit
  Case.Priority: =Read

  Legend: +added  -removed  =unchanged

? Apply these changes? Yes

Applying changes...

  Updating .../permissionsets/Sales_User.permissionset-meta.xml

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
- Viewing existing permissions before making changes
- Toggling permissions on and off (granting and revoking)
- Diff preview showing additions, removals, and unchanged permissions
- Updating existing permission set XML files
- Preserving XML formatting and indentation style of existing files
- Applying permissions across multiple permission sets in a single session

## What it does not support (yet)

- Non-interactive / CI mode (flags and arguments for scripting)
- Tab permissions (TabVisibility)
- Apex class and Visualforce page access
- Record type assignments
- Application visibility
- Custom permission assignments
- Profile metadata editing (only permission sets)
- Deploying changes to the org (use `sf project deploy start` after running permcraft)

## Development

```bash
git clone https://github.com/Akif90/sf-permission-set-cli.git
cd sf-permission-set-cli
npm install       # install dependencies
npm run build     # compile TypeScript
npm run dev       # run without building (uses tsx)
npm test          # run test suite
npm run lint      # lint source files
npm run format    # format source files
```

## License

MIT
