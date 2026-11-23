// Smallest signed difference between two angles (radians).
export function angleDelta(from: number, to: number): number {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
}


// Turn smoothly from one angle towards another.
export function lerpAngle(from: number, to: number, t: number): number {
    return from + angleDelta(from, to) * t;
}


export function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}


// Seeded random numbers, so scattered props land in the same place every time.
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}


// Horizontal (x/z) distance between two points.
export function flatDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
}
