/**
 * layout(std140, binding = 0) uniform Uniforms {
 *  Shape shapes[10];       10 * Shape.BYTES
 *  int numShapes;          1 * 4 + (3 * 4 align)
 *  mat4 matrixWorld;       4 * 4 * 4
 *  mat4 projectionMatrixInverse;   4 * 4 * 4
 *  vec3 light;             3 * 4
 *  int positionLight;      1 * 4
 * };
 */
import {Shape} from "./shape";
import {mat4, vec3} from 'gl-matrix';
import {PerspectiveCamera} from "./PerspectiveCamera";
import {DirectionalLight, PointLight} from "./Light";

const MATRIX4_BYTES = 4 * 4 * 4;
const VEC3_BYTES = 3 * 4;
const INT32_BYTES = 4;

export class Uniforms {
    static readonly MAX_SHAPES = 10;

    static readonly SHAPES_OFFSET = 0;
    static readonly NUM_SHAPES_OFFSET = Uniforms.SHAPES_OFFSET + Shape.BYTES * Uniforms.MAX_SHAPES;
    static readonly MATRIX_WORLD_OFFSET = Uniforms.NUM_SHAPES_OFFSET + 4 * INT32_BYTES;
    static readonly MATRIX_PROJECTION_OFFSET = Uniforms.MATRIX_WORLD_OFFSET + MATRIX4_BYTES;
    static readonly LIGHT_OFFSET = Uniforms.MATRIX_PROJECTION_OFFSET + MATRIX4_BYTES;
    static readonly POSITION_LIGHT_OFFSET = Uniforms.LIGHT_OFFSET + VEC3_BYTES;

    static readonly BYTES = Uniforms.POSITION_LIGHT_OFFSET + INT32_BYTES;

    private shapeCount = 0;

    private readonly buffer: Uint8Array = new Uint8Array(Uniforms.BYTES);
    private readonly dataView: DataView = new DataView(this.buffer.buffer);
    private readonly glBuffer: WebGLBuffer;
    private readonly dirtyRange = [0, 0];

    constructor(readonly gl: WebGL2RenderingContext, readonly blockBinding = 0) {
        const glBuffer = gl.createBuffer();
        if (!glBuffer)
            throw new Error("Error creating gl buffer");
        this.glBuffer = glBuffer;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.glBuffer);
        gl.bufferData(gl.UNIFORM_BUFFER, Uniforms.BYTES, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, blockBinding, this.glBuffer);
    }

    addShape(shape: Shape): number {
        const index = this.shapeCount;
        if (index == Uniforms.MAX_SHAPES)
            return -1;

        this.shapeCount++;
        const shapeOffset = Uniforms.SHAPES_OFFSET + index * Shape.BYTES;
        shape.write(this.dataView, shapeOffset);
        this.setInt32(Uniforms.NUM_SHAPES_OFFSET, this.shapeCount);

        this.updateDirtyRange(Uniforms.SHAPES_OFFSET, Uniforms.MAX_SHAPES * Shape.BYTES + INT32_BYTES);
        return index;
    }

    setCamera(camera: PerspectiveCamera): void {
        this.setMatrix4(Uniforms.MATRIX_WORLD_OFFSET, camera.invWorldMatrix);
        this.setMatrix4(Uniforms.MATRIX_PROJECTION_OFFSET, camera.invProjectionMatrix);
        this.updateDirtyRange(Uniforms.MATRIX_WORLD_OFFSET, 2 * MATRIX4_BYTES);
    }

    setLight(light: DirectionalLight | PointLight): void {
        if (light.type === 'directional') {
            this.setVector3(Uniforms.LIGHT_OFFSET, light.direction);
            this.setInt32(Uniforms.POSITION_LIGHT_OFFSET, 0);
        } else {
            this.setVector3(Uniforms.LIGHT_OFFSET, light.position);
            this.setInt32(Uniforms.POSITION_LIGHT_OFFSET, 1);
        }
        this.updateDirtyRange(Uniforms.LIGHT_OFFSET, VEC3_BYTES + INT32_BYTES);
    }

    updateGlBuffer(): boolean {
        if (this.dirtyRange[0] !== this.dirtyRange[1]) {
            const {gl, glBuffer, buffer} = this;
            gl.bindBuffer(gl.UNIFORM_BUFFER, glBuffer);
            gl.bufferSubData(gl.UNIFORM_BUFFER, this.dirtyRange[0], buffer, this.dirtyRange[0], this.dirtyRange[1] - this.dirtyRange[0]);
            gl.bindBuffer(gl.UNIFORM_BUFFER, null);
            this.dirtyRange[0] = this.dirtyRange[1] = 0;
            return true;
        }
        return false;
    }

    private setFloat32(byteOffset: number, value: number): Uniforms {
        this.dataView.setFloat32(byteOffset, value, true);
        return this;
    }

    private setInt32(byteOffset: number, value: number): void {
        this.dataView.setInt32(byteOffset, value, true);
    }

    private setVector3(byteOffset: number, value: vec3): void {
        this.setFloat32(byteOffset, value[0]).setFloat32(byteOffset + 4, value[1]).setFloat32(byteOffset + 8, value[2]);
    }

    private setMatrix4(byteOffset: number, matrix: mat4): void {
        for (let i = 0; i < 16; i++) {
            this.setFloat32(byteOffset + i * 4, matrix[i]);
        }
    }

    private updateDirtyRange(offset: number, bytes: number): void {
        this.dirtyRange[0] = Math.min(offset, this.dirtyRange[0]);
        this.dirtyRange[1] = Math.max(offset + bytes, this.dirtyRange[1]);
    }

}
