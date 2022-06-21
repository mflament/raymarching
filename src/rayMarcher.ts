import {Shape, ShapeType} from "./shape";
import {Ray} from "./ray";
import {vec2, vec3} from "gl-matrix";
import MyMath from "./myMath";

const sphereDistance = function () {
    return (from: vec3, sphere: Shape): number => {
        return vec3.distance(from, sphere.position) - sphere.size[0]
    };
}();

const cubeDistance = function () {
    const o = vec3.create();
    const v3 = vec3.create();
    const v3zero = vec3.create();
    return (from: vec3, cube: Shape): number => {
        MyMath.vec3.abs(o, vec3.sub(o, from, cube.position));
        vec3.scaleAndAdd(o, o, cube.size, -0.5);
        const ud = vec3.length(vec3.max(v3, o, v3zero));
        vec3.min(v3, o, v3zero);
        const n = Math.max(v3[0], Math.max(v3[1], v3[2]));
        return ud + n;
    };
}();

const torusDistance = function () {
    const v3 = vec3.create();
    const v2 = vec2.create();
    return (from: vec3, torus: Shape): number => {
        const r1 = torus.size[0];
        const r2 = torus.size[1];
        vec3.sub(v3, from, torus.position);
        vec2.set(v2, vec2.length(vec2.set(v2, v3[0], v3[2])) - r1, from[1] - torus.position[1]);
        return vec2.length(v2) - r2;
    };
}();

export function rayMarcher(shapes: Shape[], maxDst: number, epsilon: number): (ray: Ray) => { shape: Shape, pointOnSurface: vec3 } | undefined {
    const getShapeDistance = (from: vec3, shape: Shape): number => {
        switch (shape.shapeType) {
            case ShapeType.Sphere:
                return sphereDistance(from, shape);
            case ShapeType.Cube:
                return cubeDistance(from, shape);
            case ShapeType.Torus:
                return torusDistance(from, shape);
            default:
                return maxDst;
        }
    };

    const closestShape = (from: vec3): { shape: Shape, dst: number } | undefined => {
        let dst = maxDst;
        let closest: Shape | undefined = undefined;
        for (const shape of shapes) {
            const sd = getShapeDistance(from, shape);
            if (sd < dst) {
                dst = sd;
                closest = shape;
            }
        }
        return closest ? {shape: closest, dst} : undefined;
    }

    return ray => {
        let rayDist = 0;
        const pos = vec3.copy(vec3.create(), ray.origin);
        while (rayDist < maxDst) {
            const cs = closestShape(pos);
            let dst = maxDst;
            if (cs) {
                dst = cs.dst;
                if (dst <= epsilon) {
                    vec3.scaleAndAdd(pos, vec3.zero(pos), ray.dir, dst);
                    return {shape: cs.shape, pointOnSurface: pos};
                }
            }
            vec3.scaleAndAdd(pos, pos, ray.dir, dst);
            rayDist += dst;
        }
        return undefined;
    };
}