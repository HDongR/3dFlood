export default `
uniform float unit, time, dt;
uniform sampler2D heightmap;
uniform sampler2D infilmap;
uniform float infiltrationRate;
uniform float simTime;
uniform float rain_per_sec;

//honton
#define logE 2.718281828459045
#define MAX_K 9.0
#define MIN_K 2.0

float cap_inf_rate(float dt_h, float h, float infrate) {
    h = max(h, 0.);
    float h_mm = h * 1000.;
    float max_rate = h_mm / dt_h;
    return min(max_rate, infrate);
}

void main(void) {
    float K = (MIN_K-MAX_K)*infiltrationRate + MAX_K;

    vec2 uv = gl_FragCoord.xy * unit;
    vec4 here = texture2D(heightmap, uv);
    vec4 infrate = texture2D(infilmap, uv);

    float r_infrate = infrate.z+( (infrate.y-infrate.z)*pow(logE,-K*simTime/60.) );
    float dt_h = dt / 3600.;
    float rain = infrate.w;
    float o_inf = cap_inf_rate(dt_h, here.z, r_infrate);

    float dt_rain = dt / rain_per_sec;
    float h_new = max( here.z + ((rain*dt_rain - o_inf*dt_h) / 1000.), 0.);

    //here.z = h_new;
    gl_FragColor = here;
    //gl_FragColor = vec4(K,here.z,dt_h,r_infrate);
}

`