import {vec3} from 'gl-matrix';

export interface Light {
    type: 'directional' | 'point'
}

export interface DirectionalLight extends Light {
    type: 'directional';
    direction: vec3;
}

export interface PointLight extends Light {
    type: 'point';
    position: vec3;
}
