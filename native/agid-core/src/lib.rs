const K: u32 = 2_097_152; // 2^21
const M: u32 = 2_097_151; // 2^21 - 1

#[inline]
fn apply_equal_area(val: f64) -> f64 {
    (val * std::f64::consts::PI / 4.0).tan()
}

#[inline]
fn invert_equal_area(val: f64) -> f64 {
    val.atan() * 4.0 / std::f64::consts::PI
}

fn get_quantized(lat: f64, lon: f64) -> (u32, u32, u32) {
    let phi = lat * std::f64::consts::PI / 180.0;
    let theta = lon * std::f64::consts::PI / 180.0;

    let x = phi.cos() * theta.cos();
    let y = phi.cos() * theta.sin();
    let z = phi.sin();

    let abs_x = x.abs();
    let abs_y = y.abs();
    let abs_z = z.abs();

    let (face, uc, vc) = if abs_x >= abs_y && abs_x >= abs_z {
        if x > 0.0 {
            (0u32, y, z)
        } else {
            (1u32, -y, z)
        }
    } else if abs_y >= abs_x && abs_y >= abs_z {
        if y > 0.0 {
            (2u32, -x, z)
        } else {
            (3u32, x, z)
        }
    } else if z > 0.0 {
        (4u32, -x, -y)
    } else {
        (5u32, -x, y)
    };

    let max_val = abs_x.max(abs_y).max(abs_z);
    let xi = uc / max_val;
    let eta = vc / max_val;

    let u = 0.5 * (invert_equal_area(xi) + 1.0);
    let v = 0.5 * (invert_equal_area(eta) + 1.0);

    let qx = ((u * K as f64).floor() as i64).clamp(0, M as i64) as u32;
    let qy = ((v * K as f64).floor() as i64).clamp(0, M as i64) as u32;
    (face, qx, qy)
}

fn get_from_quantized(face: u32, qx: u32, qy: u32) -> (f64, f64) {
    let u = (qx as f64 / K as f64) * 2.0 - 1.0;
    let v = (qy as f64 / K as f64) * 2.0 - 1.0;

    let xi = apply_equal_area(u);
    let eta = apply_equal_area(v);

    let (mut x, mut y, mut z) = match face {
        0 => (1.0, xi, eta),
        1 => (-1.0, -xi, eta),
        2 => (-xi, 1.0, eta),
        3 => (xi, -1.0, eta),
        4 => (-xi, -eta, 1.0),
        5 => (-xi, eta, -1.0),
        _ => (1.0, xi, eta),
    };

    let length = (x * x + y * y + z * z).sqrt();
    x /= length;
    y /= length;
    z /= length;

    let lat = z.asin() * 180.0 / std::f64::consts::PI;
    let lon = y.atan2(x) * 180.0 / std::f64::consts::PI;
    (lat, lon)
}

#[inline]
fn rot(n: u32, mut x: u32, mut y: u32, rx: u32, ry: u32) -> (u32, u32) {
    if ry == 0 {
        if rx == 1 {
            x = n - 1 - x;
            y = n - 1 - y;
        }
        return (y, x);
    }
    (x, y)
}

fn encode_hilbert(n: u32, mut x: u32, mut y: u32) -> u64 {
    let mut d = 0u64;
    let mut s = n / 2;
    while s > 0 {
        let rx = if (x & s) > 0 { 1u32 } else { 0u32 };
        let ry = if (y & s) > 0 { 1u32 } else { 0u32 };
        d += (s as u64) * (s as u64) * (((3 * rx) ^ ry) as u64);
        let (nx, ny) = rot(s, x, y, rx, ry);
        x = nx;
        y = ny;
        s /= 2;
    }
    d
}

fn decode_hilbert(n: u32, d: u64) -> (u32, u32) {
    let mut x = 0u32;
    let mut y = 0u32;
    let mut t = d;
    let mut s = 1u32;

    while s < n {
        let rx = ((t / 2) & 1) as u32;
        let ry = ((t ^ rx as u64) & 1) as u32;
        let (nx, ny) = rot(s, x, y, rx, ry);
        x = nx + s * rx;
        y = ny + s * ry;
        t /= 4;
        s *= 2;
    }
    (x, y)
}

#[unsafe(no_mangle)]
pub extern "C" fn agid_get_quantized_face(lat: f64, lon: f64) -> u32 {
    let (face, _, _) = get_quantized(lat, lon);
    face
}

#[unsafe(no_mangle)]
pub extern "C" fn agid_get_quantized_qx(lat: f64, lon: f64) -> u32 {
    let (_, qx, _) = get_quantized(lat, lon);
    qx
}

#[unsafe(no_mangle)]
pub extern "C" fn agid_get_quantized_qy(lat: f64, lon: f64) -> u32 {
    let (_, _, qy) = get_quantized(lat, lon);
    qy
}

#[unsafe(no_mangle)]
pub extern "C" fn agid_encode_hilbert_hi(qx: u32, qy: u32) -> u32 {
    let d = encode_hilbert(K, qx.min(M), qy.min(M));
    (d >> 32) as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn agid_encode_hilbert_lo(qx: u32, qy: u32) -> u32 {
    let d = encode_hilbert(K, qx.min(M), qy.min(M));
    (d & 0xFFFF_FFFF) as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn agid_decode_hilbert_x(hi: u32, lo: u32) -> u32 {
    let d = ((hi as u64) << 32) | lo as u64;
    let (x, _) = decode_hilbert(K, d);
    x
}

#[unsafe(no_mangle)]
pub extern "C" fn agid_decode_hilbert_y(hi: u32, lo: u32) -> u32 {
    let d = ((hi as u64) << 32) | lo as u64;
    let (_, y) = decode_hilbert(K, d);
    y
}

#[unsafe(no_mangle)]
pub extern "C" fn agid_get_lat(face: u32, qx: u32, qy: u32) -> f64 {
    let (lat, _) = get_from_quantized(face, qx.min(M), qy.min(M));
    lat
}

#[unsafe(no_mangle)]
pub extern "C" fn agid_get_lon(face: u32, qx: u32, qy: u32) -> f64 {
    let (_, lon) = get_from_quantized(face, qx.min(M), qy.min(M));
    lon
}
