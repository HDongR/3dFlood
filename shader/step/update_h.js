export default `
uniform float time, dt, unit;
uniform sampler2D heightmap;
uniform sampler2D drainmap;
uniform float dx, dy;

#define V(D)  D.xy         // velocity
#define Vx(D) D.x          // velocity (x-component)
#define Vy(D) D.y          // velocity (y-component)
#define H(D)  D.z          // water height
#define T(D)  D.w          // terrain height
#define L(D)  H(D) + T(D)  // water level

//factor
#define gravity 9.80665
#define theta 0.9
#define hf_min 0.005
#define v_route 0.1
#define q_thres 150.0

float hflow(float z0, float z1, float wse0, float wse1){
    return max(wse1, wse0) - max(z1, z0);
}

void main(void) {
    //float unit = 1./resolution.x;
    vec2 uv = gl_FragCoord.xy * unit;
    vec4 pos = texture2D(heightmap, uv);
    vec4 drain = texture2D(drainmap, uv);
    pos.z = pos.z + drain.x;
    gl_FragColor = pos;
}

`