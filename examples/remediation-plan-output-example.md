# Example: New Remediation Plan Output

This is what the AI agent sees when `generate_remediation_plan` is called.

---

# Remediation Plan for CVE-2026-23950

**Package:** pkg:npm/tar@6.1.1

## Overall Risks
- Version 6.1.1 is within affected range and not yet fixed

## Recommended Safe Default
**code_change** - CodeChange (High confidence, GitHub advisory): Code changes or workarounds suggested in mitigation claims

**Risks:**
- This upgrade to node-tar from version 6.1.1 to 7.5.4 introduces breaking changes in the API
- The workaround for using 'SymbolicLink' entries may require additional code adjustments

## Available Remediation Options
1. **patch_upgrade** (strong confidence) - PatchUpgrade (High confidence, vendor advisory): Fix available in upstream (commit 911c886bb170…). Use the package release that includes this fix — see advisory or release notes for the version number.
2. **code_change** (strong confidence) - CodeChange (High confidence, GitHub advisory): Code changes or workarounds suggested in mitigation claims
3. **alternative_library** (strong confidence) - AlternativeLibrary (High confidence, Red Hat): No fix available or no fix planned by vendor

---

## STOP - User Decision Required

**Ask the user which option they want to implement.**

The full remediation plan with detailed instructions is stored at:
- Resource: `rhda://remediation/latest`

**Workflow:**
1. Present the options above to the user
2. Wait for the user to choose an option (e.g., 'option 1', 'patch_upgrade', 'the safe default')
3. After user chooses, read the `rhda://remediation/latest` resource
4. Find the matching action in `plan.actions[]` or `plan.safe_defaults[]`
5. Extract the `instructions` array from that action
6. Implement those instructions exactly (following the VERSION RULE)

**Do NOT:**
- Search for versions online
- Read the stored plan before user chooses
- Make any file changes or run any commands now

---

## Key Differences from Old Format

### Removed:
- ❌ "Detailed Action Plans" section (contained actionable instructions like "Upgrade to version 7.5.4")
- ❌ Preconditions from safe default section
- ❌ Expected outcomes from safe default section
- ❌ Per-action breakdowns with detailed instructions visible

### What AI Sees Now:
- ✅ Simple numbered list of options
- ✅ Risks (to inform decision)
- ✅ Clear STOP instruction
- ✅ Explicit workflow steps
- ✅ Explicit "Do NOT" prohibitions

### Implementation Details (Hidden Until User Approves):
The detailed instructions are in `rhda://remediation/latest`:

```json
{
  "plan": {
    "actions": [
      {
        "kind": "patch_upgrade",
        "instructions": [
          {
            "domain": "dependency",
            "action": "Upgrade node-tar to version 7.5.4",
            "parameters": {
              "version": "7.5.4",
              "file_path": "package.json",
              "package_name": "tar"
            }
          }
        ]
      }
    ]
  }
}
```

These details are **NOT visible** to the AI until it reads the resource after user approval.
