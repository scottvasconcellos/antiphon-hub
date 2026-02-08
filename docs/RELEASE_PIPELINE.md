# Release Pipeline

## Objective

Publish signed artifacts and manifests consumable by Hub without client updates.

## Publish Steps

1. Build standalone product installers/artifacts by OS/arch.
2. Compute SHA-256 for each artifact.
3. Build release manifest with artifact metadata.
4. Sign each artifact metadata payload (Ed25519).
5. Sign unsigned release manifest payload (Ed25519).
6. Publish artifacts + manifest to CDN/storage.
7. Update catalog endpoint with latest product versions/channels.

## Hub Contract Surface

- `GET /catalog`
- `GET /releases/:productId`
- `POST /activate`
- `GET /account/products`

## Dev Utilities in This Repo

- `data/manifests/*`: local signed dev manifests
- `scripts/smoke_install_dummy.mjs`: verifies signatures/hashes and extracts dummy artifact

## Production Swap Points

- Replace mock server with production API service
- Rotate public keys using controlled release process
- Enforce CI signing step so unsigned artifacts never publish
