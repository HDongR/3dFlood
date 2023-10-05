let MinSurfArea = 12.566;
let FOOT = 0.3048;
let FOOT2 = FOOT * FOOT;
let FOOT3 = FOOT * FOOT * FOOT;

let ORIFICE_COEFF = 0.167;
let FREE_WEIR_COEFF = 0.54;
let SUBMERGED_WEIR_COEFF = 0.056;
let g = 9.80665;

const copySign = (x, y) => Math.sign(x) === Math.sign(y) ? x : -x;

function get_linkage_type(wse, crest_elev, node_head, weir_width, overflow_area){
    let depth_2d = wse - crest_elev;
    let weir_ratio = overflow_area / weir_width;
    let overflow = node_head > wse;
    let drainage = node_head < wse;

    let free_weir = drainage && (node_head < crest_elev);
    let submerged_weir = drainage && (node_head > crest_elev) && (depth_2d < weir_ratio);
    let drainage_orifice = drainage && (node_head > crest_elev) && (depth_2d > weir_ratio);

    let overflow_orifice = overflow;

    /**
    * 
    NOT_LINKED = 0
    NO_LINKAGE = 1
    FREE_WEIR = 2
    SUBMERGED_WEIR = 3
    ORIFICE = 4
    * 
    */
    let new_linkage_type = 0;
    if(overflow_orifice || drainage_orifice){
        new_linkage_type = 4;//linkage_types.ORIFICE
    }
    //# drainage free weir
    else if(free_weir){
        new_linkage_type = 2;//linkage_types.FREE_WEIR
    }
    //# drainage submerged weir
    else if(submerged_weir){
        new_linkage_type = 3;//linkage_types.SUBMERGED_WEIR
    }else{
        new_linkage_type = 1;//linkage_types.NO_LINKAGE
    }
    return new_linkage_type;
}

function get_linkage_flow(wse, node_head, weir_width, crest_elev, linkage_type, overflow_area){
            
    let unsigned_q = 0;

    let head_up = Math.max(wse, node_head);
    let head_down = Math.min(wse, node_head);
    let head_diff = head_up - head_down;
    let upstream_depth = head_up - crest_elev;

    /**
    * 
    NOT_LINKED = 0
    NO_LINKAGE = 1
    FREE_WEIR = 2
    SUBMERGED_WEIR = 3
    ORIFICE = 4
    * 
    */

    //# calculate the flow
    if(linkage_type == 1){//linkage_types.NO_LINKAGE:
        unsigned_q = 0.0;
    }
    else if(linkage_type == 4){ //linkage_types.ORIFICE:
        unsigned_q = ORIFICE_COEFF * overflow_area * Math.sqrt(2. * g * head_diff);
    }
    else if(linkage_type == 2){ //linkage_types.FREE_WEIR:
        //#printf("upstream_depth=>%d %f \n", i, upstream_depth)
        unsigned_q = ((2.0/3.0) * FREE_WEIR_COEFF * weir_width *
        Math.pow(upstream_depth, 3.0/2.0) * Math.sqrt(2.0 * g));
    }
    else if(linkage_type == 3){ //linkage_types.SUBMERGED_WEIR:
        unsigned_q = (SUBMERGED_WEIR_COEFF * weir_width * upstream_depth * Math.sqrt(2. * g * upstream_depth));
    }
    //# assign flow sign
    return copySign(unsigned_q, node_head - wse);                            
}

function get_overflow_area(node_idx, node_depth){
    //"""return overflow area defauting to MinSurfArea
    //"""
    //cdef float overflow_area, surf_area
    let overflow_area = 0;
    let surf_area = node_getSurfArea(node_idx, node_depth);
    if(surf_area <= 0.){
        overflow_area = MinSurfArea;
    }
    return overflow_area * FOOT2;
}

export function apply_linkage_flow(index, h, z, node_invert_elev, cell_surf, dt1d){
    let node_crest_elev = swmm_getNodeCrestElev(index);
    let wse = z + h;
    let crest_elev = 0; 
    if(node_crest_elev != z){
        let full_depth = z - node_invert_elev;
        //# Set value in feet. This func updates the fullVolume too
        swmm_setNodeFullDepth(index, full_depth);
        crest_elev = z;
    }
    else{
        crest_elev = node_crest_elev;
    }

    //## linkage type ##
    let nodeDepth = swmm_getNodeDepth(index);
    let overflow_area = get_overflow_area(index, nodeDepth);
    //# weir width is the circumference (node considered circular)
    let weir_width = Math.PI * 2.0 * Math.sqrt(overflow_area / Math.PI);
    //# determine linkage type
    let head = (node_invert_elev + nodeDepth);
    let linkage_type = get_linkage_type(wse, crest_elev, head, weir_width, overflow_area);

    //## linkage flow ##
    //int index, double wse, double node_head, double weir_width, double crest_elev, int linkage_type, double overflow_area
    let new_linkage_flow = get_linkage_flow(wse, head, weir_width,
                                            crest_elev, linkage_type,
                                            overflow_area);

    //## flow limiter ##
    //# flow leaving the 2D domain can't drain the corresponding cell
    let maxflow = 0;
    if(new_linkage_flow < 0.0){
        maxflow = (h * cell_surf) / dt1d;
        new_linkage_flow = Math.max(new_linkage_flow, -maxflow);
    }

 /**
     * 
    NOT_LINKED = 0
    NO_LINKAGE = 1
    FREE_WEIR = 2
    SUBMERGED_WEIR = 3
    ORIFICE = 4
     * 
    */

    //## force flow to zero in case of flow inversion ##
    let current_linkage_flow = swmm_getNodeLinkageFlow(index);
    let overflow_to_drainage = current_linkage_flow > 0 && new_linkage_flow < 0;
    let drainage_to_overflow = current_linkage_flow < 0 && new_linkage_flow > 0;
    if(overflow_to_drainage || drainage_to_overflow){
        linkage_type = 1;//linkage_types.NO_LINKAGE
        new_linkage_flow = 0.0;
    }

    //#~         print(wse, node.head, linkage_type, new_linkage_flow)

    //# apply flow to 2D model (m/s) and drainage model (cfs)
    //arr_qdrain[row, col] = new_linkage_flow / cell_surf
    let inflowRst = swmm_addNodeInflow(index, - new_linkage_flow);
    //# update node array
    swmm_setNodeLinkageFlow(index, new_linkage_flow);
    swmm_setNodeLinkageType(index, linkage_type);
    //arr_node[i] = node
    return new_linkage_flow / FOOT3;
}