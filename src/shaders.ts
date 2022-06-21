// https://iquilezles.org/www/articles/distfunctions (living god)

// language=glsl
const RAY_MARCHER_VS = `
    #version 300 es

    precision highp float;

    layout(location=0) in vec2 position;

    out vec2 uv;

    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        uv = position;
    }
`;

// language=glsl
const RAY_MARCHER_FS = `
    #version 300 es

    precision highp float;

    struct Shape {
        vec3 position;
        mat3 rotation;
        vec4 size;
        vec3 color;
        float blendStrength;
        int shapeType;
        int operation;
        int numChildren;
    };

    uniform float uMaxDst;
    uniform float uEpsilon;
    uniform float uShadowBias;

    layout(std140) uniform uCamera {
        mat4 matrixWorld;
        mat4 projectionMatrixInverse;
    };

    layout(std140) uniform uShapes {
        Shape shapes[10];
        int numShapes;
    };

    layout(std140) uniform uLights {
        vec3 ambient;
        vec3 light;
        int positionLight;
    };

    in vec2 uv;
    out vec4 color;

    #define SPHERE 0
    #define BOX    1
    #define TORUS  2
    #define RBOX   3

    #define NONE   0
    #define BLEND  1
    #define CUT    2
    #define MASK   3

    #define CLEAR_COLOR vec4(0., 0., 0., 1.)

    struct Ray {
        vec3 origin;
        vec3 direction;
    };

    Ray createCameraRay(vec2 uv) {
        Ray ray;
        ray.origin = (matrixWorld * vec4(0, 0, 0, 1)).xyz;
        ray.direction = (projectionMatrixInverse * vec4(uv, 0, 1)).xyz;
        ray.direction = (matrixWorld * vec4(ray.direction, 0)).xyz;
        ray.direction = normalize(ray.direction);
        return ray;
    }

    float sdSphere(vec3 p, float radius)
    {
        return length(p) - radius;
    }

    float sdBox(vec3 p, vec3 b)
    {
        vec3 q = abs(p) - b;
        return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
    }

    float sdRoundBox(vec3 p, vec3 b, float r)
    {
        vec3 q = abs(p) - b;
        return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
    }

    float sdTorus(vec3 p, vec2 t)
    {
        vec2 q = vec2(length(p.xz)-t.x, p.y);
        return length(q)-t.y;
    }

    float getShapeDistance(Shape shape, vec3 eye)
    {
        //mat3 rotation = mat3(1.,0.,0., 0., 1., 0., 0., 0., 1.);
        vec3 p = (shape.position - eye) * shape.rotation;
        switch (shape.shapeType)
        {
            case SPHERE:
            return sdSphere(p, shape.size.x);
            case BOX:
            return sdBox(p, shape.size.xyz);
            case RBOX:
            return sdRoundBox(p, shape.size.xyz, shape.size.w);
            case TORUS:
            return sdTorus(p, shape.size.xy);
            default :
            return uMaxDst;
        }
    }

    // polynomial smooth min (k = 0.1);
    // from https://www.iquilezles.org/www/articles/smin/smin.htm
    vec4 blend(float a, float b, vec3 colA, vec3 colB, float k)
    {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        float blendDst = mix(b, a, h) - k * h * (1.0 - h);
        vec3 blendCol = mix(colB, colA, h);
        return vec4(blendCol, blendDst);
    }

    vec4 combine(float dstA, float dstB, vec3 colorA, vec3 colorB, int operation, float blendStrength) {
        float dst = dstA;
        vec3 color = colorA;

        switch (operation)
        {
            case NONE:
            if (dstB < dstA) {
                dst = dstB;
                color = colorB;
            }
            break;
            case BLEND:
            vec4 blend = blend(dstA, dstB, colorA, colorB, blendStrength);
            dst = blend.w;
            color = blend.xyz;
            break;
            case CUT:
            // max(a,-b)
            if (-dstB > dst) {
                dst = -dstB;
                color = colorB;
            }
            break;
            case MASK:
            // max(a,b)
            if (dstB > dst) {
                dst = dstB;
                color = colorB;
            }
            break;
        }
        return vec4(color, dst);
    }

    vec4 createSceneInfo(vec3 eye) {
        float globalDst = uMaxDst;
        vec3 globalColor = vec3(1.);

        for (int i = 0; i < numShapes; i ++) {
            Shape shape = shapes[i];
            int numChildren = shape.numChildren;

            float localDst = getShapeDistance(shape, eye);
            vec3 localColor = shape.color.rgb;

            for (int j = 0; j < numChildren; j ++) {
                Shape childShape = shapes[i+j+1];
                float childDst = getShapeDistance(childShape, eye);

                vec4 combined = combine(localDst, childDst, localColor, childShape.color, childShape.operation, childShape.blendStrength);
                localColor = combined.xyz;
                localDst = combined.w;
            }
            i += numChildren;// skip over children in outer loop

            vec4 globalCombined = combine(globalDst, localDst, globalColor, localColor, shape.operation, shape.blendStrength);
            globalColor = globalCombined.xyz;
            globalDst = globalCombined.w;
        }

        return vec4(globalColor, globalDst);
    }

    vec3 estimateNormal(vec3 p) {
        float x = createSceneInfo(vec3(p.x + uEpsilon, p.y, p.z)).w - createSceneInfo(vec3(p.x - uEpsilon, p.y, p.z)).w;
        float y = createSceneInfo(vec3(p.x, p.y + uEpsilon, p.z)).w - createSceneInfo(vec3(p.x, p.y - uEpsilon, p.z)).w;
        float z = createSceneInfo(vec3(p.x, p.y, p.z + uEpsilon)).w - createSceneInfo(vec3(p.x, p.y, p.z - uEpsilon)).w;
        return normalize(vec3(x, y, z));
    }

    float calculateShadow(Ray ray, float dstToShadePoint) {
        float rayDst = 0.;
        float shadowIntensity = .2;
        float brightness = 1.;

        while (rayDst < dstToShadePoint) {
            vec4 sceneInfo = createSceneInfo(ray.origin);
            float dst = sceneInfo.w;

            if (dst <= uEpsilon) {
                return shadowIntensity;
            }

            brightness = min(brightness, dst * 200.);

            ray.origin += ray.direction * dst;
            rayDst += dst;
        }

        return shadowIntensity + (1. - shadowIntensity) * brightness;
    }

    void main() {
        Ray ray = createCameraRay(uv);
        float rayDst = 0.;
        while (rayDst < uMaxDst) {
            vec4 sceneInfo = createSceneInfo(ray.origin);
            float dst = sceneInfo.w;

            if (dst <= uEpsilon) {
                vec3 pointOnSurface = ray.origin + ray.direction * dst;
                vec3 normal = estimateNormal(pointOnSurface - ray.direction * uEpsilon);
                vec3 lightDir = positionLight != 0 ? normalize(light - ray.origin) : -light;
                float lighting = clamp(dot(normal, lightDir), 0., 1.);
                vec3 col = sceneInfo.xyz;

                // Shadow
                vec3 offsetPos = pointOnSurface + normal * uShadowBias;
                vec3 dirToLight = positionLight != 0 ? normalize(light - offsetPos) : -light;

                ray.origin = offsetPos;
                ray.direction = dirToLight;

                float dstToLight = positionLight != 0 ? min(uMaxDst, distance(offsetPos, light)) : uMaxDst;
                float shadow = calculateShadow(ray, dstToLight);

                color = vec4(col * lighting * shadow + ambient, 1.);

                return;
            }

            ray.origin += ray.direction * dst;
            rayDst += dst;
        }
        color = CLEAR_COLOR;
    }
`

export const Shaders = {
    vs: RAY_MARCHER_VS.trim(),
    fs: RAY_MARCHER_FS.trim()
}
