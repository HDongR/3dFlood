export default `
uniform float time, dt, unit;
uniform sampler2D heightmap;
uniform sampler2D buildingmap;
uniform sampler2D drainmap;
uniform float dx, dy;

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
    vec2 pos = uv;
    vec2 posLeft = uv + vec2( - unit, 0.0 );
    vec2 posRight = uv + vec2( unit, 0.0  );
    vec2 posTop = uv + vec2( 0.0, unit );
    vec2 posBottom = uv + vec2( 0.0, - unit );
    vec2 posLeft2 = uv + vec2( - unit*2., 0.0 );
    vec2 posRight2 = uv + vec2( unit*2., 0.0  );
    vec2 posTop2 = uv + vec2( 0.0, unit*2. );
    vec2 posBottom2 = uv + vec2( 0.0, - unit*2. );
    vec2 posRightBottom = uv + vec2( unit, - unit );
    vec2 posLeftTop = uv + vec2( - unit, unit );

    vec4 _pos = texture2D(heightmap, pos);
    vec4 _posLeft = texture2D(heightmap, posLeft);
    vec4 _posRight = texture2D(heightmap, posRight);
    vec4 _posTop = texture2D(heightmap, posTop);
    vec4 _posBottom = texture2D(heightmap, posBottom);
    vec4 _posLeft2 = texture2D(heightmap, posLeft2);
    vec4 _posRight2 = texture2D(heightmap, posRight2);
    vec4 _posTop2 = texture2D(heightmap, posTop2);
    vec4 _posBottom2 = texture2D(heightmap, posBottom2);
    vec4 _posRightBottom = texture2D(heightmap, posRightBottom);
    vec4 _posLeftTop = texture2D(heightmap, posLeftTop);
     
    vec4 drain = texture2D(drainmap, uv);
    float qe = _pos.x;
    float qw = _posLeft.x;
    float qs = _pos.y;
    float qn = _posTop.y;
    float h = _pos.z;
    
    float q_sum = (qw - qe) / dx + (qn - qs) / dy;
    //float h_new = h + q_sum*dt;
    float h_new = h + (drain.x + q_sum) * dt;
    if(h_new < 0.){
        h_new = 0.;
    }

    _pos.z = h_new;
    gl_FragColor = _pos;

    // test..
    // if(abs(drain.x) > 0.){
    //     gl_FragColor = vec4(100.,100.,10000.,100.);
    // }else{
    //     gl_FragColor = vec4(1.,1.,1.,1.);
    // }
}

`