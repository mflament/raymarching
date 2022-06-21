import {Shaders} from "./shaders";
import {FPSOverlay, GLContext, QuadRenderer, RunningState} from "webgl-support";
import {PerspectiveCamera} from "./PerspectiveCamera";
import {DirectionalLight, PointLight} from "./Light";
import {quat, vec2, vec3} from "gl-matrix";
import {Shape, ShapeType} from "./shape";
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

    const uf = context.programUniformsFactory(program);
    const uMaxDst = uf('uMaxDst', 'float');
    uMaxDst.value = MAX_DST;

    const uEpsilon = uf('uEpsilon', 'float');
    uEpsilon.value = EPSILON;

    const uShadowBias = uf('uShadowBias', 'float');
    uShadowBias.value = SHADOW_BIAS;

    let uboIndex = gl.getUniformBlockIndex(program, "uCamera");
    gl.uniformBlockBinding(program, uboIndex, cameraUniforms.blockBinding);
    uboIndex = gl.getUniformBlockIndex(program, "uShapes");
    gl.uniformBlockBinding(program, uboIndex, shapesUniforms.blockBinding);
    uboIndex = gl.getUniformBlockIndex(program, "uLights");
    gl.uniformBlockBinding(program, uboIndex, lightsUniforms.blockBinding);

    const shapes = [new Shape({
        position: [0, 0, 0],
        size: [.5, .5, .5],
        color: [0, 1, 0],
        shapeType: ShapeType.Cube,
    }), new Shape({
        position: [.5, 0, -1.5],
        size: [.5, .5, .5],
        color: [1, 0, 0],
        shapeType: ShapeType.Cube,
    }), new Shape({
        position: [-.5, 0, -3],
        size: [.5, .5, .5],
        color: [0, 0, 1],
        shapeType: ShapeType.Cube,
    }), new Shape({
        position: [-1, 0, -1.5],
        size: [.5, 0, 0],
        color: [1, 0, 1],
        shapeType: ShapeType.Sphere,
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
            vec2.set(uv, e.clientX / canvas.width * 2 - 1,  (1 - e.clientY / canvas.height) * 2 - 1);
            const intersect = rm(rc(ray, uv));
            if (intersect)
                console.log('shape index ', shapes.indexOf(intersect.shape), 'pos', [...intersect.pointOnSurface]);
        }
    });

    const lightTransform = quat.create();
    const rotateLight = (rs: RunningState) => {
        const angle = rs.dt * 0.1 * Math.PI;
        if (light.type === 'directional') {
            quat.rotateY(lightTransform, quat.identity(lightTransform), angle);
            vec3.transformQuat(light.direction, light.direction, lightTransform);
            lightsUniforms.setLight(light);
        } else {
            vec3.rotateY(light.position, light.position, [0, light.position[1], 0], angle);
            lightsUniforms.setLight(light);
        }
    };

    context.renderer = {
        program: program,
        render(rs: RunningState) {
            if (updateCam) {
                cameraUniforms.update(camera);
                updateCam = false;
            }
            rotateLight(rs);
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