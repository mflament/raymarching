/**
 * layout(std140, binding = 0) uniform Uniforms {
 *  Shape shapes[10];       10 * Shape.BYTES
 *  int numShapes;          1 * 4 + (3 * 4 align)
 *  mat4 matrixWorld;       4 * 4 * 4
 *  mat4 projectionMatrixInverse;   4 * 4 * 4
 *  vec3 ambient;           4 * 4
 *  vec3 light;             3 * 4
 *  int positionLight;      1 * 4
 * };
 */
import {Shape} from "./shape";
import {mat4, vec3} from 'gl-matrix';
import {PerspectiveCamera} from "./PerspectiveCamera";
import {DirectionalLight, PointLight} from "./Light";

const MATRIX4_BYTES = 4 * 4 * 4;
const VEC4_BYTES = 4 * 4;
const VEC3_BYTES = 3 * 4;
const INT_BYTES = 4;

export abstract class UniformBlock {
    protected readonly dataView: DataView;
    protected readonly glBuffer: WebGLBuffer;

    protected constructor(readonly gl: WebGL2RenderingContext, readonly blockBinding: number, readonly buffer: Uint8Array) {
        const glBuffer = gl.createBuffer();
        if (!glBuffer)
            throw new Error("Error creating gl buffer");
        this.glBuffer = glBuffer;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.glBuffer);
        gl.bufferData(gl.UNIFORM_BUFFER, buffer.length, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, blockBinding, this.glBuffer);
        this.dataView = new DataView(this.buffer.buffer)
    }

    protected setFloat32(byteOffset: number, value: number): this {
        this.dataView.setFloat32(byteOffset, value, true);
        return this;
    }

    protected setInt32(byteOffset: number, value: number): void {
        this.dataView.setInt32(byteOffset, value, true);
    }

    protected setVector3(byteOffset: number, value: vec3): void {
        this.setFloat32(byteOffset, value[0]).setFloat32(byteOffset + 4, value[1]).setFloat32(byteOffset + 8, value[2]);
    }

    protected setMatrix4(byteOffset: number, matrix: mat4): void {
        for (let i = 0; i < 16; i++) {
            this.setFloat32(byteOffset + i * 4, matrix[i]);
        }
    }

    protected updateGlBuffer(): void {
        const {gl, glBuffer, buffer} = this;
        gl.bindBuffer(gl.UNIFORM_BUFFER, glBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, buffer);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

}

export class CameraUniforms extends UniformBlock {

    static readonly MATRIX_WORLD_OFFSET = 0;
    static readonly MATRIX_PROJECTION_OFFSET = CameraUniforms.MATRIX_WORLD_OFFSET + MATRIX4_BYTES;
    static readonly BYTES = 2 * MATRIX4_BYTES;

    constructor(readonly gl: WebGL2RenderingContext) {
        super(gl, 0, new Uint8Array(CameraUniforms.BYTES));
    }

    update(camera: PerspectiveCamera): void {
        this.setMatrix4(CameraUniforms.MATRIX_WORLD_OFFSET, camera.invWorldMatrix);
        this.setMatrix4(CameraUniforms.MATRIX_PROJECTION_OFFSET, camera.invProjectionMatrix);
        this.updateGlBuffer();
    }
}

export class ShapeUniforms extends UniformBlock {
    static readonly MAX_SHAPES = 10;

    static readonly SHAPES_OFFSET = 0;
    static readonly NUM_SHAPES_OFFSET = ShapeUniforms.SHAPES_OFFSET + Shape.BYTES * ShapeUniforms.MAX_SHAPES;

    static readonly BYTES = ShapeUniforms.NUM_SHAPES_OFFSET + INT_BYTES;

    constructor(readonly gl: WebGL2RenderingContext) {
        super(gl, 1, new Uint8Array(ShapeUniforms.BYTES));
    }

    update(shapes: Shape[]): void {
        const shapeCount = Math.min(ShapeUniforms.MAX_SHAPES, shapes.length);
        for (let i = 0; i < shapeCount; i++) {
            const shape = shapes[i];
            shape.write(this.dataView, i * Shape.BYTES);
        }
        this.setInt32(ShapeUniforms.NUM_SHAPES_OFFSET, shapeCount);
        this.updateGlBuffer();
    }
}

export class LightsUniforms extends UniformBlock {
    static readonly AMBIENT_OFFSET = 0;
    static readonly LIGHT_OFFSET = LightsUniforms.AMBIENT_OFFSET + VEC4_BYTES;
    static readonly POSITION_LIGHT_OFFSET = LightsUniforms.LIGHT_OFFSET + VEC3_BYTES;

    static readonly BYTES = 2 * VEC4_BYTES;

    constructor(readonly gl: WebGL2RenderingContext) {
        super(gl, 2, new Uint8Array(LightsUniforms.BYTES));
    }

    setAmbient(color: vec3): void {
        this.setVector3(LightsUniforms.AMBIENT_OFFSET, color);
        this.updateGlBuffer();
    }

    setLight(light: DirectionalLight | PointLight): void {
        if (light.type === 'directional') {
            this.setVector3(LightsUniforms.LIGHT_OFFSET, light.direction);
            this.setInt32(LightsUniforms.POSITION_LIGHT_OFFSET, 0);
        } else {
            this.setVector3(LightsUniforms.LIGHT_OFFSET, light.position);
            this.setInt32(LightsUniforms.POSITION_LIGHT_OFFSET, 1);
        }
        this.updateGlBuffer();
    }

}
