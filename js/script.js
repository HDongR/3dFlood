
const swmm_run = Module.cwrap('swmm_run', 'number', ['string', 'string', 'string']);
const swmm_open = Module.cwrap('swmm_open', 'number', ['string', 'string', 'string']);
const swmm_step = Module.cwrap('swmm_step', 'number', ['number']);
const swmm_start = Module.cwrap('swmm_start', 'number', ['number']);
const swmm_setAllowPonding = Module.cwrap('swmm_setAllowPonding', 'number', ['number']);
const swmm_setNodeFullDepth = Module.cwrap('swmm_setNodeFullDepth', null, ['number','number']);
const swmm_getNodeHead = Module.cwrap('swmm_getNodeHead', 'number', ['number']);
const swmm_getNodeCrestElev = Module.cwrap('swmm_getNodeCrestElev', 'number', ['number']);
const swmm_getNodeDepth = Module.cwrap('swmm_getNodeDepth', 'number', ['number']);
const node_getSurfArea = Module.cwrap('node_getSurfArea', 'number', ['number','number']);
const apply_linkage_flow = Module.cwrap('apply_linkage_flow', 'number', ['number','number','number','number']);
