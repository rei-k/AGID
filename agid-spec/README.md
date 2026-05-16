# agid-spec

AGID SDK群（agid-rs / agid-c / agid-cpp / agid-wasm / agid-js / agid-py / agid-go / agid-swift / agid-kotlin / agid-php）の共通仕様です。

## Canonical API

- `encode(lat, lon) -> EncodedAGID`
- `decode(id) -> DecodedAGID | null`
- `quantize(lat, lon) -> { face, qx, qy }`
- `dequantize(face, qx, qy) -> { lat, lon }`

## Canonical Types

### EncodedAGID
- `id: string` (12 chars = prefix(2) + hash(10))
- `prefix: string`
- `hash: string`
- `face: integer` (`0..5`)
- `isSea: boolean`

### DecodedAGID
- `lat: number`
- `lon: number`
- `prefix: string`
- `face: integer`
- `isSea: boolean`

## Canonical Constants
- `BASE32_ALPHABET = 0123456789ABCDEFGHJKMNPQRSTVWXYZ`
- `K = 2_097_152`
- `M = 2_097_151`
- face bits: `3`
- hilbert bits: `42`
- packed bits: `45`

## Compliance

各SDKは最低限以下を満たしてください。

1. `encode/decode` が `agid-spec/test-vectors.json` を満たす
2. 量子化・逆量子化の関数を公開
3. 無効ID入力時は例外クラッシュせず `null` / `None` / `nil` / `Result::Err` 等で返す

