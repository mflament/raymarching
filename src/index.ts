import {Shaders} from "./shaders";
import {dumpUniforms, FPSOverlay, GLContext, QuadRenderer, RunningState} from "webgl-support";
import {PerspectiveCamera} from "./PerspectiveCamera";
import {DirectionalLight, PointLight} from "./Light";
import {mat3, quat, vec2, vec3} from "gl-matrix";
import {Operation, Shape, ShapeType} from "./shape";
import {OrbitControls} from "./orbitControls";
import {CameraUniforms, LightsUniforms, ShapeUniforms} from "./uniforms";
import {Ray} from "./ray";
import {rayMarcher} from "./rayMarcher";

const pointLight = false;

const MAX_DST = 80;
const EPSILON = 0.001;
const SHADOW_BIAS = EPSILON * 50;


/**
 * https://github.com/SebLague/Ray-Marching/
 */
function start() {
    const context = new GLContext();
    const gl = context.gl;
    const canvas = context.canvas;
    new FPSOverlay(context);

    const camera = new PerspectiveCamera({
        position: [0, 0, 5],
        target: [0, 0, 0],
        aspect: canvas.width / canvas.height
    });

    const cameraUniforms = new CameraUniforms(context.gl);
    const shapesUniforms = new ShapeUniforms(context.gl);
    const lightsUniforms = new LightsUniforms(context.gl);

    const amb = .08;
    lightsUniforms.setAmbient([amb, amb, amb]);

    let light: DirectionalLight | PointLight;
    if (pointLight) {
        light = {type: 'point', position: vec3.set(vec3.create(), 5, 5, 5)}
    } else {
        const direction = vec3.set(vec3.create(), -0.5, -0.5, -0.5);
        vec3.normalize(direction, direction);
        light = {type: 'directional', direction: direction};
    }
    lightsUniforms.setLight(light);

    const program = context.programBuilder().vertexShader(Shaders.vs).fragmentShader(Shaders.fs).link();
    const quadRenderer = new QuadRenderer(context, program);
    console.log(dumpUniforms(gl, program));

    const uf = context.programUniformsFactory(program);
    const uMaxDst = uf('uMaxDst', 'float');
    uMaxDst.value = MAX_DST;

    const uEpsilon = uf('uEpsilon', 'float');
    uEpsilon.value = EPSILON;

    const uShadowBias = uf('uShadowBias', 'float');
    uShadowBias.value = SHADOW_BIAS;

    const uSelectedShape = uf('uSelectedShape', 'int');
    uSelectedShape.value = -1;

    let uboIndex = gl.getUniformBlockIndex(program, "uCamera");
    gl.uniformBlockBinding(program, uboIndex, cameraUniforms.blockBinding);
    uboIndex = gl.getUniformBlockIndex(program, "uShapes");
    gl.uniformBlockBinding(program, uboIndex, shapesUniforms.blockBinding);
    uboIndex = gl.getUniformBlockIndex(program, "uLights");
    gl.uniformBlockBinding(program, uboIndex, lightsUniforms.blockBinding);

    const shapes = [new Shape({
        position: [0, 0, 0],
        size: [.5, .5, .5, .0],
        color: [0, 1, 0, 0.],
        shapeType: ShapeType.Box,
        operation: Operation.None,
    }), new Shape({
        position: [.25, 0, -1.0],
        size: [.5, .5, .5, 0.1],
        color: [1, 1, 0, 0.],
        shapeType: ShapeType.RBox,
        operation: Operation.Blend,
        blendStrength: .2,
    }), new Shape({
        position: [-0.75, 0, -1.5],
        size: [.5, .0, .0, .0],
        color: [0, 0, 1, 0.],
        shapeType: ShapeType.Sphere,
        operation: Operation.Blend,
        blendStrength: .3,
    }), new Shape({
        position: [-.5, 0, -2.5],
        size: [.5, .15, .0, .0],
        color: [1, 0, 1, 0.],
        shapeType: ShapeType.Torus,
        operation: Operation.Blend,
        blendStrength: .2,
    })];

    shapesUniforms.update(shapes);

    const controls = new OrbitControls(camera, canvas);
    let updateCam = true;
    controls.onChange = () => updateCam = true;

    const rc = camera.rayCaster();
    const rm = rayMarcher(shapes, MAX_DST, EPSILON);
    const ray: Ray = {origin: vec3.create(), dir: vec3.create()};
    const uv = vec2.create();
    canvas.addEventListener('mousedown', e => {
        if (e.button === 0) {
            vec2.set(uv, e.clientX / canvas.width * 2 - 1, (1 - e.clientY / canvas.height) * 2 - 1);
            const intersect = rm(rc(ray, uv));
            if (intersect) {
                console.log('shape index ', shapes.indexOf(intersect.shape), 'pos', [...intersect.pointOnSurface]);
                uSelectedShape.value = shapes.indexOf(intersect.shape);
            } else {
                uSelectedShape.value = -1;
            }
        }
    });
    canvas.addEventListener('mouseup', () => uSelectedShape.value = -1);

    const lightTransform = quat.create();
    let rotateLight: (rs: RunningState) => void;
    if (light.type === 'directional') {
        const dlight = light;
        rotateLight = rs => {
            const angle = rs.dt * 0.1 * Math.PI;
            quat.rotateY(lightTransform, quat.identity(lightTransform), angle);
            vec3.transformQuat(dlight.direction, dlight.direction, lightTransform);
            lightsUniforms.setLight(light);
        }
    } else {
        const plight = light;
        rotateLight = rs => {
            const angle = rs.dt * 0.1 * Math.PI;
            vec3.rotateY(plight.position, plight.position, [0, plight.position[1], 0], angle);
            lightsUniforms.setLight(light);
        };
    }

    const q = quat.create();
    const shapesAA = shapes.map(() => {
        const axis = vec3.create();
        vec3.normalize(axis, vec3.set(axis, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1));
        return {axis: axis, angle: 0}
    });
    const rotateShapes = (rs: RunningState) => {
        shapes.forEach((shape, i) => {
            shapesAA[i].angle += rs.dt * Math.PI * .5;
            quat.setAxisAngle(q, shapesAA[i].axis, shapesAA[i].angle);
            mat3.fromQuat(shape.rotation, q);
        });
        shapesUniforms.update(shapes);
    };

    context.renderer = {
        program: program,
        render(rs: RunningState) {
            if (updateCam) {
                cameraUniforms.update(camera);
                updateCam = false;
            }
            rotateLight(rs);
            rotateShapes(rs);
            quadRenderer.render(rs);
        },
        resized: (width, height) => {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            updateCam = true;
        }
    };
    context.running = true;
}

start();