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

    readonly inclinationRange: [number, number] = [0.01, Math.PI / 2 + 0.01];

    private currentAction: Action = Action.NONE;
    // cartesian position of camera around target
    private readonly cpos = vec3.create();
    // spherical position of camera around target
    private readonly spos = vec3.create();

    private readonly _vmove = vec2.create();

    private readonly panx = vec3.create();
    private readonly pany = vec3.create();

    onChange?: () => void;

    rotateSpeed = Math.PI;
    panSpeed = 5;


    constructor(readonly camera: PerspectiveCamera, readonly canvas: HTMLCanvasElement) {
        canvas.addEventListener('mousedown', e => this.mouseDown(e as MouseEvent));
        canvas.addEventListener('mousemove', e => this.mouseMove(e as MouseEvent));
        canvas.addEventListener('mouseup', () => this.mouseUp());
        canvas.addEventListener('wheel', e => this.mouseWheel(e as WheelEvent));
        canvas.addEventListener('mouseleave', () => this.mouseLeave());
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        vec3.sub(this.cpos, camera.position, camera.target);
        MyMath.vec3.toSpherical(this.spos, this.cpos);
    }

    private mouseDown(e: MouseEvent): void {
        const action = this.mouseBindings[e.button as MouseButton];
        if (action !== Action.NONE) {
            this.currentAction = action;
            this.canvas.requestPointerLock();
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
        if (this.currentAction !== Action.NONE) {
            document.exitPointerLock();
            this.currentAction = Action.NONE;
        }
    }

    private mouseLeave(): void {
        this.currentAction = Action.NONE;
    }

    private rotate(e: MouseEvent): void {
        const m = this.getMove(e, this.rotateSpeed);

        const spos = this.spos;
        let inclination = spos[1];
        inclination = MyMath.clamp(inclination - m[1], this.inclinationRange[0], this.inclinationRange[1]);
        this.spos[1] = inclination;

        let azimuth = spos[2];

        azimuth = azimuth - m[0];
        if (azimuth > Math.PI) azimuth = azimuth - 2 * Math.PI;
        else if (azimuth < -Math.PI) azimuth = azimuth + 2 * Math.PI;
        this.spos[2] = azimuth;

        MyMath.vec3.fromSpherical(this.cpos, this.spos);
        vec3.add(this.camera.position, this.camera.target, this.cpos);
        this.updateWorld();
    }

    private zoom(z: boolean): void {
        let radius = this.spos[0];
        const zoomFactor = 0.8;
        radius += z ? zoomFactor : -zoomFactor;
        radius = Math.max(this.camera.near, radius);
        this.spos[0] = radius;

        MyMath.vec3.fromSpherical(this.cpos, this.spos);
        vec3.add(this.camera.position, this.camera.target, this.cpos);
        this.updateWorld();
    }

    private pan(e: MouseEvent): void {
        const {panx, pany, panSpeed, camera} = this;

        MyMath.vec3.projectOnPlane(pany, this.cpos, camera.up);
        vec3.negate(pany, vec3.normalize(pany, pany));

        vec3.cross(panx, pany, camera.up);

        const m = this.getMove(e, panSpeed);

        vec3.scaleAndAdd(camera.position, camera.position, panx, m[0]);
        vec3.scaleAndAdd(camera.position, camera.position, pany, -m[1]);

        vec3.scaleAndAdd(camera.target, camera.target, panx, m[0]);
        vec3.scaleAndAdd(camera.target, camera.target, pany, -m[1]);

        this.updateWorld();
    }

    private updateWorld() {
        this.camera.updateWorldMatrix();
        this.onChange && this.onChange();
    }

    private getMove(e: MouseEvent, scale = 1): vec2 {
        this._vmove[0] = e.movementX / (this.canvas.width * .5 / window.devicePixelRatio) * scale;
        this._vmove[1] = e.movementY / (this.canvas.height * .5 / window.devicePixelRatio) * scale;
        return this._vmove;
    }

}