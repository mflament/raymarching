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
        vec3 size;
        vec3 color;
        float blendStrength;
        int shapeType;
        int operation;
        int numChildren;
    };

    layout(std140) uniform Uniforms {
        Shape shapes[10];
        int numShapes;
        mat4 matrixWorld;
        mat4 projectionMatrixInverse;
        vec3 ambient;
        vec3 light;
        int positionLight;
    };

    in vec2 uv;
    out vec4 color;

    #define SPHERE 0
    #define CUBE   1
    #define TORUS  2

    #define NONE   0
    #define BLEND  1
    #define CUT    2
    #define MASK   3
    
    #define CLEAR_COLOR vec4(0., 0., 0., 1.)
    
    const float maxDst = 80.;
    const float epsilon = 0.001;
    const float shadowBias = epsilon * 50.;

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

    // Following distance functions from https://iquilezles.org/www/articles/distfunctions/distfunctions.htm
    float dot2( in vec2 v ) { return dot(v,v); }
    float dot2( in vec3 v ) { return dot(v,v); }
    float ndot( in vec2 a, in vec2 b ) { return a.x*b.x - a.y*b.y; }

    float getSphereDistance(vec3 eye, vec3 centre, float radius) {
        return distance(eye, centre) - radius;
    }

    float getCubeDistance(vec3 eye, vec3 centre, vec3 size) {
        vec3 o = abs(eye - centre) - size * .5;
        float ud = length(max(o, 0.));
        float n = max(max(min(o.x, 0.), min(o.y, 0.)), min(o.z, 0.));
                
        return ud + n;
    }

    float getTorusDistance(vec3 eye, vec3 centre, float r1, float r2)
    {
        vec2 q = vec2(length((eye - centre).xz) - r1, eye.y - centre.y);
        return length(q) - r2;
    }

    float getShapeDistance(Shape shape, vec3 eye) {
        switch (shape.shapeType)
        {
            case SPHERE:
            return getSphereDistance(eye, shape.position, shape.size.x);
            case CUBE:
            return getCubeDistance(eye, shape.position, shape.size);
            case TORUS:
            return getTorusDistance(eye, shape.position, shape.size.x, shape.size.y);
            default :
            return maxDst;
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
        float globalDst = maxDst;
        vec3 globalColor = vec3(1.);

        for (int i = 0; i < numShapes; i ++) {
            Shape shape = shapes[i];
            int numChildren = shape.numChildren;

            float localDst = getShapeDistance(shape, eye);
            vec3 localColor = shape.color;

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
        float x = createSceneInfo(vec3(p.x + epsilon, p.y, p.z)).w - createSceneInfo(vec3(p.x - epsilon, p.y, p.z)).w;
        float y = createSceneInfo(vec3(p.x, p.y + epsilon, p.z)).w - createSceneInfo(vec3(p.x, p.y - epsilon, p.z)).w;
        float z = createSceneInfo(vec3(p.x, p.y, p.z + epsilon)).w - createSceneInfo(vec3(p.x, p.y, p.z - epsilon)).w;
        return normalize(vec3(x, y, z));
    }

    float calculateShadow(Ray ray, float dstToShadePoint) {
        float rayDst = 0.;
        float shadowIntensity = .2;
        float brightness = 1.;

        while (rayDst < dstToShadePoint) {
            vec4 sceneInfo = createSceneInfo(ray.origin);
            float dst = sceneInfo.w;

            if (dst <= epsilon) {
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
        while (rayDst < maxDst) {
            vec4 sceneInfo = createSceneInfo(ray.origin);
            float dst = sceneInfo.w;

            if (dst <= epsilon) {
                vec3 pointOnSurface = ray.origin + ray.direction * dst;
                vec3 normal = estimateNormal(pointOnSurface - ray.direction * epsilon);
                vec3 lightDir = positionLight != 0 ? normalize(light - ray.origin) : -light;
                float lighting = clamp(dot(normal, lightDir), 0., 1.);
                vec3 col = sceneInfo.xyz;

                // Shadow
                vec3 offsetPos = pointOnSurface + normal * shadowBias;
                vec3 dirToLight = positionLight != 0 ? normalize(light - offsetPos) : -light;

                ray.origin = offsetPos;
                ray.direction = dirToLight;

                float dstToLight = positionLight != 0 ? min(maxDst, distance(offsetPos, light)) : maxDst;
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
