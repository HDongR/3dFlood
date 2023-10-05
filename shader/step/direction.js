export default `
uniform float unit, time, dt;
uniform float sourceWaterHeight;
uniform float sourceWaterVelocity;
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

    if (H(here) <= 0.0) return vec4(V(here), H(here), T(here));

    vec4 origin = simData(pos - dt * V(here));
    float newHeight = H(origin);
    vec2 newVelocity = V(origin);

    if (newHeight <= 0.0) {
        newHeight = H(here);
        newVelocity = vec2(0.0, 0.0);
    }

    return vec4(newVelocity, newHeight, T(here));
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