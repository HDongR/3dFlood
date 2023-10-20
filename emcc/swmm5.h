//-----------------------------------------------------------------------------
//   swmm5.h
//
//   Project: EPA SWMM5
//   Version: 5.1
//   Date:    03/24/14  (Build 5.1.001)
//   Author:  L. Rossman
//
//   Prototypes for SWMM5 functions exported to swmm5.dll.
//
//-----------------------------------------------------------------------------
#ifndef SWMM5_H
#define SWMM5_H

// --- define WINDOWS

#undef WINDOWS
#ifdef _WIN32
  #define WINDOWS
#endif
#ifdef __WIN32__
  #define WINDOWS
#endif

// --- define DLLEXPORT

#ifdef WINDOWS
  #define DLLEXPORT __declspec(dllexport) __stdcall
#else
  #define DLLEXPORT
#endif

// --- use "C" linkage for C++ programs

#ifdef __cplusplus
extern "C" { 
#endif 

//-----------------
// Coupling (GESZ)
//-----------------
typedef struct
{
	double flow;
	double depth;
	double velocity;
	double volume;
// added by L. Courty
	//~ double shearVelocity;
    int type;              // link type code
    //~ char* node1;           // start node ID
    //~ char* node2;           // end node ID
    double offset1;        // ht. above start node invert (ft)
    double offset2;        // ht. above end node invert (ft)
	double yFull;          // depth when full (ft)
    double froude;         // Froude number
} linkData;

typedef struct
{
	double inflow;
	double outflow;
	double head;
	double crestElev;
// added by L. Courty
   int           type;            // node type code
   int           subIndex;        // index of node's sub-category
   double        invertElev;      // invert elevation (ft)
   double        initDepth;       // initial storage level (ft)
   double        fullDepth;       // dist. from invert to surface (ft)
   double        surDepth;        // added depth under surcharge (ft)
   double        pondedArea;      // area filled by ponded water (ft2)

   int           degree;          // number of outflow links
   char          updated;         // true if state has been updated
   double        crownElev;       // top of highest connecting conduit (ft)
   double        losses;          // evap + exfiltration loss (ft3);           //(5.1.007)
   double        newVolume;       // current volume (ft3)
   double        fullVolume;      // max. storage available (ft3)
   double        overflow;        // overflow rate (cfs)
   double        newDepth;        // current water depth (ft)
   double        newLatFlow;      // current lateral inflow (cfs)
} nodeData;

int  DLLEXPORT   swmm_run(char* f1, char* f2, char* f3);
int  DLLEXPORT   swmm_open(char* f1, char* f2, char* f3);
int  DLLEXPORT   swmm_start(int saveFlag);
int  DLLEXPORT   swmm_step(double* elapsedTime);
int  DLLEXPORT   swmm_end(void);
int  DLLEXPORT   swmm_report(void);
int  DLLEXPORT   swmm_getMassBalErr(float* runoffErr, float* flowErr,
                 float* qualErr);
int  DLLEXPORT   swmm_close(void);
int  DLLEXPORT   swmm_getVersion(void);


// Coupling functions (GESZ)
double DLLEXPORT solve_dt();
double DLLEXPORT get_overflow_area(int index, double node_depth);
double DLLEXPORT apply_linkage_flow(int index, double h, double z, double cell_surf);
int DLLEXPORT  get_linkage_type(double wse, double crest_elev,
                          double node_head, double weir_width,
                          double overflow_area);

double DLLEXPORT get_linkage_flow(double wse, double node_head, double weir_width,
                            double crest_elev, int linkage_type, double overflow_area);                      

double DLLEXPORT   swmm_getMinSurf();
char* DLLEXPORT   swmm_getNodeID(int index);
char* DLLEXPORT   swmm_getLinkID(int index);
nodeData* DLLEXPORT   swmm_getNodeData(int index);
double DLLEXPORT   swmm_getNodeHead(int index);
double DLLEXPORT   swmm_getNodeCrestElev(int index);
double DLLEXPORT   swmm_getNodeDepth(int index);
double DLLEXPORT   swmm_getNodeLinkageFlow(int index);
double DLLEXPORT   swmm_getNodeLinkageType(int index);
void DLLEXPORT   swmm_setNodeLinkageFlow(int index, double linkage_flow);
void DLLEXPORT   swmm_setNodeLinkageType(int index, int linkage_type);
double DLLEXPORT   swmm_getNewRoutingTime();
double DLLEXPORT   swmm_getOldRoutingTime();
int DLLEXPORT   swmm_getRoutingModel();
double DLLEXPORT   swmm_getRoutingStep();
int DLLEXPORT   swmm_getNodeInflows(double* flows);
int DLLEXPORT   swmm_getNodeOutflows(double* flows);
int DLLEXPORT   swmm_getNodeHeads(double* heads);
int DLLEXPORT   swmm_addNodeInflow(int index, double inflow);
int DLLEXPORT   swmm_getLinkData(int index, linkData* data);
double DLLEXPORT   swmm_getLinkFlow(int index);

// Coupling functions (L. Courty)
int DLLEXPORT   swmm_setNodeFullDepth(int index, double depth);
int DLLEXPORT   swmm_setAllowPonding(int ap);
int DLLEXPORT swmm_getAllowPonding();
int DLLEXPORT   swmm_setNodePondedArea(int index, double area);



#ifdef __cplusplus 
}   // matches the linkage specification from above */ 
#endif

#endif
