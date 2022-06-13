import {vec3} from "gl-matrix";

const MyMath = {
    toRad: (deg: number): number => deg * Math.PI / 180,
    toDeg: (rad: number): number => rad * 180 / Math.PI,
    clamp: (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)),
    projectOnVector: (out: vec3, v: vec3, t: vec3): vec3 => {
        const denominator = vec3.sqrLen(t);
        if (denominator === 0)
            return vec3.set(out, 0, 0, 0);
        const scalar = vec3.dot(t, v) / denominator;
        return vec3.scale(out, v, scalar);
    },
    projectOnPlane: (out: vec3, p: vec3, planeNormal: vec3): vec3 => {
        MyMath.projectOnVector(out, p, planeNormal);
        return vec3.sub(out, p, out);
    },
    /**
     * https://en.wikipedia.org/wiki/Spherical_coordinate_system
     * @return [radius r, inclination θ, azimuth φ]
     * wikipedia : opengl
     *  x : z
     *  y : x
     *  z : y
     */
    toSpherical: (out: vec3, cartesian: vec3): vec3 => {
        const [x, y, z] = cartesian;
        out[0] = Math.sqrt(x * x + y * y + z * z);
        out[1] = Math.acos(y / out[0]);
        if (z > 0) {
            out[2] = Math.atan(x / z);
        } else if (z < 0 && x >= 0) {
            out[2] = Math.atan(x / z) + Math.PI;
        } else if (z < 0 && x < 0) {
            out[2] = Math.atan(x / z) - Math.PI;
        } else if (z === 0 && x > 0) {
            out[2] = Math.PI / 2;
        } else if (z === 0 && x < 0) {
            out[2] = -Math.PI / 2;
        } else if (z === 0 && x === 0) {
            out[2] = NaN;
        }
        return out;
    },
    fromSpherical: (out: vec3, spherical: vec3): vec3 => {
        const [r, i, a] = spherical;
        out[0] = r * Math.sin(a) * Math.sin(i);
        out[1] = r * Math.cos(i);
        out[2] = r * Math.cos(a) * Math.sin(i);
        return out;
    }
}

export default MyMath;