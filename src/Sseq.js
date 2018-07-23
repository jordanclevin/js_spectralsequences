"use strict";

let DisplaySseq = require("./DisplaySseq.js").DisplaySseq;
let Shapes = require("./Shape.js");
let SseqClassjs = require("./SseqClass.js");
let SseqClass = SseqClassjs.SseqClass;
let Node = SseqClassjs.Node;
let Edges = require("./Edges.js");
let Edge = Edges.Edge;
let Structline = Edges.Structline;
let Extension = Edges.Extension;
let Differential = Edges.Differential;
let monomial_basisjs = require("./monomial_basis.js");
let monomial_basis = monomial_basisjs.monomial_basis;
let slice_basis = monomial_basisjs.slice_basis;
let Util = require("./Util.js");
let infinity = Util.infinity;

exports.DisplaySseq = DisplaySseq;
exports.SseqClass = SseqClass;
exports.Node = Node;
exports.Edge = Edge;
exports.Differential = Differential
exports.Structline = Structline;
exports.Extension = Extension;
exports.monomialString = monomial_basisjs.monomialString;
exports.range = monomial_basisjs.range;
exports.StringifyingMap = monomial_basisjs.StringifyingMap;
exports.product = monomial_basisjs.product;
exports.vectorSum = monomial_basisjs.vectorSum;
exports.vectorScale = monomial_basisjs.vectorScale;
exports.vectorLinearCombination = monomial_basisjs.vectorLinearCombination;



let StringifyingMap = require("./StringifyingMap.js");



/**
 * Calculate the dot product of two vectors of the same length
 * @param {Array|int} k
 * @param {Array|int} l
 * @returns {int} the dot product of k and l.
 */
function dot_product(k,l){
    let s = 0;
    for(let i=0; i<k.length; i++){
        s += k[i] * l[i];
    }
    return s;
}


/**
 * Adds an entry to a map keys ==> lists.
 * If the current key isn't present in the map, add an empty list first.
 * @param dictionary The dictionary of lists to add the entry to
 * @param key
 * @param value
 */
function addToDictionaryOfLists(dictionary, key,value){
    if(!dictionary.has(key)){
        dictionary.set(key, []);
    }
    dictionary.get(key).push(value);
}




class Sseq {
    /**
     * Make a spectral sequence object.
     * Key properties:
     *
     */
    constructor(){
        this.display_sseq = new DisplaySseq();
        this.display_class_to_real_class = new StringifyingMap((c) => `${c.x}, ${c.y}, ${c.idx}`);
        this.display_edge_to_real_edge = new StringifyingMap((e) =>
            `${e.type}(${e.page}) : (${e.source.x}, ${e.source.y}, ${e.source.idx}) => (${e.target.x}, ${e.target.y}, ${e.target.idx})`
        );
        this.total_classes = 0;
        this.classes_by_degree = new StringifyingMap();
        this.num_classes_by_degree = new StringifyingMap();
        this.classes_by_stem = new Map();
        this.classes = [];
        this.structlines = [];
        this.differentials = [];
        this.edges = [];
        this.display_classes = [];        
        this.display_structlines = [];
        this.display_differentials = [];
        this.xshift = 0;
        this.yshift = 0;        
        this.offset_size = 0.3;
        this.class_scale = 1;
        this.min_page_idx = 0;
        this.page_list = [0,infinity];
        this.default_node = new Node();
        this.default_node.fill = true;
        this.default_node.stroke = true;
        this.default_node.shape = Shapes.circle;
        this.default_node.size = 6;
        this.projection = function(ssclass){
            return [ssclass.degree.x, ssclass.degree.y];
        }
    }

    set_shift(x, y){
        this.xshift = x;
        this.yshift = y;
        return this;
   }

   add_to_shift(x, y){
        this.xshift += x;
        this.yshift += y;
        return this;
   }

    onClassAdded(f){
        this.on_class_added = f;
        return this;
    }

    onEdgeAdded(f){
        this.on_edge_added = f;
        return this;
    }

    onDifferentialAdded(f){
        this.on_differential_added = f;
        return this;
    }

    onStructlineAdded(f){
        this.on_structline_added = f;
        return this;
    }

    onExtensionAdded(f){
        this.on_extension_added = f;
        return this;
    }

    onDraw(f){
        this.on_draw = f;
    }


    /**
     * Add a class in position (x,y) and return the class. Uses sseq.default_node for display.
     *
     * @param x The x position
     * @param y
     * @returns {SseqClass} The new class
     */
    addClass(x, y){
        let degree;
        if(y === undefined){
            degree = x;
        } else {
            x = x + this.xshift;
            y = y + this.yshift;
            degree = {x: x, y: y};
        }
        let c = new SseqClass(this, degree);
        let idx  = this.num_classes_by_degree.getOrElse([c.x, c.y], 0);
        this.num_classes_by_degree.set([c.x, c.y], idx + 1);
        c.idx = idx;
        c.class_list_index = this.classes.length;
        this.classes.push(c);
        addToDictionaryOfLists(this.classes_by_degree, degree, c);
        addToDictionaryOfLists(this.classes_by_stem, c.x , c);
        this.total_classes ++;

        if(this.on_class_added){
            this.on_class_added(c);
        }
        this.updateClass(c);
        return c;
    }


