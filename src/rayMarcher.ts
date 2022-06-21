import {Shape, ShapeType} from "./shape";
import {Ray} from "./ray";
import {ReadonlyVec3, vec2, vec3} from "gl-matrix";
import MyMath from "./myMath";

const V3_ZERO: ReadonlyVec3 = vec3.create();

const sdf = function () {
    const q3 = vec3.create();
    const q2 = vec2.create();
    const mq = vec3.create();
    return {
        sdSphere(p: vec3, radius: number): number {
            return vec3.length(p) - radius;
        },
        sdBox(p: vec3, b: vec3): number {
            vec3.sub(q3, MyMath.vec3.abs(q3, p), b);
            return vec3.length(vec3.max(mq, q3, V3_ZERO)) + Math.min(Math.max(q3[0], Math.max(q3[1], q3[2])), 0.0);
        },
        sdRoundBox(p: vec3, b: vec3, r: number): number {
            vec3.sub(q3, MyMath.vec3.abs(q3, p), b);
            return vec3.length(vec3.max(mq, q3, V3_ZERO)) + Math.min(Math.max(q3[0], Math.max(q3[1], q3[2])), 0.0) - r;
        },
        sdTorus(p: vec3, t: vec2): number {
            vec2.set(q2, p[0], p[2]);
            vec2.set(q2, vec2.length(q2) - t[0], p[1]);
            return vec2.length(q2) - t[1];
        }
    };
}();

export function rayMarcher(shapes: Shape[], maxDst: number, epsilon: number): (ray: Ray) => { shape: Shape, pointOnSurface: vec3 } | undefined {
    const p = vec3.create();
    const shapeDistance = (shape: Shape, eye: vec3): number => {
        vec3.transformMat3(p, vec3.sub(p, shape.position, eye), shape.rotation);
        switch (shape.shapeType) {
            case ShapeType.Sphere:
                return sdf.sdSphere(p, shape.size[0]);
            case ShapeType.Box:
                return sdf.sdBox(p, shape.size as vec3);
            case ShapeType.RBox:
                return sdf.sdRoundBox(p, shape.size as vec3, shape.size[3]);
            case ShapeType.Torus:
                return sdf.sdTorus(p, shape.size as vec2);
            default:
                return maxDst;
        }
    }

    const closestShape = (from: vec3): { shape: Shape, dst: number } | undefined => {
        let dst = maxDst;
        let closest: Shape | undefined = undefined;
        for (const shape of shapes) {
            const sd = shapeDistance(shape, from);
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