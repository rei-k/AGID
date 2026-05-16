# agid-swift

Swift SDK scaffold for AGID.

Canonical API (target):
- `encode(lat: Double, lon: Double) throws -> EncodedAGID`
- `decode(id: String) throws -> DecodedAGID?`
- `quantize(lat: Double, lon: Double) -> (face: UInt32, qx: UInt32, qy: UInt32)`
- `dequantize(face: UInt32, qx: UInt32, qy: UInt32) -> (lat: Double, lon: Double)`

Spec: `../agid-spec/README.md`
