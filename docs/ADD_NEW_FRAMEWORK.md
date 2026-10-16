# Adding a New Compliance Framework (Zero Code Modification Guide)

The **Firewall Audit Analyzer** is built on a **Derived Compliance Architecture (Crosswalk Engine)**. Under this design, technical configuration parsing and rules verification are performed **once** against standard benchmarks (such as **CIS FortiGate Benchmark**). Compliance with secondary security frameworks (such as NIST CSF, ISO 27001, PCI DSS, Cyber Trust Mark, or custom internal standards) is derived dynamically through control mappings.

You can add any new security framework to the application **without modifying any TypeScript code or database schema**. Everything is driven by JSON data seed files.

---

## 1. Step-by-Step Instructions

### Step 1: Define the Framework & Controls
Open `supabase/seed/frameworks.json` and append your new framework object inside the `"frameworks"` array.

Ensure that you classify each control's `"coverage_type"` honestly:
- `"automated"`: Can be 100% evaluated via firewall configuration directives (e.g. password policies, SNMP settings, logging rules).
- `"partial"`: Can be partially evaluated via configuration, but requires supplementary verification.
- `"manual"`: Requires manual governance review, interview, or document audit by a lead auditor (e.g. organizational security policies, staff training records).
- `"not_covered"`: Falls outside network firewall configuration scope (e.g. physical datacenter locks, biometric access controls).

### Step 2: Define Crosswalk Mappings to CIS Rules
Open `supabase/seed/mappings_cis_fortigate.json` and append mapping objects inside the `"mappings"` array that link your new framework controls to existing CIS technical rule codes.

---

## 2. Example JSON Structure

### Adding to `supabase/seed/frameworks.json`

```json
{
  "code": "SOC2_TYPE2",
  "name": "SOC 2 Type II (Trust Services Criteria)",
  "version": "2017 TSC",
  "description": "AICPA Trust Services Criteria for Security, Availability, and Confidentiality.",
  "is_technical": true,
  "controls": [
    {
      "control_code": "CC6.1",
      "title": "Logical Access Security & Boundary Protection",
      "category": "Logical and Physical Access Controls",
      "coverage_type": "automated",
      "guidance": "Firewall rules must restrict unauthorized external traffic and enforce strong authentication."
    },
    {
      "control_code": "CC6.6",
      "title": "Boundary Protection & Network Hardening",
      "category": "Logical and Physical Access Controls",
      "coverage_type": "partial",
      "guidance": "Verify boundary defenses and inspect encrypting tunnels for remote admin access."
    },
    {
      "control_code": "CC1.1",
      "title": "COSO Principle 1: Integrity & Ethical Values",
      "category": "Control Environment",
      "coverage_type": "manual",
      "guidance": "Auditor must review executive code of conduct and annual employee compliance sign-offs."
    }
  ]
}
```

### Adding to `supabase/seed/mappings_cis_fortigate.json`

```json
{
  "framework": "SOC2_TYPE2",
  "control_code": "CC6.1",
  "rules": ["2.1.1", "2.1.2", "2.1.4", "2.1.5", "5.1.1", "5.1.2"],
  "vendor": "fortigate",
  "strength": "full",
  "note": "Maps FortiGate administrative encryption and login lockout rules directly to SOC 2 CC6.1."
}
```

---

## 3. How the Engine Evaluates Your Framework

Once added to the JSON seed files:
1. **Idempotent Loading**: The engine (`framework-seed-importer.ts`) automatically loads your framework into the runtime catalog and registers all control-to-rule crosswalk mappings.
2. **Dynamic Lens Switcher**: The UI (`FrameworkLensSwitcher.tsx`) will immediately display a selector tab for **SOC 2 Type II**.
3. **Honest Coverage Calculation**: When selected during an audit or report review, the evaluator (`framework-evaluator.ts`) will calculate the exact percentage of controls that were automatically evaluated vs. controls requiring manual governance verification.
4. **Formal Printable Reports**: Printable reports generated from the Report Viewer will include your framework's custom header, adherence scorecard, code evidence tables, and auditor governance instructions without extra coding.
