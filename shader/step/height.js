export default `
uniform float unit, time, dt;
uniform float sourceWaterHeight;
uniform float sourceWaterVelocity;
uniform sampler2D heightmap;
uniform float manningCoefficient;
uniform float gravity;
uniform sampler2D frictionMap;


vec2 pos, posLeft, posRight, posTop, posBottom;

#define V(D)  D.xy         // velocity
#define Vx(D) D.x          // velocity (x-component)
#define Vy(D) D.y          // velocity (y-component)
#define H(D)  D.z          // water height
#define T(D)  D.w          // terrain height
#define L(D)  H(D) + T(D)  // water level

uniform float drainageAmount;
uniform float minFluxArea;

const float wettingThreshold = 0.000001;
const float newlyWetHeight = 0.0000003;

vec4 simulationStep();
vec4 simData (vec2 pos);
vec4 advectStep (vec2 param);

vec4 advectStep(vec2 param) {
    vec4 here = simData(param);

    if (H(here) <= 0.0) return vec4(V(here), H(here), T(here));

    vec4 origin = simData(pos - dt * V(here));
    float newHeight = H(origin);
    vec2 newVelocity = V(origin);

    if (newHeight <= 0.0) {
        newHeight = H(here);
        newVelocity = vec2(0.0, 0.0);
    }

    vec4 advect = vec4(newVelocity, newHeight, T(here));
    return advect;
}

vec4 simulationStep() {
    vec4 here = advectStep(pos);
    vec4 X1 = advectStep(posLeft);
    vec4 X2 = advectStep(posRight);
    vec4 Y1 = advectStep(posTop);
    vec4 Y2 = advectStep(posBottom);

    float dVelocityX = (Vx(X2) - Vx(X1)) / (2.0 * unit);
    float dVelocityY = (Vy(Y2) - Vy(Y1)) / (2.0 * unit);
    float velocityDivergence = (dVelocityX + dVelocityY);

    float newHeight;

    if (H(here) <= 0.0) {
        if ((H(X1) > wettingThreshold && L(X1) > T(here) + wettingThreshold)
        ||  (H(X2) > wettingThreshold && L(X2) > T(here) + wettingThreshold)
        ||  (H(Y1) > wettingThreshold && L(Y1) > T(here) + wettingThreshold)
        ||  (H(Y2) > wettingThreshold && L(Y2) > T(here) + wettingThreshold)) {
            newHeight = newlyWetHeight;
        } else newHeight = H(here);
    } else {
        float fluxArea = max(H(here), minFluxArea);
        newHeight = H(here) - fluxArea * velocityDivergence * dt;
        //newHeight -= drainageAmount;
        newHeight = 0.5;
        newHeight = max(-0.00001, newHeight);
        newHeight = min(H(here) * 2.0, newHeight);
    }

    return vec4(V(here), newHeight, T(here));
}

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
        data.y = sourceWaterHeight > borderData.w ? sourceWaterVelocity : 0.0;
        data.z = sourceWaterHeight - borderData.w;
        data.w = borderData.w;
    } else if (pos.y > maxExtent) {
        vec4 borderData = texture2D(heightmap, vec2(clamp(pos.x, minExtent, maxExtent), maxExtent));
        data.y = max(borderData.y, 0.0);
        data.z = borderData.z;
        data.w = borderData.w;
    }

    return data;
}

void main(void) {
    vec2 uv = gl_FragCoord.xy * unit;

    pos = uv;
    posLeft = uv + vec2( - unit, 0.0 );
    posRight = uv + vec2( unit, 0.0  );
    posTop = uv + vec2( 0.0, unit );
    posBottom = uv + vec2( 0.0, - unit );

    gl_FragColor = simulationStep();
}
`