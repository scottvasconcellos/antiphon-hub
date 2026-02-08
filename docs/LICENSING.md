# Licensing

## Model

- Perpetual-first licensing
- Optional account login for re-download history and future upgrade eligibility
- No forced sign-in for licensed usage

## Online Serial Activation

1. User enters serial + product.
2. Hub validates format locally.
3. Hub calls `POST /activate` with serial, device fingerprint, productId.
4. Hub receives signed token + signed license payload.
5. Hub stores token in keychain and writes license file.

## Offline Activation

1. Hub exports request JSON file (`offline-activation-request-*.json`).
2. User obtains signed response externally.
3. Hub imports response (`offline-activation-response-*.json`) and stores token.

## License File Output

Hub writes signed license files to shared locations:

- macOS: `~/Library/Application Support/Antiphon/licenses/<productId>.license`
- Windows: `%APPDATA%/Antiphon/licenses/<productId>.license`

Functional apps can verify signatures locally without always-on internet.
