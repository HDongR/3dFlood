export default `
uniform float unit, time, dt;
uniform float sourceWaterHeight;
uniform float sourceWaterVelocity;
uniform float manningCoefficient;
uniform float gravity;
uniform sampler2D frictionMap;
uniform sampler2D heightmap;

vec2 pos, posLeft, posRight, posTop, posBottom;

#define V(D)  D.xy         // velocity
#define Vx(D) D.x          // velocity (x-component)
#define Vy(D) D.y          // velocity (y-component)
#define H(D)  D.z          // water height
#define T(D)  D.w          // terrain height
#define L(D)  H(D) + T(D)  // water level

vec4 simulationStep();

vec4 simData (vec2 pos) {
    vec4 data = texture2D(heightmap, pos);
    
    float minExtent = unit;
    float maxExtent = 1.0 - unit;

    if (pos.x < minExtent) {
        vec4 borderData = texture2D(heightmap, vec2(minExtent, clamp(pos.y, minExtent, maxExtent)));
        data.x = 0.0;
        data.z = borderData.z;
        data.w = borderData.w;
    } else if (pos.x > maxExtent) {
        vec4 borderData = texture2D(heightmap, vec2(maxExtent, clamp(pos.y, minExtent, maxExtent)));
        data.x = 0.0;
        data.z = borderData.z;
        data.w = borderData.w;
    }

    if (pos.y < minExtent) {
        vec4 borderData = texture2D(heightmap, vec2(clamp(pos.x, minExtent, maxExtent), minExtent));
        //data.y = sourceWaterHeight > borderData.w ? sourceWaterVelocity : 0.0;
        //data.z = sourceWaterHeight - borderData.w;
        data.y = 0.0;
        data.z = borderData.z;
        data.w = borderData.w;
    } else if (pos.y > maxExtent) {
        vec4 borderData = texture2D(heightmap, vec2(clamp(pos.x, minExtent, maxExtent), maxExtent));
        data.y = 0.0;
        data.z = borderData.z;
        data.w = borderData.w;
    }

    return data;
}

vec4 simulationStep() {
    vec4 here = simData(pos);

    if (H(here) < 0.0) return vec4(0.0, 0.0, H(here), T(here));

    vec4 X1 = simData(posLeft);
    vec4 X2 = simData(posRight);
    vec4 Y1 = simData(posTop);
    vec4 Y2 = simData(posBottom);

    // boundary: assume water is flat until shoreline
    float L_X1 = H(X1) < 0.0 && T(X1) > L(here) ? L(here) : L(X1);
    float L_X2 = H(X2) < 0.0 && T(X2) > L(here) ? L(here) : L(X2);
    float L_Y1 = H(Y1) < 0.0 && T(Y1) > L(here) ? L(here) : L(Y1);
    float L_Y2 = H(Y2) < 0.0 && T(Y2) > L(here) ? L(here) : L(Y2);

    vec2 slope = vec2(L_X2 - L_X1, L_Y2 - L_Y1) / (2.0 * unit);

    float n = manningCoefficient;
    //n *= texture2D(frictionMap, pos).x;
    n = 0.001;
    vec2 frictionSlope = V(here) * length(V(here)) * pow(n, 2.0) / pow(H(here), 4.0/3.0);

    vec2 totalSlope = slope + frictionSlope;

    // make sure new slope doesn't point in other direction
    totalSlope.x = slope.x < 0.0 ? min(totalSlope.x, 0.0) : max(totalSlope.x, 0.0);
    totalSlope.x = slope.x == 0.0 ? 0.0 : totalSlope.x;
    totalSlope.y = slope.y < 0.0 ? min(totalSlope.y, 0.0) : max(totalSlope.y, 0.0);
    totalSlope.y = slope.y == 0.0 ? 0.0 : totalSlope.y;

    vec2 newVelocity = V(here) - gravity * totalSlope * dt;

    float maxVelocity = 0.5 * unit / dt;
    
    if (length(newVelocity) > maxVelocity)
        newVelocity *= maxVelocity/length(newVelocity);

    if (H(X1) < 0.0 || H(X2) < 0.0) newVelocity.x = 0.0;
    if (H(Y1) < 0.0 || H(Y2) < 0.0) newVelocity.y = 0.0;

    return vec4(newVelocity, H(here), T(here));
}

void main(void) {
    vec2 uv = gl_FragCoord.xy * unit;

    pos = uv;
    posLeft = uv + vec2( - unit, 0.0 );
    posRight = uv + vec2( unit, 0.0  );
    posTop = uv + vec2( 0.0, unit );
    posBottom = uv + vec2( 0.0, - unit );

    gl_FragColor = simulationStep();

    //vec4 data = texture2D(heightmap, pos);

    //gl_FragColor = vec4(data.x, data.y, data.z+1., data.w);
}
`