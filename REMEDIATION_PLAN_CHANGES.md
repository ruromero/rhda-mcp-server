# Remediation Plan Tool - Strengthened Constraints

## Summary

Changed `generate_remediation_plan` tool to return **formatted markdown with strong constraints** instead of raw JSON to prevent AI agents from automatically executing remediation steps without user approval.

## Problem

When using Cursor Agent mode, the AI would:
1. Call `generate_remediation_plan` and receive the plan
2. See phrases like "see advisory or release notes for the version number" in detailed action descriptions
3. Interpret these as tasks: "I need to search for the version number"
4. Search online, find a version, and immediately apply patches/upgrades without user approval

## Solution - Multi-Layered Defense

### Layer 1: STOP at the Top (CRITICAL)
**Put the constraint first** - the AI reads sequentially, so the first instruction has the most weight.

The markdown output now starts with:
```markdown
## STOP - DO NOT IMPLEMENT

**You MUST NOT implement any changes, search for versions, or read the stored plan yet.**

**The ONLY action allowed:** Present the options below and ask the user which one to implement.

---
```

### Layer 2: Minimal Information Exposure
Remove all detailed action plans, instructions, preconditions, and expected outcomes from the initial response. Only show:
- Overall risks
- Recommended safe default (name and risks only)
- Available options (simple numbered list)

### Layer 3: Strong Imperative Language
Changed from "Do NOT" to **"MUST NOT"** and **"NEVER"** throughout:
- "You MUST NOT search for versions online"
- "You MUST NOT read the stored plan until the user chooses"
- "You MUST NOT make any file changes"

### Layer 4: Explicit "Only Allowed" Action
Instead of just prohibitions, give a clear positive instruction:
- "The ONLY action allowed: Present the options and ask the user which one to implement"

### Layer 5: Closing Reinforcement
End the markdown with:
```markdown
**Your next reply MUST only present the options and ask the user to choose.
Do not implement, do not search for versions, do not read the plan yet.**
```

### Layer 6: Tool Description Strengthening
Updated the tool's schema description in `server.ts` with the same constraints:
```
**CRITICAL CONSTRAINT: After calling this tool you MUST present the options
to the user and WAIT for their choice. You MUST NOT implement, search for
versions, or read the stored plan until the user has chosen.**
```

### Layer 7: Prompt Strengthening
Updated `fixDependencyVulnerabilities.ts` prompt with matching language:
```
**You MUST NOT (until user chooses):**
- Search for versions online or query package registries
- Read the rhda://remediation/latest resource
- Modify manifest files
- Run commands
- Look up version numbers
```

## New Markdown Output Structure

```markdown
## STOP - DO NOT IMPLEMENT

**You MUST NOT implement any changes, search for versions, or read the stored plan yet.**

**The ONLY action allowed:** Present the options below and ask the user which one to implement.

---

# Remediation Plan for CVE-2026-23950

**Package:** pkg:npm/tar@6.1.1

## Overall Risks
- Version 6.1.1 is within affected range and not yet fixed

## Recommended Safe Default
**code_change** - CodeChange (High confidence, GitHub advisory)

**Risks:**
- This upgrade introduces breaking API changes
- Code adjustments may be required

## Available Remediation Options
1. **patch_upgrade** (strong confidence) - PatchUpgrade: Fix available in upstream
2. **code_change** (strong confidence) - CodeChange: Code changes or workarounds suggested
3. **alternative_library** (strong confidence) - AlternativeLibrary: No fix available

---

## STOP - User Decision Required

**The ONLY action allowed now:**
Present the options above to the user and ask: 'Which option do you want to implement (1, 2, 3, or the safe default)?'

Then **WAIT for the user's reply.** Do nothing else.

**You MUST NOT:**
- Search for versions online or query npm/package registries
- Read the `rhda://remediation/latest` resource before the user chooses
- Make any file changes (package.json, pom.xml, etc.)
- Run any commands (npm install, mvn, etc.)
- Look up version numbers or release information

