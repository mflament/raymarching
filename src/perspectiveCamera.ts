import {mat4, vec3} from 'gl-matrix';
import MyMath from "./myMath";

export class PerspectiveCamera {
    readonly position = vec3.set(vec3.create(), 0, 0, 4);
    readonly target = vec3.create();
    readonly up = vec3.set(vec3.create(), 0, 1, 0);

    aspect = 1;
    fovx = MyMath.toRad(75);
    near = 0.00001;
    far = 1000;

    private readonly _worldMatrix = mat4.create();
    private readonly _invWorldMatrix = mat4.create();

    private readonly _projectionMatrix = mat4.create();
    private readonly _invProjectionMatrix = mat4.create();

    constructor(config?: Partial<PerspectiveCamera>) {
        if (config?.position) vec3.copy(this.position, config?.position);
        if (config?.target) vec3.copy(this.target, config?.target);
        if (config?.up) vec3.copy(this.up, config?.up);
        if (config?.aspect !== undefined) this.aspect = config.aspect;
        if (config?.fovx !== undefined) this.fovx = config.fovx;
        if (config?.near !== undefined) this.near = config.near;
        if (config?.far !== undefined) this.far = config.far;
        this.updateProjectionMatrix();
        this.updateWorldMatrix();
    }

    get worldMatrix(): mat4 {
        return this._worldMatrix;
    }

    get invWorldMatrix(): mat4 {
        return this._invWorldMatrix;
    }

    get projectionMatrix(): mat4 {
        return this._projectionMatrix;
    }

    get invProjectionMatrix(): mat4 {
        return this._invProjectionMatrix;
    }

    updateWorldMatrix(): void {
        mat4.lookAt(this._worldMatrix, this.position, this.target, this.up);
        mat4.invert(this._invWorldMatrix, this._worldMatrix);
    }

    updateProjectionMatrix(): void {
        const fovy = this.fovx / this.aspect;
        mat4.perspective(this._projectionMatrix, fovy, this.aspect, this.near, this.far);
        mat4.invert(this._invProjectionMatrix, this._projectionMatrix);
    }

}