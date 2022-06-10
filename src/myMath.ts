
function toRad(deg :number): number {
    return deg * Math.PI / 180;
}

function toDeg(rad :number): number {
    return rad * 180 / Math.PI;
}

function clamp(v: number, min: number, max: number) {
    return Math.min(max, Math.max(min, v));
}

export default {
    toRad,
    toDeg,
    clamp
};