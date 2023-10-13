export default `
uniform float time, dt, unit;
uniform sampler2D heightmap;
uniform sampler2D infilmap;
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

float almeida2013(float hf, float wse0, float wse1, float n,
    float qm1, float q0, float qp1,
    float q_norm, float cell_len){

    float slope = (wse0 - wse1) / cell_len;
    float term_1 = theta * q0 + (1. - theta) * (qm1 + qp1) * 0.5;
    float term_2 = gravity * hf * dt * slope;
    float term_3 = 1. + gravity * dt * (n*n) * q_norm / pow(hf, 7./3.);

    if(term_1 * term_2 < 0.){
        term_1 = q0;
    }
    return (term_1 + term_2) / term_3;
}

float rain_routing(float h0, float wse0, float wse1, float cell_len){
    float dh = wse0 - wse1;
    dh = max(dh, 0.);
    dh = min(dh, h0);
    float maxflow = cell_len * dh / dt;
    float q_routing = min(dh * v_route, maxflow);
    return q_routing;
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
    
    float z0 = _pos.w;
    float h0 = _pos.z;
    float wse0 = z0 + h0;
    float n0 = texture2D(infilmap, pos).x;
    float qe = _pos.x;
    float qs = _pos.y;

    float ze = _posRight.w;
    float h_e = _posRight.z;
    float wse_e = ze + h_e;
    float ne = 0.5 * (n0 + texture2D(infilmap, posRight).x);
    float qe_st = 0.25 * (qs + _posBottom.y + _posRightBottom.y + _posRight.y);
    float qe_vect = sqrt(qe*qe + qe_st*qe_st);
    float hf_e = hflow(z0, ze, wse0, wse_e);
    float qe_new = 0.;
    if(hf_e <= 0.){
        qe_new = 0.;
    }else if(hf_e > hf_min){
        qe_new = almeida2013(hf_e, wse0, wse_e, ne, _posLeft.x, qe, _posRight.x, qe_vect, dx);
    }else if(hf_e <= hf_min && z0 > ze && wse_e > wse0){
        qe_new = - rain_routing(h_e, wse_e, wse0, dx);
    }else if(hf_e <= hf_min && z0 < ze && wse0 > wse_e){
        qe_new = rain_routing(h0, wse0, wse_e, dx);
    }else{
        qe_new = 0.;
    }

    if( qe_new > q_thres){
        qe_new = q_thres;
    }else if(qe_new < -q_thres){
        qe_new = -q_thres;
    }

    float zs = _posTop.w;
    float h_s = _posTop.z;
    float wse_s = zs + h_s;
    float ns = 0.5 * (n0 + texture2D(infilmap, posTop).x);
    float qs_st = 0.25 * (qe + _posTop.x + _posLeftTop.x + _posLeft.x);
    float qs_vect = sqrt(qs*qs + qs_st*qs_st);
    float hf_s = hflow(z0, zs, wse0, wse_s);
    float qs_new = 0.;
    if(hf_s <= 0.){
        qs_new = 0.;
    }else if(hf_s > hf_min){
        qs_new = almeida2013(hf_s, wse0, wse_s, ns, _posBottom.y, qs, _posTop.y, qs_vect, dy);
    }else if(hf_s <= hf_min && z0 > zs && wse_s > wse0){
        qs_new = - rain_routing(h_s, wse_s, wse0, dy);
    }else if(hf_s <= hf_min && z0 < zs && wse0 > wse_s){
        qs_new = rain_routing(h0, wse0, wse_s, dy);
    }else{
        qs_new = 0.;
    }

    if(qs_new > q_thres){
        qs_new = q_thres;
    }else if(qs_new < -q_thres){
        qs_new = -q_thres;
    }
    _pos.x = qe_new;
    _pos.y = qs_new;
    gl_FragColor = _pos;
    //gl_FragColor = vec4(100.,100.,100.,100.);
}

`