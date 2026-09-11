import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Nhiễu (noise) dùng chung
 *  Value noise 3D + fbm. Đủ mượt để làm da gà, đủ rẻ để chạy lúc khởi động.
 * ------------------------------------------------------------------ */

function hash3(x, y, z) {
    let h = x * 374761393 + y * 668265263 + z * 2147483647;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function valueNoise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = fade(xf), v = fade(yf), w = fade(zf);

    const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);

    return lerp(
        lerp(lerp(c(0,0,0), c(1,0,0), u), lerp(c(0,1,0), c(1,1,0), u), v),
        lerp(lerp(c(0,0,1), c(1,0,1), u), lerp(c(0,1,1), c(1,1,1), u), v),
        w
    );
}

export function fbm3(x, y, z, octaves = 4, lacunarity = 2.1, gain = 0.5) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * valueNoise3(x * freq, y * freq, z * freq);
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
    }
    return sum / norm;
}

/* ------------------------------------------------------------------ *
 *  Texture procedural
 *  Không tải ảnh từ ngoài — toàn bộ vẽ bằng canvas lúc khởi động.
 * ------------------------------------------------------------------ */

function makeCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return { canvas: c, ctx: c.getContext('2d'), size };
}

function toTexture(canvas, repeat = 1, colorSpace = null) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = 4;
    if (colorSpace) tex.colorSpace = colorSpace;
    return tex;
}

/**
 * Da gà luộc: nền vàng hổ phách, loang lổ chỗ đậm chỗ nhạt, rải lỗ chân lông
 * và vài nếp nhăn. Đây là thứ phá vỡ cảm giác "nhựa" nhiều nhất — một màu
 * phẳng tuyệt đối thì không bao giờ ra da.
 */
export function makeSkinTextures(size = 512) {
    const albedo = makeCanvas(size);
    const bump = makeCanvas(size);

    const aImg = albedo.ctx.createImageData(size, size);
    const bImg = bump.ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const u = x / size, v = y / size;

            // Loang lổ lớn: chỗ da căng vàng đậm, chỗ chùng nhạt hơn
            const blotch = fbm3(u * 5, v * 5, 0.5, 4);
            // Hạt mịn: lỗ chân lông sau khi vặt lông
            const pore = valueNoise3(u * 190, v * 190, 3.1);
            // Nếp nhăn kéo dài theo thớ da
            const wrinkle = fbm3(u * 26, v * 7, 9.4, 3) * 0.7
                          + fbm3(u * 64, v * 22, 3.3, 2) * 0.3;

            const shade = 0.78 + blotch * 0.42 - pore * 0.12;
            const warm = 0.96 + blotch * 0.1;

            aImg.data[i]     = Math.min(255, 255 * shade * warm);
            aImg.data[i + 1] = Math.min(255, 205 * shade * warm);
            aImg.data[i + 2] = Math.min(255, 106 * shade);
            aImg.data[i + 3] = 255;

            const h = 128 + (pore - 0.5) * 118 + (wrinkle - 0.5) * 64 + (blotch - 0.5) * 26;
            bImg.data[i] = bImg.data[i + 1] = bImg.data[i + 2] = Math.max(0, Math.min(255, h));
            bImg.data[i + 3] = 255;
        }
    }

    albedo.ctx.putImageData(aImg, 0, 0);
    bump.ctx.putImageData(bImg, 0, 0);

    return {
        map: toTexture(albedo.canvas, 2.5, THREE.SRGBColorSpace),
        bumpMap: toTexture(bump.canvas, 2.5)
    };
}

/**
 * Mặt cắt: thịt trắng ngà có thớ, viền ngoài sẫm hơn vì sát da.
 */
export function makeMeatTexture(size = 256) {
    const { canvas, ctx } = makeCanvas(size);
    const img = ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const u = x / size, v = y / size;

            // Thớ thịt toả ra từ tâm
            const dx = u - 0.5, dy = v - 0.5;
            const ang = Math.atan2(dy, dx);
            const rad = Math.hypot(dx, dy) * 2;

            const fiber = fbm3(Math.cos(ang) * 9 + rad * 16, Math.sin(ang) * 9, 2.0, 3);
            const grain = valueNoise3(u * 120, v * 120, 7.7);

            const t = 0.82 + fiber * 0.3 - grain * 0.08;
            const edge = 1 - Math.max(0, rad - 0.72) * 1.1;   // sát da thì sẫm lại

            img.data[i]     = Math.min(255, 236 * t * edge);
            img.data[i + 1] = Math.min(255, 213 * t * edge);
            img.data[i + 2] = Math.min(255, 190 * t * edge);
            img.data[i + 3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
    return toTexture(canvas, 1, THREE.SRGBColorSpace);
}

/**
 * Thớt gỗ nghiến: vân gỗ chạy vòng, có vết dao cũ.
 */
export function makeWoodTexture(size = 512) {
    const { canvas, ctx } = makeCanvas(size);
    const img = ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const u = (x / size - 0.5) * 2, v = (y / size - 0.5) * 2;

            const r = Math.hypot(u, v);
            const wobble = fbm3(u * 3.5, v * 3.5, 1.2, 3) * 0.22;
            const rings = Math.sin((r + wobble) * 62) * 0.5 + 0.5;
            const fine = valueNoise3(u * 110, v * 110, 4.4);

            const t = 0.74 + rings * 0.14 + fine * 0.1;

            img.data[i]     = Math.min(255, 104 * t);
            img.data[i + 1] = Math.min(255, 70  * t);
            img.data[i + 2] = Math.min(255, 43  * t);
            img.data[i + 3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
    return toTexture(canvas, 1, THREE.SRGBColorSpace);
}

/* ------------------------------------------------------------------ *
 *  Biến dạng hình học
 * ------------------------------------------------------------------ */

/**
 * Đẩy từng đỉnh ra/vào theo pháp tuyến bằng fbm.
 * Một hình capsule hoàn hảo thì mắt người đọc ngay ra là đồ hoạ máy tính;
 * thịt thật không bao giờ đối xứng tuyệt đối.
 */
export function taper(geometry, axis = 'y', atMin = 1, atMax = 1) {
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const lo = bb.min[axis], hi = bb.max[axis];
    const span = hi - lo || 1;

    const others = ['x', 'y', 'z'].filter(a => a !== axis);
    const pos = geometry.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const t = (v[axis] - lo) / span;
        const k = atMin + (atMax - atMin) * t;
        others.forEach(a => { v[a] *= k; });
        pos.setXYZ(i, v.x, v.y, v.z);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
}

export function deform(geometry, amplitude = 0.09, frequency = 1.5, seed = 0) {
    geometry.computeVertexNormals();

    const pos = geometry.attributes.position;
    const nor = geometry.attributes.normal;
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        n.fromBufferAttribute(nor, i);

        const d = (fbm3(
            v.x * frequency + seed,
            v.y * frequency + seed * 2.3,
            v.z * frequency + seed * 5.1,
            3
        ) - 0.5) * 2 * amplitude;

        pos.setXYZ(i, v.x + n.x * d, v.y + n.y * d, v.z + n.z * d);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
}
