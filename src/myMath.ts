import {quat, ReadonlyVec3, vec3} from "gl-matrix";

const _vtmp = vec3.create();

const MyMath = {
    toRad: (deg: number): number => deg * Math.PI / 180,
    toDeg: (rad: number): number => rad * 180 / Math.PI,
    clamp: (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)),

    vec3: {
        // project v on t in out
        projectOnVector: (out: vec3, v: vec3, t: vec3): vec3 => {
            const denominator = vec3.sqrLen(t);
            if (denominator === 0)
                return vec3.set(out, 0, 0, 0);
            const scalar = vec3.dot(v, t) / denominator;
            return vec3.scale(out, t, scalar);
        },
        // project v on plane with planeNormal in out
        projectOnPlane: (out: vec3, v: vec3, planeNormal: vec3): vec3 => {
            vec3.copy(_vtmp, v);
            MyMath.vec3.projectOnVector(out, v, planeNormal);
            return vec3.sub(out, out, _vtmp);
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
    },
    quat: {
        fromVectors(a: ReadonlyVec3, b: ReadonlyVec3): quat {
            const q = quat.create();
            vec3.cross(q as vec3, a, b);
            q[3] = Math.sqrt(vec3.sqrLen(a) * vec3.sqrLen(a)) + vec3.dot(a, b);
            return q;
        }
    }
}

export default MyMath;