import {Shaders} from "./shaders";
import {Uniforms} from "./uniforms";
import {GLContext, QuadRenderer, RunningState} from "webgl-support";
import {PerspectiveCamera} from "./PerspectiveCamera";
import {DirectionalLight, PointLight} from "./Light";
import {vec3} from "gl-matrix";
import {Shape, ShapeType} from "./shape";

const pointLight = true;

/**
 * https://github.com/SebLague/Ray-Marching/
 */
function start() {
    const canvas = document.getElementById('glcanvas') as HTMLCanvasElement;
    if (!canvas) throw new Error("Canvas not found");
    const context = new GLContext(canvas);
    const gl = context.gl;

    const camera = new PerspectiveCamera({
        position: [0, 0, 5],
        target: [0,0,0],
        aspect: canvas.width / canvas.height
    });

    const uniforms = new Uniforms(context.gl);
    let light: DirectionalLight | PointLight;
    if (pointLight) {
        light = {type: 'point', position: vec3.set(vec3.create(), 5, 5, 5)}
    } else {
        const direction = vec3.set(vec3.create(), 1, 0, 0);
        vec3.normalize(direction, direction);
        light = {type: 'directional', direction: direction};
    }
    uniforms.setLight(light);

    const program = context.programBuilder().vertexShader(Shaders.vs).fragmentShader(Shaders.fs).link();
    const uboIndex = gl.getUniformBlockIndex(program, "Uniforms");
    gl.uniformBlockBinding(program, uboIndex, 0);

    uniforms.addShape(new Shape({
        position: [0, 0, 0],
        size: [1, 1, 1],
        color: [0, 1, 0],
        shapeType: ShapeType.Sphere,
    }));
    // uniforms.addShape(new Shape({color: [1,0,0], size: [1,1,1], position: [1, 0, 1], shapeType: ShapeType.Cube}));
    // uniforms.addShape(new Shape({color: [0,0,1], size: [1,1,1], position: [0, 1, 1], shapeType: ShapeType.Sphere}));

    const quadRenderer = new QuadRenderer(context, program);
    context.renderer = {
        program: program,
        render(rs: RunningState) {
            if (uniforms.updateGlBuffer()) {
                quadRenderer.render(rs);
            }
        },
        resized: (width, height) => {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            uniforms.setCamera(camera);
        }
    };
    context.running = true;
}

start();