    /**
     * Adds a structline from source to target.
     * @param source
     * @param target
     * @returns {Structline} the structline object
     */
    addStructline(source, target){
//        if(source == undefined){
//            source = this.last_classes[0]
//            target = this.last_classes[1]
//        } else if(target == undefined){
//            target = this.last_classes[0]
//        }
        if(!source || !target){
            return Structline.getDummy();
        }
        let struct = new Structline(source,target);
        source._addStructline(struct);
        target._addStructline(struct);
        this.structlines.push(struct);
        struct.edge_list_index = this.edges.length;
        this.edges.push(struct);
        if(this.on_edge_added){
            this.on_edge_added(struct);
        }
        if(this.on_structline_added){
            this.on_structline_added(struct);
        }
        this.updateEdge(struct);
        return struct;
    }

    /**
     * Adds a differential.
     * @param source
     * @param target
     * @param page
     * @returns {Differential}
     */
   addDifferential(source, target, page){
       if(typeof source === "number"){
           console.log("addDifferential a SseqClass in position 1, got a number. Probably the arguments are in the wrong order.")
           return Differential.getDummy();
       }
       if(source.constructor != SseqClass.constructor){
           let err = new Error("addDifferential expected a SseqClass in position 1.");
           console.log(err);
           //return Differential.getDummy();
       }
        if(target.constructor != SseqClass.constructor){
            console.log("addDifferential expected a SseqClass in position 2.")
            console.log(target);
            return Differential.getDummy();
        }
        if(page <= 0){
            console.log("No page <= 0 differentials allowed.");
            return Differential.getDummy();
        }
        if(!source || !target){
            return Differential.getDummy();
        }
        let differential = new Differential(source, target, page);
        source._addOutgoingDifferential(differential);
        target._addIncomingDifferential(differential);
        differential.edge_list_index = this.edges.length;
        this.differentials.push(differential);
        this.edges.push(differential);
        this.addPageToPageList(page);
        if(this.on_edge_added){
            this.on_edge_added(differential);
        }
        if(this.on_differential_added){
            this.on_differential_added(differential);
        }
        this.updateEdge(differential);
        return differential;
    }

    /**
     * Adds an extension.
     * @param source
     * @param target
     * @returns {Extension}
     */
   addExtension(source, target){
        if(!source || !target){
            return Extension.getDummy();
        }
        let ext = new Extension(source, target);
        ext.edge_list_index = this.edges.length;
        this.edges.push(ext);
        if(this.on_edge_added){
            this.on_edge_added(ext);
        }
        if(this.on_extension_added){
            this.on_extension_added(ext);
        }
        this.updateEdge(ext);
        return ext;
    }

    /**
     * For display purposes, a Sseq object maintains a list of pages on which something changes in the spectral sequence.
     * Currently this list always contains 0, infinity, and the set of pages on which differentials live.
     * @param page
     * @returns {Sseq} chainable
     */
   addPageToPageList(page){
        for(let i = 0; i < this.page_list.length; i++){
            let compare_page;
            if(Array.isArray(this.page_list[i])){
                compare_page = this.page_list[i][0];
            } else {
                compare_page = this.page_list[i];
            }
            if(compare_page > page){
                this.page_list.splice(i, 0, page);
            }
            if(compare_page >= page && !Array.isArray(this.page_list[i])){
                return this;
            }
        }
   }

    addPageRangeToPageList(pageRange){
        let page = pageRange[0];
        for(let i = 0; i < this.page_list.length; i++){
            let compare_page;
            if(Array.isArray(this.page_list[i])){
                compare_page = this.page_list[i][0];
            } else {
                compare_page = this.page_list[i];
            }
            if(compare_page > page){
                this.page_list.splice(i, 0, pageRange);
                return this;
            } else if(compare_page == page){
                if(!Array.isArray(this.page_list[i])){
                    this.page_list.splice(i, 0, pageRange);
                } else {
                    if(this.page_list[i][1] > pageRange[1]){
                        this.page_list.splice(i, 0, pageRange);
                        return this;
                    } else if(this.page_list[i][1] == pageRange[1]){
                        return this;
                    }
                }
            }
        }
    }


    /**
     *
     * @param var_degree_dict -- Object with bidegrees of the generators, of the form `"var_name" : [stem, filtration]`
     * @param var_spec_list -- List of range specifications. Each range specification is a list of the form
     *  `["var_name", min, max, step]` where `min` defaults to 0 and `step` defaults to 1.
     * @param cond
     * @returns {monomial_basis} A monomial_basis object containing the set of classes so generated.
     */
   addPolynomialClasses(var_degree_dict, var_spec_list, module_generators = {"" : [0,0] }){
        if(!Array.isArray(var_spec_list)){
            throw "Second argument of addPolynomialClasses should be an array"
        }

       return new monomial_basis(this, var_degree_dict, var_spec_list, module_generators);
   }