**After user chooses (workflow):**
1. Read the `rhda://remediation/latest` resource
2. Find the matching action in `plan.actions[]` or `plan.safe_defaults[]`
3. Extract the `instructions` array from that action
4. Implement those instructions exactly (following the VERSION RULE)

---

**Your next reply MUST only present the options and ask the user to choose.
Do not implement, do not search for versions, do not read the plan yet.**
```

## Benefits

1. **STOP First** - Constraint appears before any remediation details, catches AI attention immediately
2. **Strong Language** - MUST NOT / NEVER instead of "Do NOT" creates stronger imperative
3. **Explicit Allowed Action** - Positive instruction prevents confusion about what to do
4. **Closing Reinforcement** - Repeat constraint at the end for reinforcement
5. **Minimal Exposure** - No detailed instructions visible; all hidden in `rhda://remediation/latest` until user approves
6. **Explicit Prohibitions** - Specific list of banned actions (search, read plan early, modify files, run commands)
7. **Multi-Layer Defense** - Same constraints in tool output, tool description, and prompt
8. **Clean Semantic Markdown** - No emojis; semantic structure that's easy for LLMs to parse

## Implementation Details Are Hidden

All detailed instructions (version numbers, file paths, commands) remain in `rhda://remediation/latest` but are **NOT shown** until the user chooses an option.

Example:
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

## Example Workflow

**Before (with detailed action plans visible):**
```
AI: [calls generate_remediation_plan]
AI: [sees "see advisory or release notes for the version number"]
AI: "Let me search for the tar version that includes the fix..."
AI: [searches npm, finds version 7.5.4]
AI: [updates package.json to 7.5.4]
User: "Wait, I didn't approve that!"
```

**After (with strengthened constraints):**
```
AI: [calls generate_remediation_plan]
AI: [sees "STOP - DO NOT IMPLEMENT" at the very top]
AI: [sees "MUST NOT search for versions online"]
AI: [sees "The ONLY action allowed: Present options and ask"]
AI: "Here are the remediation options for CVE-2026-23950:
     1. patch_upgrade (strong confidence)
     2. code_change (strong confidence) - Recommended Safe Default
     3. alternative_library (strong confidence)

     Risks: Breaking API changes may be required

     Which option do you want to implement (1, 2, 3, or the safe default)?"
[STOPS and WAITS]
User: "Let's go with option 1"
AI: [NOW reads rhda://remediation/latest resource]
AI: [extracts plan.actions[0].instructions for patch_upgrade]
AI: [implements exact version from instructions: "7.5.4"]
```

## Files Changed

1. `src/tools/remediationPlan.ts`
   - Added STOP header at the very top of markdown output
   - Changed "Do NOT" to "MUST NOT" throughout
   - Added "ONLY action allowed" instruction
   - Added closing reinforcement instruction
   - Removed detailed action plans section (minimal info exposure)

2. `src/server.ts`
   - Updated tool description with "CRITICAL CONSTRAINT" header
   - Added "REQUIRED BEHAVIOR" section
   - Changed "Do NOT" to "MUST NOT"
   - Added explicit list of prohibited actions

3. `src/prompts/fixDependencyVulnerabilities.ts`
   - Updated Step 4 with "YOU MUST NOT" header
   - Added explicit "MUST NOT" list
   - Clarified workflow after user chooses

4. `examples/remediation-plan-output-example.md`
   - Created example showing the new strengthened output format

## Testing

Run TypeScript type check:
```bash
npx tsc --noEmit
```
✅ Passed - No compilation errors

## Next Steps to Consider (Not Yet Implemented)

If the strengthened constraints still don't prevent auto-execution, consider:

### Option 1: Project-Specific Cursor Rules
Create `.cursorrules` in your project:
```
When RHDA remediation plan is returned:
- MUST present options to user and WAIT for choice
- NEVER search for versions online
- NEVER implement before user approval
```

### Option 2: Two-Step Tool Flow (Nuclear Option)
Split into two separate tools:
- `generate_remediation_plan` - Returns plan, cannot implement
- `apply_remediation_option` - Takes option_id, reads plan, implements

This makes it architecturally impossible to implement without user choice, but adds complexity.
