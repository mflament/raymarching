import {PerspectiveCamera} from "./perspectiveCamera";
import {vec2, vec3} from "gl-matrix";
import MyMath from "./myMath";

export enum MouseButton {
    LEFT,
    MIDDLE,
    RIGHT,
}

export enum Action {
    NONE,
    PAN,
    ROTATE
}

export class OrbitControls {
    readonly mouseBindings: Record<MouseButton, Action> = {
        [MouseButton.LEFT]: Action.ROTATE,
        [MouseButton.RIGHT]: Action.PAN,
        [MouseButton.MIDDLE]: Action.NONE
    };

    private currentAction: Action = Action.NONE;
    // cartesian position of camera around target
    private readonly _cpos = vec3.create();
    // spherical position of camera around target
    private readonly _spos = vec3.create();

    private readonly _vmove = vec2.create();

    rotateSpeed = MyMath.toRad(1);

    constructor(readonly camera: PerspectiveCamera, readonly element: HTMLElement | Window = window) {
        this.element.addEventListener('mousedown', e => this.mouseDown(e as MouseEvent));
        this.element.addEventListener('mousemove', e => this.mouseMove(e as MouseEvent));
        this.element.addEventListener('mouseup', () => this.mouseUp());
        this.element.addEventListener('wheel', e => this.mouseWheel(e as WheelEvent));
        this.element.addEventListener('mouseleave', () => this.mouseLeave());
        this.element.addEventListener('contextmenu', e => e.preventDefault());

        vec3.sub(this._cpos, camera.position, camera.target);
        MyMath.toSpherical(this._spos, this._cpos);
   }

    private mouseDown(e: MouseEvent): void {
        const action = this.mouseBindings[e.button as MouseButton];
        if (action !== Action.NONE) {
            this.currentAction = action;
        }
    }

    private mouseMove(e: MouseEvent): void {
        if (this.currentAction === Action.PAN)
            this.pan(e);
        else if (this.currentAction === Action.ROTATE)
            this.rotate(e);
    }

    private mouseWheel(e: WheelEvent): void {
        this.zoom(e.deltaY > 0);
    }

    private mouseUp(): void {
        this.currentAction = Action.NONE;
    }

    private mouseLeave(): void {
        this.currentAction = Action.NONE;
    }

    private rotate(e: MouseEvent): void {
        const m = this.getMove(e);
        vec2.scale(m, m, this.rotateSpeed);

        const spos = this._spos;
        let inclination = spos[1];
        inclination = MyMath.clamp(inclination - m[1], 0.01, Math.PI - .01);
        this._spos[1] = inclination;

        let azimuth = spos[2];

        azimuth = azimuth - m[0];
        if (azimuth > Math.PI) azimuth = azimuth - 2 * Math.PI;
        else if (azimuth < -Math.PI) azimuth = azimuth + 2 * Math.PI;
        this._spos[2] = azimuth;

        MyMath.fromSpherical(this._cpos, this._spos);
        vec3.add(this.camera.position, this.camera.target, this._cpos);
        this.camera.touchWorld();
    }

    private zoom(z: boolean): void {
        let radius = this._spos[0];
        const zoomFactor = 1;
        radius += z ? zoomFactor : -zoomFactor;
        radius = Math.max(this.camera.near, radius);
        this._spos[0] = radius;
        MyMath.fromSpherical(this._cpos, this._spos);
        vec3.add(this.camera.position, this.camera.target, this._cpos);
        this.camera.touchWorld();
    }

    private pan(e: MouseEvent): void {
        console.log("pan", e);
    }

    private getMove(e: MouseEvent): vec2 {
        this._vmove[0] = e.movementX;
        this._vmove[1] = e.movementY;
        return this._vmove;
    }

}