    addSliceClasses(var_degree_dict, var_spec_list, make_slice){
        if(!Array.isArray(var_spec_list)){
            throw "Second argument of addPolynomialClasses should be an array"
        }

        return new slice_basis(this, var_degree_dict, var_spec_list, make_slice);
    }


    getSurvivingClasses(page){
       if(page===undefined){
           page = infinity - 1;
       }
        return this.classes.filter((c) => c.page_list[c.page_list.length-1] >= page);
    }



    /* For display: */


    /**
     * Get tooltip.
     * @returns {string}
     */
    getTooltip(c){
        let tooltip = "";
        if(c.name !== ""){
            tooltip = `\\(${c.name}\\) &mdash; `;
        }
        tooltip += `(${c.x}, ${c.y})`;
        tooltip += c.extra_info;
        return tooltip;
    }


    updateClass(c){
        let display_class = Util.getObjectWithFields(c,
            [
                "x", "y", "idx", "x_offset", "y_offset",
                "name", "extra_info", "page_list", "node_list",
                "visible",
                "_inRangeQ", "_drawOnPageQ"
            ]
        );
        c.display_class = display_class;
        this.display_sseq.classes[c.class_list_index] = display_class;
        for(let edge of c.edges){
            if(edge.source === c){
                edge.display_edge.source = display_class;
            } else {
                edge.display_edge.target = display_class;
            }
        }
        this.display_class_to_real_class.set(display_class, c);
        this.display_sseq.update();
    }

    updateEdge(edge){
        let display_edge = Util.getObjectWithFields(edge,
            [
                "page", "page_min", "color", "source_name", "target_name",
                "_drawOnPageQ"
            ]
        );
        display_edge.source = edge.source.display_class;
        display_edge.target = edge.target.display_class;
        display_edge.type = edge.constructor.name;
        this.display_sseq.edges[edge.edge_list_index] = display_edge;
        this.display_edge_to_real_edge.set(display_edge, edge);
        edge.display_edge = display_edge;
        this.display_sseq.update();
    }

    static getSseqFromDisplay(dss){
        let sseq = new Sseq();
        sseq.display_sseq = dss;
        dss.real_sseq = sseq;
        Object.assign(sseq, dss);
        sseq.num_classes_by_degree = new StringifyingMap();
        sseq.classes = [];
        sseq.edges = [];
        sseq.display_class_to_real_class = new StringifyingMap((c) => `${c.x}, ${c.y}, ${c.idx}`);

        let classes = dss.classes;
        let edges = dss.edges;

        let temp_display_class_to_real_class = new StringifyingMap((c) => `${c.x}, ${c.y}, ${c.idx}`);

        for(let display_class of classes){
            if(!display_class){
                continue;
            }
            let real_class = sseq.addClass(display_class.x,display_class.y);
            let idx = real_class.idx;
            Object.assign(real_class,display_class);
            real_class.constructor = SseqClass.constructor;
            temp_display_class_to_real_class.set(display_class, real_class);
            sseq.updateClass(real_class);
        }

        for(let e of edges){
            if(!e){
                continue;
            }
            let en;
            let source = temp_display_class_to_real_class.get(e.source);
            let target = temp_display_class_to_real_class.get(e.target);
            switch(e.type){
                case "Differential" :
                    en = sseq.addDifferential(source, target, e.page);
                    break
                case "Structline" :
                default:
                    en = sseq.addStructline(source, target);
            }
            Object.assign(en, e);
            en.source = source;
            en.target = target;
            sseq.updateEdge(en);
        }
        return sseq;
    }

    getDisplaySseq(){
        let dss = this.display_sseq;
        dss.min_page_idx = this.min_page_idx;
        dss.initial_page_idx = this.initial_page_idx;
        dss.page_list = this.page_list;
        dss.initialxRange = this.initialxRange;
        dss.initialyRange = this.initialyRange;
        dss.xRange = this.xRange;
        dss.yRange = this.yRange;
        dss.on_draw = this.on_draw;
        dss.class_scale = this.class_scale;
        dss.num_classes_by_degree = this.num_classes_by_degree;

        if(this._getXOffset){
            dss._getXOffset = this._getXOffset;
        }
        if(this._getYOffset){
            dss._getYOffset = this._getYOffset;
        }
        if(this.offset_size){
            dss.offset_size = this.offset_size;
        }
        if(this.onmouseoverClass){
            dss.onmouseoverClass = this.onmouseoverClass;
        }

        return dss;
    }

    display(){
        this.getDisplaySseq().display();
    }
}



exports.Sseq = Sseq;
//window.SseqNode = Node;

