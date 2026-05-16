# AGID C ABI (canonical low-level surface)

These symbols are exported by the Rust core (`native/agid-core/src/lib.rs`) and are the baseline for FFI SDKs.

- `uint32_t agid_get_quantized_face(double lat, double lon)`
- `uint32_t agid_get_quantized_qx(double lat, double lon)`
- `uint32_t agid_get_quantized_qy(double lat, double lon)`
- `uint32_t agid_encode_hilbert_hi(uint32_t qx, uint32_t qy)`
- `uint32_t agid_encode_hilbert_lo(uint32_t qx, uint32_t qy)`
- `uint32_t agid_decode_hilbert_x(uint32_t hi, uint32_t lo)`
- `uint32_t agid_decode_hilbert_y(uint32_t hi, uint32_t lo)`
- `double agid_get_lat(uint32_t face, uint32_t qx, uint32_t qy)`
- `double agid_get_lon(uint32_t face, uint32_t qx, uint32_t qy)`

