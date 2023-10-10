export default `
uniform float unit, time, dt;
uniform sampler2D heightmap;
uniform sampler2D infmap;

#define V(D)  D.xy         // velocity
#define Vx(D) D.x          // velocity (x-component)
#define Vy(D) D.y          // velocity (y-component)
#define H(D)  D.z          // water height
#define T(D)  D.w          // terrain height
#define L(D)  H(D) + T(D)  // water level

float cap_inf_rate(float dt_h, float h, float infrate) {
    float h_mm = h * 1000.;
    float max_rate = h_mm / dt_h;
    return min(max_rate, infrate);
}

void main(void) {
    vec2 uv = gl_FragCoord.xy * unit;
    vec4 here = texture2D(heightmap, uv);
    vec4 infrate = texture2D(infmap, uv);

    float dt_h = dt / 3600.;
    
    float o_inf = cap_inf_rate(dt_h, H(here), infrate.x);
    gl_FragColor = vec4(infrate.x, o_inf, 0., 0.);
}

`