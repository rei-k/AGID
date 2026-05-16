# agid-php

PHP SDK scaffold for AGID.

Canonical API (target):
- `encode(float $lat, float $lon): array`
- `decode(string $id): ?array`
- `quantize(float $lat, float $lon): array`
- `dequantize(int $face, int $qx, int $qy): array`

Spec: `../agid-spec/README.md`
