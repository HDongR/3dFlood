export default `
uniform float unit, time, dt;
uniform float sourceWaterHeight;
uniform float sourceWaterVelocity;

// current and neighbor positions, passed from vertex shader

vec2 pos, posLeft, posRight, posTop, posBottom;

// macros to access components of simulation data vector

#define V(D)  D.xy         // velocity
#define Vx(D) D.x          // velocity (x-component)
#define Vy(D) D.y          // velocity (y-component)
#define H(D)  D.z          // water height
#define T(D)  D.w          // terrain height
#define L(D)  H(D) + T(D)  // water level
`