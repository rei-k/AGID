#ifndef AGID_C_H
#define AGID_C_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Canonical low-level ABI (from agid-spec/c-abi.md)
uint32_t agid_get_quantized_face(double lat, double lon);
uint32_t agid_get_quantized_qx(double lat, double lon);
uint32_t agid_get_quantized_qy(double lat, double lon);
uint32_t agid_encode_hilbert_hi(uint32_t qx, uint32_t qy);
uint32_t agid_encode_hilbert_lo(uint32_t qx, uint32_t qy);
uint32_t agid_decode_hilbert_x(uint32_t hi, uint32_t lo);
uint32_t agid_decode_hilbert_y(uint32_t hi, uint32_t lo);
double agid_get_lat(uint32_t face, uint32_t qx, uint32_t qy);
double agid_get_lon(uint32_t face, uint32_t qx, uint32_t qy);

#ifdef __cplusplus
}
#endif

#endif
