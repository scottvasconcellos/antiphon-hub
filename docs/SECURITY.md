# Security

## Artifact Trust Requirements

Each downloadable release artifact includes:

- SHA-256 digest
- Ed25519 signature

Each release manifest includes:

- manifest signature (Ed25519)

## Verification Sequence

Before install, Hub verifies:

1. Manifest signature
2. Artifact signature
3. Artifact SHA-256 digest

Install is blocked if any verification fails.

## Secret Handling

- Tokens and sensitive credentials are stored in OS keychain (`keyring` crate).
- SQLite keeps non-secret state only (registry/settings).
- Local logs contain operational diagnostics and error codes, not secrets.

## Logging

- Rotating local logs under Hub data local directory
- Download/install lifecycle and error code tracing for supportability

## Telemetry

No forced telemetry in this foundation.
