# agid-kotlin

Kotlin SDK scaffold for AGID.

Canonical API (target):
- `fun encode(lat: Double, lon: Double): EncodedAgid`
- `fun decode(id: String): DecodedAgid?`
- `fun quantize(lat: Double, lon: Double): Quantized`
- `fun dequantize(face: UInt, qx: UInt, qy: UInt): LatLon`

Spec: `../agid-spec/README.md`
