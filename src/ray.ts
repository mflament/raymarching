import {vec3} from "gl-matrix";

export interface Ray {
    readonly origin: vec3,
    readonly dir: vec3
}