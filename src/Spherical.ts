/**
 * Thank you again three.js
 * Ref: https://en.wikipedia.org/wiki/Spherical_coordinate_system
 *
 * The polar angle (phi) is measured from the positive y-axis. The positive y-axis is up.
 * The azimuthal angle (theta) is measured from the positive z-axis.
 */
import {vec3} from 'gl-matrix';
import MyMath from "./myMath";

export class Spherical {

    constructor(public radius = 1, public phi = 0, public theta = 0) {
        this.radius = radius;
        this.phi = phi; // polar angle
        this.theta = theta; // azimuthal angle
    }

    set(radius: number, phi: number, theta: number): Spherical {
        this.radius = radius;
        this.phi = phi;
        this.theta = theta;
        return this;
    }

    copy(other: Spherical): Spherical {
        this.radius = other.radius;
        this.phi = other.phi;
        this.theta = other.theta;
        return this;
    }

    // restrict phi to be between EPS and PI-EPS
    makeSafe(): Spherical {
        const EPS = 0.000001;
        this.phi = Math.max(EPS, Math.min(Math.PI - EPS, this.phi));
        return this;
    }

    setFromVector3(v: vec3): Spherical {
        return this.setFromCartesianCoords(v[0], v[1], v[2]);
    }

    setFromCartesianCoords(x: number, y: number, z: number) {
        this.radius = Math.sqrt(x * x + y * y + z * z);
        if (this.radius === 0) {
            this.theta = 0;
            this.phi = 0;
        } else {
            this.theta = Math.atan2(x, z);
            this.phi = Math.acos(MyMath.clamp(y / this.radius, -1, 1));
        }
        return this;
    }

    clone(): Spherical {
        return new Spherical().copy(this);
    }
}
