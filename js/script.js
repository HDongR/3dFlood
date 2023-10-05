
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
const c_apply_linkage_flow = Module.cwrap('apply_linkage_flow', 'number', ['number','number','number','number']);
const swmm_getNodeLinkageFlow = Module.cwrap('swmm_getNodeLinkageFlow', 'number', ['number']);
const swmm_getNodeLinkageType = Module.cwrap('swmm_getNodeLinkageType', 'number', ['number']);
const swmm_setNodeLinkageFlow = Module.cwrap('swmm_setNodeLinkageFlow', null, ['number','number']);
const swmm_setNodeLinkageType = Module.cwrap('swmm_setNodeLinkageType', null, ['number','number']);
const swmm_addNodeInflow = Module.cwrap('swmm_addNodeInflow', 'number', ['number','number']);
const routing_getRoutingStep = Module.cwrap('routing_getRoutingStep', 'number', ['number','number']);
const swmm_getNewRoutingTime = Module.cwrap('swmm_getNewRoutingTime', 'number', []);
const swmm_getOldRoutingTime = Module.cwrap('swmm_getOldRoutingTime', 'number', []);
const swmm_getRoutingModel = Module.cwrap('swmm_getRoutingModel', 'number', []);
const swmm_getRoutingStep = Module.cwrap('swmm_getRoutingStep', 'number', []);