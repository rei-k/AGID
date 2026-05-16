# agid-go

Go SDK scaffold for AGID.

Canonical API (target):
- `Encode(lat, lon float64) (EncodedAGID, error)`
- `Decode(id string) (*DecodedAGID, error)`
- `Quantize(lat, lon float64) (face, qx, qy uint32)`
- `Dequantize(face, qx, qy uint32) (lat, lon float64)`

Spec: `../agid-spec/README.md`
