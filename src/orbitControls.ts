import {PerspectiveCamera} from "./perspectiveCamera";
import {quat, vec3} from 'gl-matrix';
import {Spherical} from "./Spherical";

// Thank you three.js
// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

const _changeEvent = {type: 'change'};
const _startEvent = {type: 'start'};
const _endEvent = {type: 'end'};

export enum MOUSE {
    LEFT = 0,
    MIDDLE = 1,
    RIGHT = 2,
    ROTATE = 0,
    DOLLY = 1,
    PAN = 2,
}

export enum TOUCH {
    ROTATE,
    PAN,
    DOLLY_PAN,
    DOLLY_ROTATE,
}

const STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_PAN: 4,
    TOUCH_DOLLY_PAN: 5,
    TOUCH_DOLLY_ROTATE: 6
};

export class OrbitControls {
    // Set to false to disable this control
    enabled = true;
    // "target" sets the location of focus, where the object orbits around
    target = vec3.create();

    // How far you can dolly in and out ( PerspectiveCamera only )
    minDistance = 0;
    maxDistance = Infinity;

    // How far you can zoom in and out ( OrthographicCamera only )
    minZoom = 0;
    maxZoom = Infinity;

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    minPolarAngle = 0; // radians
    maxPolarAngle = Math.PI; // radians

    // How far you can orbit horizontally, upper and lower limits.
    // If set, the interval [ min, max ] must be a sub-interval of [ - 2 PI, 2 PI ], with ( max - min < 2 PI )
    minAzimuthAngle = -Infinity; // radians
    maxAzimuthAngle = Infinity; // radians

    // Set to true to enable damping (inertia)
    // If damping is enabled, you must call controls.update() in your animation loop
    enableDamping = false;
    dampingFactor = 0.05;

    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    // Set to false to disable zooming
    enableZoom = true;
    zoomSpeed = 1.0;

    // Set to false to disable rotating
    enableRotate = true;
    rotateSpeed = 1.0;

    // Set to false to disable panning
    enablePan = true;
    panSpeed = 1.0;
    screenSpacePanning = true; // if false, pan orthogonal to world-space direction camera.up
    keyPanSpeed = 7.0; // pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    autoRotate = false;
    autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60

    // The four arrow keys
    keys: { LEFT: string; UP: string; RIGHT: string; BOTTOM: string } = {
        LEFT: 'ArrowLeft',
        UP: 'ArrowUp',
        RIGHT: 'ArrowRight',
        BOTTOM: 'ArrowDown'
    };

    // Mouse buttons
    mouseButtons: { LEFT?: MOUSE; MIDDLE?: MOUSE; RIGHT?: MOUSE } = {
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN
    };

    // Touch fingers
    touches: { ONE: TOUCH; TWO: TOUCH } = {ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN};

    readonly listenToKeyEvents: (domElement: HTMLElement | Window) => void;
    readonly dispose: () => void;
    readonly update: () => void;

    // for reset
    private readonly target0: vec3;
    private readonly position0: vec3;

    private readonly spherical = new Spherical();
    private state: number = STATE.NONE;

    // the target DOM element for key events
    private _domElementKeyEvents?: HTMLElement | Window;

    private _pressedKeys: Record<string, boolean> = {};

