import {mat4, quat, vec3} from 'gl-matrix';
import MyMath from './MyMath';

export class PerspectiveCamera {
    readonly position = vec3.set(vec3.create(), 0, 0, 4);
    readonly target = vec3.create();
    readonly up = vec3.set(vec3.create(), 0, 1, 0);

    aspect = 1;
    fovy = MyMath.toRad(75);
    near = 0.00001;
    far = 1000;

    private readonly _worldMatrix = mat4.create();
    private readonly _invWorldMatrix = mat4.create();
    private readonly _projectionMatrix = mat4.create();
    private readonly _invProjectionMatrix = mat4.create();
    private readonly _quaternion = quat.create();

    constructor(config?: Partial<PerspectiveCamera>) {
        if (config?.position) vec3.copy(this.position, config?.position);
        if (config?.target) vec3.copy(this.target, config?.target);
        if (config?.up) vec3.copy(this.up, config?.up);
        if (config?.aspect !== undefined) this.aspect = config.aspect;
        if (config?.fovy !== undefined) this.fovy = config.fovy;
        if (config?.near !== undefined) this.near = config.near;
        if (config?.far !== undefined) this.far = config.far;
        this.updateMatrix();
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

    lookAt(target: vec3): void {
        vec3.copy(this.target, target);
        this.updateWorldMatrix();
    }

    updateMatrix(): void {
        this.updateWorldMatrix();
        this.updateProjectionMatrix();
    }

    updateWorldMatrix(): void {
        mat4.lookAt(this._worldMatrix, this.position, this.target, this.up);
        mat4.invert(this._invWorldMatrix, this._worldMatrix);
    }

    updateProjectionMatrix(): void {
        mat4.perspective(this._projectionMatrix, this.fovy, this.aspect, this.near, this.far);
        mat4.invert(this._invProjectionMatrix, this._projectionMatrix);
    }

}