export function parseInp(text) {
    var regex = {
        section: /^\s*\[\s*([^\]]*)\s*\].*$/,
        value: /\s*([^\s]+)([^;]*).*$/,
        description: /^\s*;.*$/,
        comment: /^\s*;;.*$/
    },
    parser = {
        // TITLE Title/Notes needs to consume all of the lines until the next section.
        TITLE: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {TitleNotes: key + line};
        },
        OPTIONS: function(section, key, line) {
            var m = line.match(/\s+([//\-:a-zA-Z0-9\.]+)/);
                if (m && m.length)
                    section[key] = {Value: m[1]};
            return;
        },
        RAINGAGES: function(section, key, line) {
                var m = line.match(/\s+([a-zA-Z0-9\.]+)\s+([:0-9\.]+)\s+([0-9\.]+)\s+([A-Za-z0-9\.]+)\s+([A-Za-z0-9\.]+)/);
                if (m && m.length)
                    section[key] = {Format: m[1], Interval: m[2], SCF: m[3], Source: m[4], SeriesName: m[5], Description: curDesc};
                    //swmmjs.model.RAINGAGES[id] = {Description: '', Format: 'INTENSITY', Interval: '1:00', SCF: 1.0, Source: 'TIMESERIES', SeriesName: '*', FileName: '*', StationID: '*', RainUnits: 'IN'}
        },
        /* TEMPERATURE is an object, not an array. */
        /* Each key of TEMPERATURE is an individual object/array. */
        TEMPERATURE: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\s+/);

            if (m && m.length){
                switch(key){
                    case 'TIMESERIES':
                        model.TEMPERATURE.TimeSeries = m[1].trim();
                        break;
                    case 'FILE':
                        model.TEMPERATURE.File = m[1].trim();
                        if(m[2]) model.TEMPERATURE.FileStart = m[2].trim();
                        else model.TEMPERATURE.FileStart = null;
                        break;
                    case 'WINDSPEED':
                        switch(m[1].trim()){
                            case 'MONTHLY':
                                // Read in 12 numbers
                                model.TEMPERATURE.WINDSPEED = {Type: 'MONTHLY', AWS: []};
                                for(let i = 0; i < 12; i++){
                                    model.TEMPERATURE.WINDSPEED.AWS[i] = parseFloat(m[i+2]);
                                }
                                break;
                            case 'FILE':
                                // Actual file name is in model.TEMPERATURE.File
                                model.TEMPERATURE.WINDSPEED = {Type: 'FILE'};
                                break;
                        }
                    case 'SNOWMELT':
                         // Read in 6 numbers
                         model.TEMPERATURE.SNOWMELT = [];
                         for(let i = 0; i < 6; i++){
                            model.TEMPERATURE.SNOWMELT[i] = parseFloat(m[i+1]);

                            model.TEMPERATURE.SNOWMELT.DivideTemp     = parseFloat(m[1]);
                            model.TEMPERATURE.SNOWMELT.ATIWeight      = parseFloat(m[2]);
                            model.TEMPERATURE.SNOWMELT.NegMeltRatio   = parseFloat(m[3]);
                            model.TEMPERATURE.SNOWMELT.MSLElev        = parseFloat(m[4]);
                            model.TEMPERATURE.SNOWMELT.DegLatitude    = parseFloat(m[5]);
                            model.TEMPERATURE.SNOWMELT.LongCorrection = parseFloat(m[6]);
                         }
                         break;
                    case 'ADC':
                        if(!model.TEMPERATURE.ADC) model.TEMPERATURE.ADC = {};
                        switch(m[1].trim()){
                            case 'IMPERVIOUS':
                                model.TEMPERATURE.ADC.IMPERVIOUS = [];
                                for(let i = 0; i < 10; i++){
                                    model.TEMPERATURE.ADC.IMPERVIOUS[i] = parseFloat(m[i+2]);
                                }
                                break;
                            case 'PERVIOUS':
                                model.TEMPERATURE.ADC.PERVIOUS = [];
                                for(let i = 0; i < 10; i++){
                                    model.TEMPERATURE.ADC.PERVIOUS[i] = parseFloat(m[i+2]);
                                }
                                break;
                        }
                }
            }
            return;
        },
        
        EVAPORATION: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\s+/);

            if (m && m.length){
                switch(key){
                    case 'CONSTANT':
                        model.EVAPORATION.Constant = parseFloat(m[1]);
                        break;
                    case 'MONTHLY':
                        // Read in 12 numbers
                        model.EVAPORATION.MONTHLY = [];
                        for(let i = 0; i < 12; i++){
                            model.EVAPORATION.MONTHLY[i] = parseFloat(m[i+1]);
                        }
                        break;
                    case 'TIMESERIES':
                        model.EVAPORATION.TimeSeries = m[1].trim();
                        break;
                    case 'TEMPERATURE':
                        model.EVAPORATION.Temperature = m[1].trim();
                        break;
                    case 'FILE':
                        model.EVAPORATION.FILE = [];
                        for(let i = 0; i < 12; i++){
                            model.EVAPORATION.FILE[i] = parseFloat(m[i+1]);
                        }
                        break;
                    case 'RECOVERY':
                        model.EVAPORATION.Recovery = m[1].trim();
                        break;
                    case 'DRY_ONLY':
                        model.EVAPORATION.DryOnly = m[1].trim();
                        break;
                }
            }
            return;
        },
        SUBCATCHMENTS: function(section, key, line) {
            var m = line.match(/\s*([^\s;]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([^;]).*/);
            if (m && m.length && 9 === m.length) {
                section[key] = {RainGage: m[1], Outlet: parseFloat(m[2]), 
                Area: parseFloat(m[3]), PctImperv: parseFloat(m[4]),
                Width: parseFloat(m[5]), PctSlope: parseFloat(m[6]), CurbLen: parseFloat(m[7]), SnowPack: m[8], Description: curDesc};
            }
        },
        SUBAREAS: function(section, key, line) {
            line = key + line;
            line = line.trim();
            m = line.split(/\b\s+/)
            if (m && m.length)
                    section[key] = {NImperv: parseFloat(m[1]), 
                                    NPerv: parseFloat(m[2]), 
                                    SImperv: parseFloat(m[3]), 
                                    SPerv: parseFloat(m[4]), 
                                    PctZero: parseFloat(m[5]), 
                                    RouteTo: m[6].trim(), 
                                    PctRouted: m.length === 8 ? m[7].trim() : null};
            return;
        },
        INFILTRATION: function(section, key, line) {
                var m = line.match(/\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)/);
                if (m && m.length)
                    section[key] = {MaxRate: parseFloat(m[1]), 
                                    MinRate: parseFloat(m[2]), 
                                    Decay: parseFloat(m[3]), 
                                    DryTime: parseFloat(m[4]), 
                                    MaxInfil: parseFloat(m[5])};
        },
        AQUIFERS: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        },
        GROUNDWATER: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        },
        SNOWPACKS: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        },
        JUNCTIONS: function(section, key, line, curDesc) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
                if (m && m.length)
                    section[key] = {Invert: parseFloat(m[1]), 
                                    Dmax: parseFloat(m[2]), 
                                    Dinit: parseFloat(m[3]), 
                                    Dsurch: parseFloat(m[4]), 
                                    Aponded: parseFloat(m[5]), 
                                    Description: curDesc};
        },
        OUTFALLS: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length)
                    section[key] = {Invert: parseFloat(m[1]), Type: m[2].trim(), StageData: 'NO', Gated: m[3].trim() };
        },
        STORAGE: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);

            if (m && m.length){
                    if(m[4].trim() === 'FUNCTIONAL'){
                        section[key] = {Invert: parseFloat(m[1]), 
                                        Dmax: parseFloat(m[2]), 
                                        Dinit: parseFloat(m[3]), 
                                        Curve: m[4].trim(), 
                                        Coefficient: parseFloat(m[5]), 
                                        Exponent: parseFloat(m[6]), 
                                        Constant: parseFloat(m[7]),
                                        CurveName: '',
                                        Aponded: parseFloat(m[8]), 
                                        Fevap: parseFloat(m[9]), 
                                        SeepRate: parseFloat(m[10]), 
                                        Description: curDesc}
                    } else if (m[4].trim() === 'TABULAR'){
                        section[key] = {Invert: parseFloat(m[1]), 
                                        Dmax: parseFloat(m[2]), 
                                        Dinit: parseFloat(m[3]), 
                                        Curve: m[4].trim(),
                                        Coefficient: 0, 
                                        Exponent: 0, 
                                        Constant: 0,
                                        CurveName: m[5].trim(),
                                        Aponded: parseFloat(m[6]), 
                                        Fevap: parseFloat(m[7]), 
                                        SeepRate: parseFloat(m[8]), 
                                        Description: curDesc}
                    }
            }

        },
        DIVIDERS: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length){
                    if(m[3].trim() === 'WEIR'){
                        section[key] = {Invert: parseFloat(m[1]), 
                                        DivertedLink: m[2].trim(), 
                                        Type: m[3].trim(), 
                                        P1: parseFloat(m[4]), 
                                        P2: parseFloat(m[5]), 
                                        P3: parseFloat(m[6]), 
                                        Dmax: parseFloat(m[7]), 
                                        Dinit: parseFloat(m[8]), 
                                        Dsurch: parseFloat(m[9]), 
                                        Aponded: parseFloat(m[10]), 
                                        Description: curDesc}
                    } else if (m[3].trim() === 'CUTOFF'){
                        section[key] = {Invert: parseFloat(m[1]), 
                                        DivertedLink: m[2].trim(), 
                                        Type: m[3].trim(), 
                                        P1: parseFloat(m[4]), 
                                        P2: 0, 
                                        P3: 0, 
                                        Dmax: parseFloat(m[5]), 
                                        Dinit: parseFloat(m[6]), 
                                        Dsurch: parseFloat(m[7]), 
                                        Aponded: parseFloat(m[8]), 
                                        Description: curDesc}
                    } else if (m[3].trim() === 'TABULAR'){
                        section[key] = {Invert: parseFloat(m[1]), 
                                        DivertedLink: m[2].trim(), 
                                        Type: m[3].trim(), 
                                        P1: m[4].trim(), 
                                        P2: 0, 
                                        P3: 0, 
                                        Dmax: parseFloat(m[5]), 
                                        Dinit: parseFloat(m[6]), 
                                        Dsurch: parseFloat(m[7]), 
                                        Aponded: parseFloat(m[8]), 
                                        Description: curDesc}
                    } else if (m[3].trim() === 'OVERFLOW'){
                        section[key] = {Invert: parseFloat(m[1]), 
                                        DivertedLink: m[2].trim(), 
                                        Type: m[3].trim(), 
                                        P1: 0, 
                                        P2: 0, 
                                        P3: 0, 
                                        Dmax: parseFloat(m[4]), 
                                        Dinit: parseFloat(m[5]), 
                                        Dsurch: parseFloat(m[6]), 
                                        Aponded: parseFloat(m[7]), 
                                        Description: curDesc}
                    }
            }

        },
        CONDUITS: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length && (8 === m.length || 9 === m.length)) {
                section[key] = {FromNode: m[1], 
                                ToNode: m[2], 
                                Length: parseFloat(m[3]),   
                                Roughness: parseFloat(m[4]),
                                InOffset: parseFloat(m[5]), 
                                OutOffset: parseFloat(m[6]), 
                                InitFlow: m[7], 
                                MaxFlow: m[8], 
                                Description: curDesc
                            };
            }
        },
        PUMPS: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length)
                    section[key] = {Node1: m[1], 
                                    Node2: m[2], 
                                    Curve: m[3], 
                                    Status: m[4], 
                                    Dstart: null, 
                                    Doff: null,
                                    Description: curDesc
            }
            if(m[5] && m[6]){
                section[key].Dstart = parseFloat(m[5]);
                section[key].Doff = parseFloat(m[6]);
            }
        },
        ORIFICES: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length)
                    section[key] = {FromNode: parseFloat(m[1]), 
                                    ToNode: parseFloat(m[2]), 
                                    Type: m[3].trim(), 
                                    InletOffset: parseFloat(m[4]), 
                                    Qcoeff: parseFloat(m[5]), 
                                    Gated: m[6].trim(),
                                    CloseTime: parseFloat(m[7]),
                                    Description: curDesc
            }
        },
        WEIRS: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length)
                    section[key] = {FromNode: parseFloat(m[1]), 
                                    ToNode: parseFloat(m[2]), 
                                    Type: m[3].trim(), 
                                    InletOffset: parseFloat(m[4]), 
                                    Qcoeff: parseFloat(m[5]), 
                                    Gated: m[6].trim(),
                                    EndCon: parseFloat(m[7]),
                                    EndCoeff: parseFloat(m[8]),
                                    Description: curDesc
            }
        },
        OUTLETS: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length){
                    let outletTableName = '*';
                    let outletCoeff = 0;
                    if(m[4].trim() === 'TABULAR/HEAD' || m[4].trim() === 'TABULAR/DEPTH'){
                        outletTableName = m[5].trim();
                    } else {
                        outletCoeff = parseFloat(m[5]);
                    }
                    section[key] = {FromNode: parseFloat(m[1]), 
                                    ToNode: parseFloat(m[2]), 
                                    InletOffset: parseFloat(m[3]), 
                                    Type: m[4].trim(),
                                    Qcoeff: outletCoeff, 
                                    QTable: outletTableName,
                                    Qexpon: parseFloat(m[6]),
                                    Gated: m[7].trim(),
                                    Description: curDesc
                    }
            }
        },
        XSECTIONS: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length && 7 === m.length) {
                section[key] = {Shape: m[1], Geom1: m[2], Geom2: m[3], Geom3: m[4], Geom4: m[5], Barrels: m[6]};
            }
        },
        TRANSECTS: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        },
        LOSSES: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length)
                    section[key] = {Kin: parseFloat(m[1]), 
                                    Kout: m[2].trim(), 
                                    Kavg: m[3].trim(), 
                                    FlapGate: m[4].trim(), 
                                    SeepRate: m[5].trim()};
        },
        POLLUTANTS: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length)
                    section[key] = {Units: m[1].trim(), 
                                    Cppt: parseFloat(m[2]), 
                                    Cgw: parseFloat(m[3]), 
                                    Crdii: parseFloat(m[4]), 
                                    Kdecay: parseFloat(m[5]), 
                                    SnowOnly: m[6].trim(), 
                                    CoPollutant: m[7].trim(), 
                                    CoFrac: parseFloat(m[8]), 
                                    Cdwf: parseFloat(m[9]),  
                                    Cinit: parseFloat(m[10])};
        },
        LANDUSES: function(section, key, line) {
            var m = [];
            line = key + line;
            m.push(line)
            m.push(line.slice(17,28))
            m.push(line.slice(28,39))
            m.push(line.slice(39,line.length))
            if (m && m.length)
                    section[key] = {Interval: m[1].trim(), Available: m[2].trim(), Cleaned: m[3].trim()};
        },
        BUILDUP: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length){
                let thisObj = { LandUse: m[1], 
                                Pollutant: m[2]
                }
                if(m.length > 3){thisObj.Function = m[3];}
                else {thisObj.Function = null;}
                if(thisObj.Function === BuildupTypeWords[0] || thisObj.Function === null) { // NONE
                    thisObj.Coeff1     = null;
                    thisObj.Coeff2     = null;
                    thisObj.Coeff3     = null;
                    thisObj.Normalizer = null;
                }
                if(thisObj.Function === BuildupTypeWords[1]) { // POW
                    thisObj.Coeff1     = parseFloat(m[4]);
                    thisObj.Coeff2     = parseFloat(m[5]);
                    thisObj.Coeff3     = parseFloat(m[6]);
                    thisObj.Normalizer = m[7];
                }
                if(thisObj.Function === BuildupTypeWords[2]) { // EXP
                    thisObj.Coeff1     = parseFloat(m[4]);
                    thisObj.Coeff2     = parseFloat(m[5]);
                    thisObj.Coeff3     = parseFloat(m[6]);
                    thisObj.Normalizer = m[7];
                }
                if(thisObj.Function === BuildupTypeWords[3]) { // SAT
                    thisObj.Coeff1     = parseFloat(m[4]);
                    thisObj.Coeff2     = parseFloat(m[5]);
                    thisObj.Coeff3     = parseFloat(m[6]);
                    thisObj.Normalizer = m[7];
                }
                if(thisObj.Function === BuildupTypeWords[4]) { // EXT
                    thisObj.Coeff1     = null;
                    thisObj.Coeff2     = null;
                    thisObj.Coeff3     = null;
                    thisObj.Normalizer = m[7];
                }
            }
        },  
        WASHOFF: function(section, key, line) {
            var m = [];
            line = key + line;
            m.push(line)
            m.push(line.slice(0, 17))
            m.push(line.slice(17,34))
            m.push(line.slice(34,45))
            m.push(line.slice(45,56))
            m.push(line.slice(56,67))
            m.push(line.slice(67,78))
            m.push(line.slice(78,line.length))
            if (m && m.length)
                    section[Object.keys(section).length] = {
                                    LandUse: m[1].trim(), 
                                    Pollutant: m[2].trim(), 
                                    Function: m[3].trim(),
                                    Coeff1: parseFloat(m[4]) || 0,
                                    Coeff2: parseFloat(m[5]) || 0,
                                    Ecleaning: parseFloat(m[6]) || 0,
                                    Ebmp: m[7].trim()};
        },  
        COVERAGES: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length)
                    section[key] = {LandUse: m[1].trim(), Percent: parseFloat(m[2])};
        },
        INFLOWS: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\s+/);
            if (m && m.length){
                section[Object.keys(section).length] = {
                    Node: key.trim(),
                    Parameter: m[1].trim(), 
                    TimeSeries: m[2].trim(),
                    Type: m[3] ? m[3].trim() : '',
                    UnitsFactor: m[4] ? parseFloat(m[4]) : 0,
                    ScaleFactor: m[5] ? parseFloat(m[5]) : 0,
                    Baseline: m[6] ? parseFloat(m[6]) : 0,
                    Pattern: m[7] ? m[7].trim() : ''
                };
            }
        }, 
        DWF: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {DWFText: key + line};
        },
        PATTERNS: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {PatternText: key + line};
        },
        RDII: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        },
        HYDROGRAPHS: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        },
        LOADINGS: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length)
                    section[key] = {Pollutant: m[1].trim(), InitLoad: parseFloat(m[2])};
        },  
        TREATMENT: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        },
        CURVES: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length === 4){
                section[Object.keys(section).length] = {
                                Name: key.trim(),
                                Type: m[1], 
                                XValue: parseFloat(m[2]),
                                YValue: parseFloat(m[3])};
            } else {
                section[Object.keys(section).length] = {
                                Name: key.trim(),
                                Type: null, 
                                XValue: parseFloat(m[1]),
                                YValue: parseFloat(m[2])};
            }
        },
        TIMESERIES: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/);
            if (m && m.length === 4){
                section[Object.keys(section).length] = {
                                TimeSeries: key.trim(),
                                Date: m[1].trim(), 
                                Time: m[2].trim(),
                                Value: parseFloat(m[3])};
            } else {
                section[Object.keys(section).length] = {
                                TimeSeries: key.trim(),
                                Date: '', 
                                Time: m[1].trim(),
                                Value: parseFloat(m[2])};
            }
        },  
        CONTROLS: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {ControlText: key + line};
        },
        REPORT: function(section, key, line) {
            var m = line.match(/\s+([//\-:a-zA-Z0-9\.]+)/);
            if (m && m.length)
                section[key] = {Value: m[1]};
        },
        MAP: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        },
        COORDINATES: function(section, key, line) {
            line = (key + line).trim();
            let m = line.split(/\b\s+/)
            if (m && m.length)
                section[key] = {x: parseFloat(m[1]), y: parseFloat(m[2])};
        },
        VERTICES: function(section, key, line) {
            line = key + line;
            let m = line.split(/\b\s+/)
            let v = section[key] || [],
            c = {};
            if (m && m.length) {
                c.x = parseFloat(m[1]);
                c.y = parseFloat(m[2]);
            }
            v[v.length] = c;
            section[key] = v;
        },
        Polygons: function(section, key, line) {
            line = key + line;
            m = line.split(/\b\s+/)
            if (!section[key]) 
                section[key] = [];
                
            if (Object.keys(section[key]).length === 0)
                section[key] = [];

            if (m && m.length) {
                var coord = {x: parseFloat(m[1]), y: parseFloat(m[2])};
                section[key].push(coord);
            }
        },
        SYMBOLS: function(section, key, line) {
            line = key + line;
            let m = line.split(/\b\s+/)
            if (m && m.length)
                    section[key] = {XCoord: parseFloat(m[1]), 
                                    YCoord: parseFloat(m[2])};
        },  
        LABELS: function(section, key, line) {
            var m = line.match(/\s+([-?[0-9\.]+)\s+"([^"]+)"/);
            if (m && m.length && 3 === m.length)
                section[Object.keys(section).length] = {x: parseFloat(key), y: parseFloat(m[1]), label: m[2]};
        },
        BACKDROP: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        }, 
        TAGS: function(section, key, line) {
            line = key + line;
            let m = line.split(/\b\s+/)
            if (m && m.length)
            section.push({
                            Type: m[0].trim(), 
                            ID: m[1].trim(), 
                            Tag: m[2].trim()});
        },
        PROFILE: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        }, 
        FILE: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        },
        LID_CONTROLS: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        }, 
        LID_USAGE: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        }, 
        EVENT: function(section, key, line) {
            var m = line.match(/(.*)+/);
            if (m && m.length > 1)
                section[Object.keys(section).length] = {Value: key + line};
        },
    },

    model = {   // Input file model variables. Related to a header in .inp file.
                TITLE: [],              OPTIONS: [],            RAINGAGES: [],
                TEMPERATURE: {},        EVAPORATION: [],        
                SUBCATCHMENTS: [],      SUBAREAS: [],           INFILTRATION: [],
                AQUIFERS: [],           GROUNDWATER: [],        
                SNOWPACKS: [],          JUNCTIONS: [],          OUTFALLS: [],
                STORAGE: [],            DIVIDERS: [],           CONDUITS: [],
                PUMPS: [],              ORIFICES: [],           WEIRS: [],
                OUTLETS: [],            XSECTIONS: [],          TRANSECTS: [],
                LOSSES: [],             POLLUTANTS: [],         LANDUSES: [],
                BUILDUP: [],            WASHOFF: [],            COVERAGES: [],
                INFLOWS: [],            DWF: [],                PATTERNS: [],
                RDII: [],               HYDROGRAPHS: [],        LOADINGS: [],
                TREATMENT: [],          CURVES: [],             TIMESERIES: [],
                CONTROLS: [],           REPORT: [],             MAP: [],
                COORDINATES: [],        VERTICES: [],           Polygons: [],
                SYMBOLS: [],            LABELS: [],             BACKDROP: [],
                TAGS: [],               PROFILE: [],            FILE: [],
                LID_CONTROLS: [],       LID_USAGE: [],          EVENT: [],

                // Interface model variables
                clickEffect: 'edit'},
    lines = text.split(/\r\n|\r|\n/),
    section = null;
    
    // Open the files and translate to a model.
    //let JSONpointer = inpToJSON();

    /*let n = 999999;
    let js_array = Module.HEAPU8.subarray(JSONpointer, JSONpointer + n)
    let JX_string = new TextDecoder().decode(js_array)
    JX_string = JX_string.slice(0, JX_string.indexOf('\0') );
    let JX = [];
    try{
        JX = $.parseJSON(JX_string);
    } catch(e){
        alert(e);
    }*/

    ///////////////////////////////////////////////////////
    // raw swmm-js translations
    ///////////////////////////////////////////////////////
    

    // Get base data (time patterns, time series, etc) first
    /*JX.Pattern.forEach(function(el){
        model['PATTERNS'].push({ID: el.ID, count: el.count, factor: el.factor, type: el.type})
    })*/

    /*JX.Tseries.forEach(function(el){
        el.Table.forEach(function(en){
            model['TIMESERIES'].push({
                TimeSeries: el.ID, 
                Date: translateDate(en.x), 
                Time: extractTimeFromDate(en.x), 
                Value: en.y, 
                curveType: el.curveType, 
                file: {mode: el.file.mode, file: el.file.file}, 
                refersTo: el.refersTo,
                dxMin: el.dxMin,
                lastDate: el.lastDate})
        })
    })*/
    
    //  [RAINGAGES]
    //
    /*JX.Gage.forEach(function(el){
        model['RAINGAGES'][el.ID.toString()] = {
            Description: '', 
            Format: RainTypeWords[el.rainType],   // intensity, volume, cumulative
            Interval: el.rainInterval,            // recording time interval (seconds)
            SCF: el.snowFactor,                   // snow catch deficiency correction
            Source: GageDataWords[el.dataSource], // data from time series or file 
            SeriesName:  JX.Tseries[el.tSeries].ID,  // rainfall data time series name
            fname: el.fname,                      // name of rainfall data file
            staID: el.staID,                      // station number
            rainUnits: el.rainUnits,              // rain depth units (US or SI)
            coGage: el.coGage                     // index of gage with same rain timeseries
        };
    })*/
    
    //  [SUBCATCHMENTS]
    //
    /*JX.Subcatch.forEach(function(el){
        model['SUBCATCHMENTS'][el.ID.toString()] = {
            Description: '', 
            RainGage: JX.Gage[el.gage].ID,
            Outlet: JX.Node[el.outNode].ID, 
            //Area: parseFloat(el.area) * UCF(LANDAREA),
            PctImperv: el.fracImperv * 100,
            //Width: parseFloat(el.width) * UCF(LENGTH),
            PctSlope: el.slope,
            CurbLen: el.curbLength,
            SnowPack: ''
        };
    })*/

    // [OUTFALLS]
    /*JX.Outfall.forEach(function(el, index){
        let thisID = JX.Node.filter(obj => { return obj.type === OUTFALL && obj.subIndex === index; })[0].ID;
        model['OUTFALLS'][thisID] = {
            Invert: JX.Node.filter(obj => { return obj.ID === thisID; })[0].invertElev,
            Type: OutfallTypeWords[el.type],
            StageData: null,
            Gated: NoYesWords[el.hasFlapGate]
        };
    })*/

    //////////////////////////////////////////////////////////
    // wasm swmm-js translations
    //////////////////////////////////////////////////////////

    let curDesc = '';
    lines.forEach(function(line) {
        // If the entry is a comment, then attempt to assign it as the description for the current
        // object, or return nothing.
        if (regex.comment.test(line)) {
            curDesc = '';
            return;
        }
        else if (regex.description.test(line)) {
            // Get the comment without the semicolon
            curDesc = line.slice(1, line.length);

        } else if (regex.section.test(line)) {
            var s = line.match(regex.section);
            // If the section has not yet been created, create one.
            if ('undefined' === typeof model[s[1]])
                model[s[1]] = [];
            section = s[1];
        } else if (regex.value.test(line)) {
            // Remove everything after the first semicolon:
            line = line.split(';')[0];
            var v = line.match(regex.value);
            if (parser[section])
                parser[section](model[section], v[1], v[2], curDesc);
            else
                model[section][v[1]] = v[2];
            curDesc = '';
        };
    });
    
    // Set REPORT.elements = 'ALL' in case report does not include them
    if(!model['REPORT']) {model['REPORT'] =  []}
    if(!model['REPORT']['SUBCATCHMENTS']) {model['REPORT'].SUBCATCHMENTS = {Value: 'ALL'};}
    if(!model['REPORT']['NODES']) {model['REPORT'].NODES = {Value: 'ALL'};}
    if(!model['REPORT']['LINKS']) {model['REPORT'].LINKS = {Value: 'ALL'};}

    return model;
};
