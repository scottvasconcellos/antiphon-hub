# Diagnostics Self-Test

## Purpose

Developer-facing verification tool for Build Pyramid Phases 1-4.

It provides one-click checks for:

- bootstrap gate and platform behavior
- workflow skeleton wiring
- state predictability invariants
- hardening stubs (responsive, keyboard, logs, support payload)

This is tooling only. It does not add real install/licensing/updater/backend behavior.

## Availability

- Shown in dev builds by default (`Diagnostics` nav item).
- Can also be forced with query flag `?diag=1`.

Production builds are unaffected unless diagnostics is explicitly enabled.

## Runtime Field Meanings

- `isTauri`: Tauri runtime bridge detection (`window.__TAURI__` / internals available).
- `platformDetected`: same value as `isTauri` in this stage (desktop bridge availability).
- `mockMode`: dev mock-mode toggle state.

Diagnostics runtime summary and support-bundle runtime flags are sourced from the same runtime service to avoid drift.

## How To Use

1. Open `Diagnostics` in the left nav.
2. Click `Run Self-Test`.
3. Review PASS / FAIL / SKIPPED rows.
4. Export JSON with `Export Self-Test Report (JSON)` or copy with `Copy Report`.

## Report Shape

```json
{
  "timestamp": "ISO-8601",
  "runtime": {
    "platformDetected": true,
    "isTauri": true,
    "mockMode": false,
    "os": "mac",
    "arch": "arm64",
    "version": "0.1.0",
    "buildMode": "development"
  },
  "checks": [
    {
      "id": "P1.1",
      "phase": "Phase 1",
      "name": "Hard gate active",
      "status": "PASS",
      "details": "...",
      "remediationHint": "..."
    }
  ],
  "summary": { "pass": 0, "fail": 0, "skipped": 0 }
}
```

## Check Behavior Notes

- Every check is isolated and wrapped in try/catch.
- Unsupported checks return `SKIPPED` with reason.
- Browser-only checks (for example overflow probes) are skipped in Tauri runtime.
- No check is allowed to crash the app; failures are reported as rows with remediation hints.
- Route rendering checks use stable route marker contract:
  - `route-products`
  - `route-installed`
  - `route-updates`
  - `route-licenses`
  - `route-account`
  - `route-settings`
  - `route-diagnostics` (when diagnostics is enabled)
- Markers are attached at route shell level so they remain stable through loading/empty child content.
- Self-test is non-invasive: checks do not emit global toasts/banners outside Diagnostics.
- Overflow checks run in an offscreen iframe viewport (1280/1024/768/480) so media-query breakpoints are evaluated correctly.
- Overflow failures include ranked culprit metadata (selector path, testid, role/tag, widths, min-width, white-space, overflow-x) to make 480/viewport regressions actionable.