    constructor(readonly camera: PerspectiveCamera, readonly domElement: HTMLElement) {
        this.domElement.style.touchAction = 'none'; // disable touch scroll
        this.target0 = vec3.copy(vec3.create(), this.target);
        this.position0 = vec3.copy(vec3.create(), this.camera.position);

        const onKeyDown = (event: KeyboardEvent): void => {
            this._pressedKeys[event.code] = true;
        };

        const onKeyUp = (event: KeyboardEvent): void => {
            this._pressedKeys[event.code] = false;
        };

        this.listenToKeyEvents = domElement => {
            // @ts-ignore
            domElement.addEventListener('keydown', onKeyDown);
            // @ts-ignore
            domElement.addEventListener('keyup', onKeyUp);
            this._domElementKeyEvents = domElement;
        };

        const handleKeyDown = (): void => {
            if (!this.enabled || !this.enablePan) return;
            const pressedKeys = this._pressedKeys;
            const speed = this.keyPanSpeed;
            if (pressedKeys[this.keys.UP]) {
                pan(0, speed);
            }
            if (pressedKeys[this.keys.BOTTOM]) {
                pan(0, -speed);
            }
            if (pressedKeys[this.keys.LEFT]) {
                pan(speed, 0);
            }
            if (pressedKeys[this.keys.RIGHT]) {
                pan(-speed, 0);
            }
        };

        // this method is exposed, but perhaps it would be better if we can make it private...
        this.update = (function (scope: OrbitControls) {
            const offset = vec3.create();

            // so camera.up is the orbit axis
            const q = quat.create();
            //const quat = new Quaternion().setFromUnitVectors(camera.up, new Vector3(0, 1, 0));
            const qInverse = quat.invert(quat.create(), q);

            const lastPosition = vec3.create();
            const lastQuaternion = quat.create();

            const twoPI = 2 * Math.PI;

            return function update() {
                handleKeyDown();

                const position = scope.camera.position;

                vec3.sub(offset, vec3.copy(offset, position), scope.target);

                // rotate offset to "y-axis-is-up" space
                vec3.transformQuat(offset, offset, q);

                // angle from z-axis around y-axis
                spherical.setFromVector3(offset);

                if (scope.autoRotate && scope.state === STATE.NONE) {
                    rotateLeft(getAutoRotationAngle());
                }

                if (scope.enableDamping) {
                    spherical.theta += sphericalDelta.theta * scope.dampingFactor;
                    spherical.phi += sphericalDelta.phi * scope.dampingFactor;
                } else {
                    spherical.theta += sphericalDelta.theta;
                    spherical.phi += sphericalDelta.phi;
                }

                // restrict theta to be between desired limits

                let min = scope.minAzimuthAngle;
                let max = scope.maxAzimuthAngle;

                if (isFinite(min) && isFinite(max)) {
                    if (min < -Math.PI) min += twoPI;
                    else if (min > Math.PI) min -= twoPI;

                    if (max < -Math.PI) max += twoPI;
                    else if (max > Math.PI) max -= twoPI;

                    if (min <= max) {
                        spherical.theta = Math.max(min, Math.min(max, spherical.theta));
                    } else {
                        spherical.theta =
                            spherical.theta > (min + max) / 2 ? Math.max(min, spherical.theta) : Math.min(max, spherical.theta);
                    }
                }

                // restrict phi to be between desired limits
                spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));

                spherical.makeSafe();

                spherical.radius *= scale;

                // restrict radius to be between desired limits
                spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

                // move target to panned location

                if (scope.enableDamping) {
                    vec3.scaleAndAdd(scope.target, scope.target, panOffset, scope.dampingFactor);
                } else {
                    vec3.add(scope.target, scope.target, panOffset);
                }

                offset.setFromSpherical(spherical);

                // rotate offset back to "camera-up-vector-is-up" space
                vec3.transformQuat(offset, offset, qInverse);

                vec3.add(position, vec3.copy(position, scope.target), offset);

                scope.camera.lookAt(scope.target);

                if (scope.enableDamping) {
                    sphericalDelta.theta *= 1 - scope.dampingFactor;
                    sphericalDelta.phi *= 1 - scope.dampingFactor;

                    panOffset.multiplyScalar(1 - scope.dampingFactor);
                } else {
                    sphericalDelta.set(0, 0, 0);

                    panOffset.set(0, 0, 0);
                }

                scale = 1;

                // update condition is:
                // min(camera displacement, camera rotation in radians)^2 > EPS
                // using small-angle approximation cos(x/2) = 1 - x^2 / 8

                if (
                    zoomChanged ||
                    vec3.sqrDist(lastPosition, scope.camera.position) > EPS ||
                    8 * (1 - quat.dot(lastPosition, scope.camera.quaternion)) > EPS
                ) {
                    scope.dispatchEvent(_changeEvent);

                    vec3.copy(lastPosition, scope.camera.position);
                    quat.copy(lastQuaternion, scope.camera.quaternion)
                    zoomChanged = false;

                    return true;
                }

                return false;
            };
        })(this);

        this.dispose = () => {
            this.domElement.removeEventListener('contextmenu', onContextMenu);
            this.domElement.removeEventListener('pointerdown', onPointerDown);
            this.domElement.removeEventListener('pointercancel', onPointerCancel);
            this.domElement.removeEventListener('wheel', onMouseWheel);

            this.domElement.removeEventListener('pointermove', onPointerMove);
            this.domElement.removeEventListener('pointerup', onPointerUp);

            if (this._domElementKeyEvents) {
                // @ts-ignore
                this._domElementKeyEvents.removeEventListener('keydown', onKeyDown);
            }
        };

        //
        // internals
        //

        const EPS = 0.000001;

        // current position in spherical coordinates
        const spherical = this.spherical;
        const sphericalDelta = new Spherical();

        let scale = 1;
        const panOffset = new Vector3();
        let zoomChanged = false;

        const rotateStart = new Vector2();
        const rotateEnd = new Vector2();
        const rotateDelta = new Vector2();

        const panStart = new Vector2();
        const panEnd = new Vector2();
        const panDelta = new Vector2();

        const dollyStart = new Vector2();
        const dollyEnd = new Vector2();
        const dollyDelta = new Vector2();

        const pointers: PointerEvent[] = [];
        const pointerPositions: Record<number, Vector2> = {};

        const getAutoRotationAngle = (): number => {
            return ((2 * Math.PI) / 60 / 60) * this.autoRotateSpeed;
        };

        const getZoomScale = (): number => {
            return Math.pow(0.95, this.zoomSpeed);
        };

        const rotateLeft = (angle: number): void => {
            sphericalDelta.theta -= angle;
        };

        const rotateUp = (angle: number): void => {
            sphericalDelta.phi -= angle;
        };

        const panLeft = (function () {
            const v = new Vector3();
            return function panLeft(distance: number, objectMatrix: Matrix4): void {
                v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
                v.multiplyScalar(-distance);
                panOffset.add(v);
            };
        })();

        const panUp = (function (scope) {
            const v = new Vector3();
            return function panUp(distance: number, objectMatrix: Matrix4) {
                if (scope.screenSpacePanning) {
                    v.setFromMatrixColumn(objectMatrix, 1);
                } else {
                    v.setFromMatrixColumn(objectMatrix, 0);
                    v.crossVectors(scope.camera.up, v);
                }
                v.multiplyScalar(distance);
                panOffset.add(v);
            };
        })(this);

        // deltaX and deltaY are in pixels; right and down are positive
        const pan = (function (scope) {
            const offset = new Vector3();
            return function pan(deltaX: number, deltaY: number) {
                const element = scope.domElement;
                if (isPerspectiveCamera(scope.camera)) {
                    // perspective
                    const position = scope.camera.position;
                    offset.copy(position).sub(scope.target);
                    let targetDistance = offset.length();

                    // half of the fov is center to top of screen
                    targetDistance *= Math.tan(((scope.camera.fov / 2) * Math.PI) / 180.0);

                    // we use only clientHeight here so aspect ratio does not distort speed
                    panLeft((2 * deltaX * targetDistance) / element.clientHeight, scope.camera.matrix);
                    panUp((2 * deltaY * targetDistance) / element.clientHeight, scope.camera.matrix);
                } else if (scope.camera.isOrthographicCamera) {
                    // orthographic
                    panLeft(
                        (deltaX * (scope.camera.right - scope.camera.left)) / scope.camera.zoom / element.clientWidth,
                        scope.camera.matrix
                    );
                    panUp(
                        (deltaY * (scope.camera.top - scope.camera.bottom)) / scope.camera.zoom / element.clientHeight,
                        scope.camera.matrix
                    );
                } else {
                    // camera neither orthographic nor perspective
                    console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
                    scope.enablePan = false;
                }
            };
        })(this);

        const dollyOut = (dollyScale: number): void => {
            if (isPerspectiveCamera(this.camera)) {
                scale /= dollyScale;
            } else if (this.camera.isOrthographicCamera) {
                this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.camera.zoom * dollyScale));
                this.camera.updateProjectionMatrix();
                zoomChanged = true;
            } else {
                console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
                this.enableZoom = false;
            }
        };

        const dollyIn = (dollyScale: number): void => {
            if (isPerspectiveCamera(this.camera)) {
                scale *= dollyScale;
            } else if (this.camera.isOrthographicCamera) {
                this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.camera.zoom / dollyScale));
                this.camera.updateProjectionMatrix();
                zoomChanged = true;
            } else {
                console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
                this.enableZoom = false;
            }
        };

        //
        // event callbacks - update the object state
        //

        function handleMouseDownRotate(event: MouseEvent) {
            rotateStart.set(event.clientX, event.clientY);
        }

        function handleMouseDownDolly(event: MouseEvent) {
            dollyStart.set(event.clientX, event.clientY);
        }

        function handleMouseDownPan(event: MouseEvent) {
            panStart.set(event.clientX, event.clientY);
        }

        const handleMouseMoveRotate = (event: MouseEvent): void => {
            rotateEnd.set(event.clientX, event.clientY);
            rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(this.rotateSpeed);

            const element = this.domElement;

            rotateLeft((2 * Math.PI * rotateDelta.x) / element.clientHeight); // yes, height

            rotateUp((2 * Math.PI * rotateDelta.y) / element.clientHeight);

            rotateStart.copy(rotateEnd);

            this.update();
        };

        const handleMouseMoveDolly = (event: MouseEvent): void => {
            dollyEnd.set(event.clientX, event.clientY);
            dollyDelta.subVectors(dollyEnd, dollyStart);

            if (dollyDelta.y > 0) {
                dollyOut(getZoomScale());
            } else if (dollyDelta.y < 0) {
                dollyIn(getZoomScale());
            }

            dollyStart.copy(dollyEnd);

            this.update();
        };

        const handleMouseMovePan = (event: MouseEvent): void => {
            panEnd.set(event.clientX, event.clientY);
            panDelta.subVectors(panEnd, panStart).multiplyScalar(this.panSpeed);
            pan(panDelta.x, panDelta.y);
            panStart.copy(panEnd);
            this.update();
        };

        function handleMouseUp() {
            // no-op
        }

        const handleMouseWheel = (event: WheelEvent): void => {
            if (event.deltaY < 0) {
                dollyIn(getZoomScale());
            } else if (event.deltaY > 0) {
                dollyOut(getZoomScale());
            }
            this.update();
        };

        function handleTouchStartRotate() {
            if (pointers.length === 1) {
                rotateStart.set(pointers[0].pageX, pointers[0].pageY);
            } else {
                const x = 0.5 * (pointers[0].pageX + pointers[1].pageX);
                const y = 0.5 * (pointers[0].pageY + pointers[1].pageY);
                rotateStart.set(x, y);
            }
        }

        function handleTouchStartPan() {
            if (pointers.length === 1) {
                panStart.set(pointers[0].pageX, pointers[0].pageY);
            } else {
                const x = 0.5 * (pointers[0].pageX + pointers[1].pageX);
                const y = 0.5 * (pointers[0].pageY + pointers[1].pageY);
                panStart.set(x, y);
            }
        }

        function handleTouchStartDolly() {
            const dx = pointers[0].pageX - pointers[1].pageX;
            const dy = pointers[0].pageY - pointers[1].pageY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            dollyStart.set(0, distance);
        }

        const handleTouchStartDollyPan = (): void => {
            if (this.enableZoom) handleTouchStartDolly();
            if (this.enablePan) handleTouchStartPan();
        };

        const handleTouchStartDollyRotate = () => {
            if (this.enableZoom) handleTouchStartDolly();
            if (this.enableRotate) handleTouchStartRotate();
        };

        const handleTouchMoveRotate = (event: PointerEvent) => {
            if (pointers.length == 1) {
                rotateEnd.set(event.pageX, event.pageY);
            } else {
                const position = getSecondPointerPosition(event);

                const x = 0.5 * (event.pageX + position.x);
                const y = 0.5 * (event.pageY + position.y);

                rotateEnd.set(x, y);
            }

            rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(this.rotateSpeed);

            const element = this.domElement;

            rotateLeft((2 * Math.PI * rotateDelta.x) / element.clientHeight); // yes, height

            rotateUp((2 * Math.PI * rotateDelta.y) / element.clientHeight);

            rotateStart.copy(rotateEnd);
        };

        const handleTouchMovePan = (event: PointerEvent): void => {
            if (pointers.length === 1) {
                panEnd.set(event.pageX, event.pageY);
            } else {
                const position = getSecondPointerPosition(event);

                const x = 0.5 * (event.pageX + position.x);
                const y = 0.5 * (event.pageY + position.y);

                panEnd.set(x, y);
            }
            panDelta.subVectors(panEnd, panStart).multiplyScalar(this.panSpeed);
            pan(panDelta.x, panDelta.y);
            panStart.copy(panEnd);
        };

        const handleTouchMoveDolly = (event: PointerEvent) => {
            const position = getSecondPointerPosition(event);

            const dx = event.pageX - position.x;
            const dy = event.pageY - position.y;

            const distance = Math.sqrt(dx * dx + dy * dy);

            dollyEnd.set(0, distance);

            dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, this.zoomSpeed));

            dollyOut(dollyDelta.y);

            dollyStart.copy(dollyEnd);
        };

        const handleTouchMoveDollyPan = (event: PointerEvent) => {
            if (this.enableZoom) handleTouchMoveDolly(event);
            if (this.enablePan) handleTouchMovePan(event);
        };

        const handleTouchMoveDollyRotate = (event: PointerEvent) => {
            if (this.enableZoom) handleTouchMoveDolly(event);
            if (this.enableRotate) handleTouchMoveRotate(event);
        };

        function handleTouchEnd(/*event*/) {
            // no-op
        }

        //
        // event handlers - FSM: listen for events and reset state
        //

        const onPointerDown = (event: PointerEvent): void => {
            if (!this.enabled) return;
            if (pointers.length === 0) {
                this.domElement.setPointerCapture(event.pointerId);
                this.domElement.addEventListener('pointermove', onPointerMove);
                this.domElement.addEventListener('pointerup', onPointerUp);
            }
            addPointer(event);
            if (event.pointerType === 'touch') {
                onTouchStart(event);
            } else {
                onMouseDown(event);
            }
        };

        const onPointerMove = (event: PointerEvent): void => {
            if (!this.enabled) return;
            if (event.pointerType === 'touch') {
                onTouchMove(event);
            } else {
                onMouseMove(event);
            }
        };

        const onPointerUp = (event: PointerEvent): void => {
            if (!this.enabled) return;
            if (event.pointerType === 'touch') {
                onTouchEnd();
            } else {
                onMouseUp();
            }
            removePointer(event);
            if (pointers.length === 0) {
                this.domElement.releasePointerCapture(event.pointerId);
                this.domElement.removeEventListener('pointermove', onPointerMove);
                this.domElement.removeEventListener('pointerup', onPointerUp);
            }
        };

        function onPointerCancel(event: PointerEvent) {
            removePointer(event);
        }

        const onMouseDown = (event: PointerEvent): void => {
            let mouseAction;
            switch (event.button) {
                case 0:
                    mouseAction = this.mouseButtons.LEFT;
                    break;

                case 1:
                    mouseAction = this.mouseButtons.MIDDLE;
                    break;

                case 2:
                    mouseAction = this.mouseButtons.RIGHT;
                    break;

                default:
                    mouseAction = -1;
            }

            switch (mouseAction) {
                case MOUSE.DOLLY:
                    if (!this.enableZoom) return;

                    handleMouseDownDolly(event);

                    this.state = STATE.DOLLY;

                    break;

                case MOUSE.ROTATE:
                    if (event.ctrlKey || event.metaKey || event.shiftKey) {
                        if (!this.enablePan) return;
                        handleMouseDownPan(event);
                        this.state = STATE.PAN;
                    } else {
                        if (!this.enableRotate) return;
                        handleMouseDownRotate(event);
                        this.state = STATE.ROTATE;
                    }
                    break;

                case MOUSE.PAN:
                    if (event.ctrlKey || event.metaKey || event.shiftKey) {
                        if (!this.enableRotate) return;
                        handleMouseDownRotate(event);
                        this.state = STATE.ROTATE;
                    } else {
                        if (!this.enablePan) return;
                        handleMouseDownPan(event);
                        this.state = STATE.PAN;
                    }
                    break;

                default:
                    this.state = STATE.NONE;
            }

            if (this.state !== STATE.NONE) {
                this.dispatchEvent(_startEvent);
            }
        };

        const onMouseMove = (event: MouseEvent): void => {
            if (!this.enabled) return;

            switch (this.state) {
                case STATE.ROTATE:
                    if (!this.enableRotate) return;
                    handleMouseMoveRotate(event);
                    break;

                case STATE.DOLLY:
                    if (!this.enableZoom) return;
                    handleMouseMoveDolly(event);
                    break;

                case STATE.PAN:
                    if (!this.enablePan) return;
                    handleMouseMovePan(event);
                    break;
            }
        };

        const onMouseUp = (): void => {
            handleMouseUp();
            this.dispatchEvent(_endEvent);
            this.state = STATE.NONE;
        };

        const onMouseWheel = (event: WheelEvent): void => {
            if (!this.enabled || !this.enableZoom || (this.state !== STATE.NONE && this.state !== STATE.ROTATE)) return;
            event.preventDefault();
            this.dispatchEvent(_startEvent);
            handleMouseWheel(event);
            this.dispatchEvent(_endEvent);
        };

        const onTouchStart = (event: PointerEvent): void => {
            trackPointer(event);
            switch (pointers.length) {
                case 1:
                    switch (this.touches.ONE) {
                        case TOUCH.ROTATE:
                            if (!this.enableRotate) return;
                            handleTouchStartRotate();
                            this.state = STATE.TOUCH_ROTATE;
                            break;

                        case TOUCH.PAN:
                            if (!this.enablePan) return;
                            handleTouchStartPan();
                            this.state = STATE.TOUCH_PAN;
                            break;

                        default:
                            this.state = STATE.NONE;
                    }
                    break;

                case 2:
                    switch (this.touches.TWO) {
                        case TOUCH.DOLLY_PAN:
                            if (!this.enableZoom && !this.enablePan) return;
                            handleTouchStartDollyPan();
                            this.state = STATE.TOUCH_DOLLY_PAN;
                            break;

                        case TOUCH.DOLLY_ROTATE:
                            if (!this.enableZoom && !this.enableRotate) return;
                            handleTouchStartDollyRotate();
                            this.state = STATE.TOUCH_DOLLY_ROTATE;
                            break;

                        default:
                            this.state = STATE.NONE;
                    }
                    break;

                default:
                    this.state = STATE.NONE;
            }

            if (this.state !== STATE.NONE) {
                this.dispatchEvent(_startEvent);
            }
        };

        const onTouchMove = (event: PointerEvent): void => {
            trackPointer(event);
            switch (this.state) {
                case STATE.TOUCH_ROTATE:
                    if (!this.enableRotate) return;
                    handleTouchMoveRotate(event);
                    this.update();
                    break;

                case STATE.TOUCH_PAN:
                    if (!this.enablePan) return;
                    handleTouchMovePan(event);
                    this.update();
                    break;

                case STATE.TOUCH_DOLLY_PAN:
                    if (!this.enableZoom && !this.enablePan) return;
                    handleTouchMoveDollyPan(event);
                    this.update();
                    break;

                case STATE.TOUCH_DOLLY_ROTATE:
                    if (!this.enableZoom && !this.enableRotate) return;
                    handleTouchMoveDollyRotate(event);
                    this.update();
                    break;

                default:
                    this.state = STATE.NONE;
            }
        };

        const onTouchEnd = (): void => {
            handleTouchEnd();
            this.dispatchEvent(_endEvent);
            this.state = STATE.NONE;
        };

        const onContextMenu = (event: Event): void => {
            if (!this.enabled) return;
            event.preventDefault();
        };

        function addPointer(event: PointerEvent) {
            pointers.push(event);
        }

        function removePointer(event: PointerEvent) {
            delete pointerPositions[event.pointerId];
            for (let i = 0; i < pointers.length; i++) {
                if (pointers[i].pointerId == event.pointerId) {
                    pointers.splice(i, 1);
                    return;
                }
            }
        }

        function trackPointer(event: PointerEvent) {
            let position = pointerPositions[event.pointerId];
            if (position === undefined) {
                position = new Vector2();
                pointerPositions[event.pointerId] = position;
            }
            position.set(event.pageX, event.pageY);
        }

        function getSecondPointerPosition(event: PointerEvent) {
            const pointer = event.pointerId === pointers[0].pointerId ? pointers[1] : pointers[0];
            return pointerPositions[pointer.pointerId];
        }

        //
        this.domElement.addEventListener('contextmenu', onContextMenu);
        this.domElement.addEventListener('pointerdown', onPointerDown);
        this.domElement.addEventListener('pointercancel', onPointerCancel);
        this.domElement.addEventListener('wheel', onMouseWheel, {passive: false});

        // force an update at start
        this.update();
    }

    saveState(): void {
        this.target0.copy(this.target);
        this.position0.copy(this.camera.position);
        this.zoom0 = this.camera.zoom;
    }

    //
    // public methods
    //
    getPolarAngle(): number {
        return this.spherical.phi;
    }

    getAzimuthalAngle(): number {
        return this.spherical.theta;
    }

    getDistance(): number {
        return this.camera.position.distanceTo(this.target);
    }

    reset(): void {
        this.target.copy(this.target0);
        this.camera.position.copy(this.position0);
        this.camera.zoom = this.zoom0;

        this.camera.updateProjectionMatrix();
        this.dispatchEvent(_changeEvent);

        this.update();
        this.state = STATE.NONE;
    }
}