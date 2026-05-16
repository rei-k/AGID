# agid-py

Python SDK scaffold for AGID.

Canonical API (target):
- `encode(lat: float, lon: float) -> EncodedAGID`
- `decode(id: str) -> DecodedAGID | None`
- `quantize(lat: float, lon: float) -> tuple[int, int, int]`
- `dequantize(face: int, qx: int, qy: int) -> tuple[float, float]`

Spec: `../agid-spec/README.md`
