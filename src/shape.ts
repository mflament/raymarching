import {mat3, vec3, vec4} from 'gl-matrix';

export enum ShapeType {Sphere, Box, Torus, RBox}

export enum Operation {None, Blend, Cut, Mask}

const INT32_BYTES = 4;
const FLOAT32_BYTES = 4;
const MAT3_BYTES = 3 * 4 * 4;
const VEC4_BYTES = 4 * 4;
const VEC3_BYTES = 3 * 4;

/**
 * struct Shape {
 *     vec3 position;               4 * 4
 *     vec3 size;                   4 * 4
 *     vec3 color;                  3 * 4
 *     float blendStrength;         1 * 4
 *     int shapeType;               1 * 4
 *     int operation;               1 * 4
 *     int numChildren;             1 * 4
 *                                  1 * 4 // align
 * };
 */
export class Shape {

    static readonly POSITION_OFFSET = 0;
    static readonly ROTATION_OFFSET = Shape.POSITION_OFFSET + VEC4_BYTES;
    static readonly SIZE_OFFSET = Shape.ROTATION_OFFSET + MAT3_BYTES;
    static readonly COLOR_OFFSET = Shape.SIZE_OFFSET + VEC4_BYTES;
    static readonly BLEND_STRENGTH_OFFSET = Shape.COLOR_OFFSET + VEC3_BYTES;
    static readonly SHAPE_TYPE_OFFSET = Shape.BLEND_STRENGTH_OFFSET + FLOAT32_BYTES;
    static readonly OPERATION_OFFSET = Shape.SHAPE_TYPE_OFFSET + INT32_BYTES;
    static readonly NUM_CHILDREN_OFFSET = Shape.OPERATION_OFFSET + INT32_BYTES;

    static readonly BYTES = Shape.NUM_CHILDREN_OFFSET + INT32_BYTES + 4;

    readonly position = vec3.create();
    readonly rotation = mat3.create();
    readonly size = vec4.create();
    readonly color = vec3.create();

    blendStrength = 0;
    shapeType: ShapeType = ShapeType.Box;
    operation: Operation = Operation.None;
    numChildren = 0;

    constructor(param?: Partial<Shape>) {
        if (param?.position) vec3.copy(this.position, param.position);
        if (param?.rotation) mat3.copy(this.rotation, param.rotation);
        else mat3.transpose(this.rotation, mat3.identity(this.rotation));
        if (param?.size) vec4.copy(this.size, param.size);
        if (param?.color) vec3.copy(this.color, param.color);
        if (param?.blendStrength !== undefined) this.blendStrength = param.blendStrength;
        if (param?.shapeType !== undefined) this.shapeType = param.shapeType;
        if (param?.operation !== undefined) this.operation = param.operation;
        if (param?.numChildren !== undefined) this.numChildren = param.numChildren;
    }

    write(dv: DataView, byteOffset = 0, littleEndian = true) {
        writeVec3(dv, byteOffset + Shape.POSITION_OFFSET, this.position, 1, littleEndian);
        writeMat3(dv, byteOffset + Shape.ROTATION_OFFSET, mat3.transpose(this.rotation, this.rotation), littleEndian);
        writeVec4(dv, byteOffset + Shape.SIZE_OFFSET, this.size, littleEndian);
        writeVec3(dv, byteOffset + Shape.COLOR_OFFSET, this.color, 0, littleEndian);
        dv.setFloat32(byteOffset + Shape.BLEND_STRENGTH_OFFSET, this.blendStrength, littleEndian);
        dv.setInt32(byteOffset + Shape.SHAPE_TYPE_OFFSET, this.shapeType, littleEndian);
        dv.setInt32(byteOffset + Shape.OPERATION_OFFSET, this.operation, littleEndian);
        dv.setInt32(byteOffset + Shape.NUM_CHILDREN_OFFSET, this.numChildren, littleEndian);
    }
}

function writeVec3(dv: DataView, byteOffset: number, v: vec3, padding = 0, littleEndian = true) {
    dv.setFloat32(byteOffset, v[0], littleEndian);
    dv.setFloat32(byteOffset + 4, v[1], littleEndian);
    dv.setFloat32(byteOffset + 8, v[2], littleEndian);
    for (let i = 0; i < padding; i++) {
        dv.setFloat32(byteOffset + 12 + i * 4, 0, littleEndian);
    }
}

function writeVec4(dv: DataView, byteOffset: number, v: vec4, littleEndian = true) {
    dv.setFloat32(byteOffset, v[0], littleEndian);
    dv.setFloat32(byteOffset + FLOAT32_BYTES, v[1], littleEndian);
    dv.setFloat32(byteOffset + 2 * FLOAT32_BYTES, v[2], littleEndian);
    dv.setFloat32(byteOffset + 3 * FLOAT32_BYTES, v[3], littleEndian);
}

function writeMat3(dv: DataView, byteOffset: number, m: mat3, littleEndian = true) {
    const col = vec4.create();
    for (let i = 0; i < 3; i++) {
        vec4.set(col, m[i * 3], m[i * 3 + 1], m[i * 3 + 2], 0);
        writeVec4(dv, byteOffset + i * VEC4_BYTES, col, littleEndian);
    }
}
