import {Shaders} from "./shaders";
import {Uniforms} from "./uniforms";
import {GLContext, QuadRenderer, RunningState} from "webgl-support";
import {PerspectiveCamera} from "./PerspectiveCamera";
import {DirectionalLight, PointLight} from "./Light";
import {quat, vec3} from "gl-matrix";
import {Operation, Shape, ShapeType} from "./shape";
import {OrbitControls} from "./orbitControls";

const pointLight = false;

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
        target: [0, 0, 0],
        aspect: canvas.width / canvas.height
    });

    const uniforms = new Uniforms(context.gl);

    const amb =  .08;
    uniforms.setAmbient([amb, amb, amb]);

    let light: DirectionalLight | PointLight;
    if (pointLight) {
        light = {type: 'point', position: vec3.set(vec3.create(), 5, 5, 5)}
    } else {
        const direction = vec3.set(vec3.create(), -0.5, -0.5, -0.5);
        vec3.normalize(direction, direction);
        light = {type: 'directional', direction: direction};
    }
    uniforms.setLight(light);

    const program = context.programBuilder().vertexShader(Shaders.vs).fragmentShader(Shaders.fs).link();
    const uboIndex = gl.getUniformBlockIndex(program, "Uniforms");
    gl.uniformBlockBinding(program, uboIndex, 0);

    uniforms.addShape(new Shape({
        position: [0, 0, 0],
        size: [Math.sqrt(2), Math.sqrt(2), Math.sqrt(2)],
        color: [0, 1, 0],
        shapeType: ShapeType.Sphere,
        numChildren: 1
    }));
    uniforms.addShape(new Shape({
        position: [0, 0, 0],
        size: [1, 1, 1],
        color: [1, 0, 0],
        shapeType: ShapeType.Cube,
        operation: Operation.Cut,
        blendStrength: .5
    }));
    // uniforms.addShape(new Shape({color: [0,0,1], size: [1,1,1], position: [0, 1, 1], shapeType: ShapeType.Sphere}));

    const quadRenderer = new QuadRenderer(context, program);
    new OrbitControls(camera, canvas);

    const ligthTransform = quat.create();
    context.renderer = {
        program: program,
        render(rs: RunningState) {
            if (camera.update()) uniforms.setCamera(camera);
            const angle = rs.dt * 0.1 * Math.PI;
            if (light.type === 'directional') {
                quat.rotateY(ligthTransform, quat.identity(ligthTransform), angle);
                vec3.transformQuat(light.direction, light.direction, ligthTransform);
                uniforms.setLight(light);
            } else {
                vec3.rotateY(light.position, light.position, [0,light.position[1], 0], angle);
                uniforms.setLight(light);
            }
            if (uniforms.updateGlBuffer()) {
                quadRenderer.render(rs);
            }
        },
        resized: (width, height) => {
            camera.aspect = width / height;
            camera.touchProjection();
        }
    };
    context.running = true;
}

start();