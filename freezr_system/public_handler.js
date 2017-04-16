// freezr.info - nodejs system files - public_handler.js
exports.version = "0.0.1";

var helpers = require('./helpers.js'),
    freezr_db = require("./freezr_db.js"),
    async = require('async'),
    file_handler = require('./file_handler.js');

const ALL_APPS_CONFIG = { // html and configuration for generic public pages
        'meta': {
            'app_display_name':"freezr - All public cards",
            'app_version': "0.0.1"
        },
        'public_pages' : {
            "allPublicRecords" : {
                'html_file':"allpublicrecords.html",
                'css_files': ["allpublicrecords.css"],
                'script_files': ["allpublicrecords.js"]
            }
        }
    }
    genericHTMLforRecord = function(record) {         
        var text = "<div class='freezr_public_genericCardOuter freezr_public_genericCardOuter_overflower'>" 
        text+= '<div class="freezr_public_app_title">'+record._app_name+"</div>";
        text += "<table>"     
        for (var key in record) {
            if (Object.prototype.hasOwnProperty.call(record, key)) {
                text+= "<tr style='width:100%; font-size:12px; overflow:normal'><td style='width:100px'>"+key +": </td><td>"+((typeof record[key] ==="string")? record[key] : JSON.stringify(record[key]) )+"</td></tr>"   
            };
        }
        text+="</table>"
        text+="</div>"
        return text;
    }

exports.generatePublicPage = function (req, res) { 
    //    app.get('/pcard/:user_id/:app_name/:collection_name/:data_object_id'    
    //    app.get('/pcard/:user_id/:requestor_app/:permission_name/:app_name/:collection_name/:data_object_id', addVersionNumber, public_handler.generatePublicPage); 
    //    app.get('/v1/pobject/:user_id/:app_name/:collection_name/:data_object_id', public_handler.generatePublicPage); // collection_name is files 
            // Note: for pcard, app_name is requestee_app
    /* todo or separate into another function 
        // app.get('/v1/pfile/:user_id/:app_name/*', public_handler.getPublicDataObject); // collection_name is files 
        var isfile = helpers.startsWith(req.path,"/v1/pfile/");
         if (isfile) {req.params.collection_name = "files"; objectOnly=true;}
         */
    
    //    app.get('/ppage/:app_name/:page', addVersionNumber, public_handler.generatePublicPage); 
    //    app.get('/ppage/:app_name', addVersionNumber, public_handler.generatePublicPage); 
    //    app.get('/ppage', addVersionNumber, public_handler.generatePublicPage); 
    console.log("generating public page ",req.url," with query ",req.query);
   
    var isCard    = helpers.startsWith(req.path,"/pcard");
    var objectOnly= helpers.startsWith(req.path,"/v1/pobject/");
    var allApps   = (!isCard && !req.params.app_name);
    var app_name  = allApps? "info.freezr.public" : req.params.app_name;
    var useGenericFreezrPage = allApps;

    var app_config  = allApps? ALL_APPS_CONFIG : file_handler.get_app_config(app_name);

    var page_name; page_params = {};

    if (!app_config ){
        helpers.send_failure("public_handler", exports.version, "generatePublicPage", null, "app config missing while accessing public "+ (isCard?"card.":"page."));
        // permissions for public access re given in the app_config so no app config means no pubic records
    } else {
        page_name   = req.params.page;
        if (!page_name || !app_config.public_pages[page_name]) page_name = firstElementKey(app_config.public_pages);
        if (!page_name || !app_config.public_pages[page_name] || !app_config.public_pages[page_name].html_file) {
            useGenericFreezrPage = true;
            page_params = ALL_APPS_CONFIG.public_pages.allPublicRecords
        } else {
            if (helpers.endsWith(page_name, '.html')) page_name = page_name.slice(0,-5);
            page_params = app_config.public_pages[page_name];
        }
        if (!isCard && !objectOnly) {
            var options = {
                page_url: page_params.html_file,
                page_title: (page_params.page_title? page_params.page_title:"Public info")+" - freezr.info",
                css_files: [], // page_params.css_files,
                initial_data: page_params.initial_data? page_params.initial_data: {},
                script_files: [], //, //[],
                app_name: app_name,
                app_display_name : (allApps? "All Freezr Apps" : ( (app_config && app_config.meta && app_config.meta.app_display_name)? app_config.meta.app_display_name:app_name) ),
                app_version: (app_config && app_config.meta && app_config.meta.app_version && !allApps)? app_config.meta.app_version:"N/A",
                freezr_server_version: req.freezr_server_version,
                other_variables: null,
                server_name: req.protocol+"://"+req.get('host'),

                // extra items
                page_name: page_name,
                isPublic: true,
                allApps: allApps,
                useGenericFreezrPage: useGenericFreezrPage   
            }     
            
            if (req.query) {
                for (param in req.query) {if (Object.prototype.hasOwnProperty.call(req.query, param)) {
                    if (['skip','count'].indexOf(param)>-1) {
                        options.initial_data[param] = req.query[param];
                    } else if (['q','search'].indexOf(param)>-1) {
                        options.initial_data.search = req.query[param]; 
                    } else if (['app','app_name'].indexOf(param)>-1) {
                        options.initial_data.app_name = req.query[param]; 
                    } else if (['user','_creator','user_id'].indexOf(param)>-1) {
                        options.initial_data._creator = req.query[param]; 
                    } 
                    // todo - expand search query paramaters to the data_object
                }}
            } 

            var outside_scripts = [];
            if (page_params.script_files) {
                if (typeof page_params.script_files == "string") page_params.script_files = [page_params.script_files];
                page_params.script_files.forEach(function(js_file) {
                    if (helpers.startsWith(js_file,"http")) {
                        outside_scripts.push(js_file)
                    } else if (helpers.startsWith(js_file,"/") || helpers.startsWith(js_file,".")) {
                        helpers.app_data_error(exports.version, "generatePage", req.params.app_name, "Cannot have script files referring to other folders")
                    } else {
                        if (file_handler.fileExt(js_file) == 'js'){
                            options.script_files.push("public/"+js_file);
                        } else {
                            helpers.app_data_error(exports.version, "generatePage", req.params.app_name, "Cannot have non js file used as js.")
                        }
                    }
                });
            }
            if (page_params.css_files) {
                if (typeof page_params.css_files == "string") page_params.css_files = [page_params.css_files];
                page_params.css_files.forEach(function(css_file) {
                    if (helpers.startsWith(css_file,"http")) {
                        helpers.app_data_error(exports.version, "generatePage", req.params.app_name, "Cannot have css files referring to other hosts")
                    } else if (helpers.startsWith(css_file,"/") || helpers.startsWith(css_file,".")) {
                        helpers.app_data_error(exports.version, "generatePage", req.params.app_name, "Cannot have css files referring to other folders")
                    } else {
                        if (file_handler.fileExt(css_file) == 'css'){
                            options.css_files.push("public/"+css_file);
                        } else {
                            helpers.app_data_error(exports.version, "generatePage", req.params.app_name, "Cannot have non css file used as css :"+css_files)
                        }
                    }
                });
            }
            if (outside_scripts.length>0) {
                freezr_db.all_userAppPermissions(req.session.logged_in_user_id, req.params.app_name, function(err, perm_list, cb) {
                    if (err) {
                        helpers.send_internal_err_page(res, "app_handler", exports.version, "generatePage", "Could not get user app  permissions");
                    } else {
                        if (perm_list.length>0) {
                            outside_scripts.forEach(function(script_requested) {
                                for (var i=0; i<perm_list.length; i++) {
                                    var perm_obj = perm_list[i];
                                    if (perm_obj.script_url && perm_obj.script_url == script_requested && perm_obj.granted && !perm_obj.denied) {
                                        options.script_files.push(perm_obj.script_url);
                                        break;
                                    }
                                }
                            });
                        }  
                        gotoShowInitialData(res, options);
                    }
                })
            } else {
                gotoShowInitialData(res, options);
            }
        } else { // isCard or one objectOnly
            req.freezrInternalCallFwd = function(err, results) {
                var contents;
                if (err) { 
                    if (objectOnly) {
                        helpers.send_failure(res, err, "public_handler", exports.version, "generatePublicPage");
                    } else {
                        contents = "error getting data "+JSON.stringify(err)
                        res.writeHead(200, { "Content-Type": "text/html" });
                        res.end(contents);
                    }
                 } else {
                    var record, html_file;
                    if (!results || !results.results || results.results.length==0) {
                        record = {}; 
                        record[app_name]="No records found."
                        html_file = ALL_APPS_CONFIG.public_pages.allPublicRecords.html_file;
                    } else {
                        record = formatDates(results.results[0]);
                        html_file = (app_config && app_config.permissions && app_config.permissions[record._permission_name] && app_config.permissions[record._permission_name].card)? app_config.permissions[record._permission_name].card : null;
                    }
                    if (objectOnly) {
                        helpers.send_success(res, {'results':record});
                    } else if (html_file && file_handler.appFileExists(app_name,"public/"+html_file) ) {
                        var Mustache = require('mustache');
                        // todo add option to wrap card in html header
                        file_handler.readAppFile(file_handler.removeStartAndEndSlashes(file_handler.partPathToAppFiles(app_name,"public/"+html_file)), (err, html_content) => {
                            if (err) {
                                helpers.send_failure(res, helpers.error("file missing","html file missing - cannot generate card without a card html ("+page_name+")in app:"+app_name+"."), "public_handler", exports.version, "generatePublicPage" )
                            } else {
                                contents = Mustache.render(html_content, record);
                                res.writeHead(200, { "Content-Type": "text/html" });
                                res.end(contents);
                            }
                        });
                    } else {
                        contents = genericHTMLforRecord(record, false);
                        res.writeHead(200, { "Content-Type": "text/html" });
                        res.end(contents);
                    }
                }
            }
            req.body = {
                _app_name:req.params.app_name, 
                user_id:req.params.user_id,
                count: 1,
                skip: 0,
                query_params: {
                    collection_name: req.params.collection_name,
                    data_object_id: req.params.data_object_id
                }
            };
            exports.dbp_query(req,res);
        }
    }
};

gotoShowInitialData = function(res, options) {
    var req= {}
    if (!options) options = {};
    if (!options.initial_data) options.initial_data = {};
    var display_more=true;
    req.body = {app_name:options.initial_data.app_name, 
                user_id:options.initial_data._creator,
                count: options.initial_data.count || 20,
                skip: options.initial_data.skip || 0,
                query_params:options.initial_data.query_params || {},
                search: options.initial_data.search
    };

    if (!options.initial_data){
        file_handler.readAppFile(file_handler.removeStartAndEndSlashes(file_handler.partPathToAppFiles(options.app_name,"public/"+options.page_url)), (err, html_content) => {
            if (err) {
                helpers.send_failure(res, helpers.error("file missing","html file missing - cannot generate page without file page_url ("+options.page_url+")in app:"+options.app_name+" public folder (no data)."), "public_handler", exports.version, "gotoShowInitialData" )
            } else {
                options.page_html= html_content;
                file_handler.load_page_html(res,options)
            }
        });
    } else if (options.useGenericFreezrPage) {
        req.url = '/ppage';
        if (!options.allApps) req.body.app_name = options.app_name;
        req.freezrInternalCallFwd = function(err, results) {
            // get results from query and for each record, get the file and then merge the record 
                /* from setObjectAccess for permission_record
                    var unique_object_permission_attributes =
                        {   'requestor_app':req.params.requestor_app,
                            'requestee_app':requestee_app,
                            '_creator':req.session.logged_in_user_id,
                            'permission_name':req.params.permission_name,
                            'collection_name': collection_name,
                            'data_object_id': data_object_id,
                            'shared_with_group':new_shared_with_group
                            '_id':requestee_app+"_"+req.session.logged_in_user_id+"_"+data_object_id;
                        } nb also adds _app_name
                    */
            var records_stream=[]; 

            var app_cards = {}, html_file, html_content, app_config, app_configs= {}, logos= {};
            var Mustache = require('mustache');
            if (!results || !results.results || results.results.length == 0) {
                display_more = false;
            } else { // add card to each record (todo - this should be done in dbp_query as an option req.paras.addcard)
                display_more = results.results.length>=(req.body.count) // this can lead to a problem if a permission is not allowed - todo : in query send back record with a not_permitted flag
                results.results.forEach(function(permission_record) {
                    html_content=null; html_file=null;
                    if (!permission_record || !permission_record._app_name) { // (false) { //
                        console.log("Temporary error - no app_name for ",permission_record)
                    } else {
                        if (!app_cards[permission_record._app_name]) {
                            app_configs[permission_record._app_name]= file_handler.get_app_config(permission_record._app_name);
                            html_file = (app_configs[permission_record._app_name].permissions && app_configs[permission_record._app_name].permissions[permission_record._permission_name] && app_configs[permission_record._app_name].permissions[permission_record._permission_name].card);
                            
                            if (html_file && file_handler.appFileExists(permission_record._app_name,"public/"+html_file) ) {
                                app_cards[permission_record._app_name] = file_handler.readAppFileSyncParts(permission_record._app_name,"public/"+html_file)
                            } else {
                                app_cards[permission_record._app_name] = "NA"
                            }
                        }
                        permission_record = formatDates(permission_record, app_configs[permission_record._app_name])
                        if (app_cards[permission_record._app_name] && app_cards[permission_record._app_name] != "NA") {
                            try {
                                permission_record._card = Mustache.render(app_cards[permission_record._app_name], permission_record);
                            } catch (e) {
                                helpers.app_data_error(exports.version, "gotoShowInitialData", permission_record._app_name, "error rendering app data with card template "+e);
                                permission_record._card  = null;
                            }
                        } 
                        if (app_cards[permission_record._app_name] == "NA" || !permission_record._card) {
                            permission_record._card = genericHTMLforRecord(permission_record);
                        }
                        records_stream.push(permission_record);
                    }

                });
            }   
            // read the main html file and render the records stream
            file_handler.readAppFile(file_handler.removeStartAndEndSlashes(file_handler.partPathToAppFiles("info.freezr.public","public"+file_handler.sep()+options.page_url)), (err, html_content) => {
                if (err) {
                    helpers.send_failure(res, helpers.error("file missing","html file missing - cannot generate page without file page_url ("+options.page_url+")in app:"+options.app_name+" publc folder."), "public_handler", exports.version, "gotoShowInitialData" );
                } else {
                    current_search =  req.body.search && req.body.search.length>0? (req.body.search):"";
                    current_search += req.body.user_id && req.body.user_id.length>0? ( (current_search.length>0?"&":"") + "user:"+req.body.user_id):"";
                    current_search += req.body.app_name && req.body.app_name.length>0? ((current_search.length>0?"&":"") + "app:"+req.body.app_name):"";
                    search_url =  req.body.search && req.body.search.length>0? ("q="+req.body.search):"";
                    search_url += req.body.user_id && req.body.user_id.length>0? ((search_url.length>0?"&":"") + "user="+req.body.user_id):"";
                    search_url += req.body.app_name && req.body.app_name.length>0? ((search_url.length>0?"&":"") + "app="+req.body.app_name):"";
                    search_url += (search_url.length>0?"&":"") + "skip="+(parseInt(req.body.skip || 0) + parseInt(req.body.count || 0));

                    var page_components = {
                        skipped: parseInt(req.body.skip || 0),
                        counted: parseInt(req.body.count || 0),
                        display_more : (display_more?"block":"none"),
                        user_id: req.body.user_id? req.body.user_id: "",
                        app_name: (options.allApps? "": options.app_name),
                        records_stream: records_stream,
                        current_search: current_search,
                        search_url:search_url
                    }

                    options.page_html= Mustache.render(html_content, page_components);
                    file_handler.load_page_html(res,options)
                }               
            });
        }
        exports.dbp_query(req,res);
    } else { // Initial data capture (but not generic freezr page)
        req.url = options.initial_data.url;
        if (!options.allApps) req.body.app_name = options.app_name;
        req.freezrInternalCallFwd = function(err, results) {
            if (err) {
                helpers.send_failure(res, err, "public_handler", exports.version, "gotoShowInitialData" )
            } else {
                var Mustache = require('mustache');
                var app_config = file_handler.get_app_config(options.app_name)
                var html_file = (app_config && app_config.public_pages && app_config.public_pages[options.page_name] && app_config.public_pages[options.page_name].html_file)? app_config.public_pages[options.page_name].html_file: null;
                if (!html_file) {
                    helpers.send_failure(res, helpers.error("file missing","html file missing - cannot generate page without file page_url ("+html_file+")in app:"+options.app_name+" publc folder."), "public_handler", exports.version, "gotoShowInitialData" )
                } else {      
                    file_handler.readAppFile(file_handler.removeStartAndEndSlashes(file_handler.partPathToAppFiles(req.body.app_name,"public"+file_handler.sep()+html_file)), (err, html_content) => {
                        if (err) {
                            helpers.send_failure(res, helpers.error("file missing","html file missing - cannot generate page without file page_url ("+options.page_url+")in app:"+options.app_name+" publc folder."), "public_handler", exports.version, "gotoShowInitialData" )
                        } else {
                            options.page_html =  Mustache.render(html_content, results);
                            file_handler.load_page_html(res,options);
                        }
                    })
                }

            }
        }
        exports.dbp_query(req,res);
    }
}

// database operations
exports.dbp_query = function (req, res){
    //    app.get('/v1/pdbq', addVersionNumber, public_handler.dbp_query); 
    //    app.get('/v1/pdbq/:app_name', addVersionNumber, public_handler.dbp_query); 
    //    app.post('/v1/pdbq', addVersionNumber, public_handler.dbp_query); 
    //    exports.generatePublicPage directly && via gotoShowInitialData
    /* 
    options are, for get (ie req.params and req.query) and post (req.body): 
        - app_name
        - user_id
        - skip
        - count
        - query_params (for post only)
    */
    console.log("dbp_query body ",req.body, " params ",req.params)
    var data_records= [],
        errs = [],
        skip = (req.body && req.body.skip)? parseInt(req.body.skip): ( (req.query && req.query.skip)? parseInt(req.query.skip): 0 ), 
        count= (req.body && req.body.count)? parseInt(req.body.count): ( (req.query && req.query.count)? parseInt(req.query.count): 50 ),
        sort =  {'_date_Modified': -1}

    function app_err(message) {return helpers.app_data_error(exports.version, "dbp_query", "public query for "+(req.body.app_name || ((req.params && req.params.app_name)? req.params.app_name: null) || "all apps"), message);}
    function app_auth(message) {return helpers.auth_failure("public_handler", exports.version, "dbp_query", message);}

    async.waterfall([
        // 1. get permission collection
        function (cb) {
            freezr_db.app_db_collection_get("info_freezr_permissions" , "accessible_objects", cb);
        },

        // 2 get the permission
        function (theCollection, cb) {
            var permission_collection = theCollection;
            var permission_attributes = {
                granted: true,
                shared_with_group: 'public'
            };

            if (req.body && req.body.app_name) permission_attributes.requestee_app = req.body.app_name.toLowerCase();
            if (req.params && req.params.app_name) permission_attributes.requestee_app = req.params.app_name.toLowerCase();
            if (req.body && req.body.user_id ) permission_attributes._creator = req.body.user_id.toLowerCase();
            if (req.query && req.query.user_id ) permission_attributes._creator = req.query.user_id.toLowerCase();

            

            if (req.body.search) {
                req.body.search = decodeURIComponent(req.body.search).toLowerCase();
                if (req.body.search.indexOf(' ')<0) {
                    permission_attributes.search_words = req.body.search;
                    if (req.body.query_params) permission_attributes = {'$and':[permission_attributes,  req.body.query_params]}
                } else {
                    var theAnds = [permission_attributes];
                    //if (req.body.query_params) theAnds.push(req.body.query_params)
                    var searchterms = req.body.search.split(' ');
                    searchterms.forEach(function(aterm) {theAnds.push({'search_words':aterm})});
                    permission_attributes = {'$and':theAnds}
                }
            }

            //onsole.log("permission_attributes "+JSON.stringify(permission_attributes))

            permission_collection.find(permission_attributes)
                .sort(sort)
                .limit(count)
                .skip(skip)
                .toArray(cb);

        },
        // 3 see permission record and make sure it is still granted 
        function (results, cb) {
            //onsole.log("dbp_query of length "+results.length)
            if (!results || results.length==0) {
                cb(null);
            }  else {
                async.forEach(results, function (permission_record, cb2) {
                    recheckPermissionExists(permission_record, function (err, results) {
                        //onsole.log("permission_record id",permission_record._id)
                        if (err) {
                            errs.push({error:err, permission_record:permission_record._id})
                            cb2(null)
                        } else if (!permission_record.data_object){
                            errs.push({error:helpers.error("old data","no data-object associaetd with permsission"), permission_record:permission_record._id})
                            cb2(null)                            
                        } else if (!results.success){
                            errs.push({error:helpers.error("unkown-err", results), permission_record:permission_record._id})
                            cb2(null)                                                        
                        } else {
                            if (!permission_record.data_record) permission_record.data_record = {};
                            permission_record.data_object._app_name = permission_record.requestee_app;
                            permission_record.data_object._permission_name = permission_record.permission_name;
                            permission_record.data_object._collection_name = permission_record.collection_name;
                            permission_record.data_object._date_Modified = permission_record._date_Modified;
                            permission_record.data_object._date_Created = permission_record._date_Created;
                            permission_record.data_object._id = permission_record._id;
                            data_records.push (permission_record.data_object)
                            cb2(null)
                        }
                    });
                },
                function (err) {
                    if (err) {
                        errs.push({error:err, permission_record:null});
                    } 
                    cb(null)
                }
                );
            }
        }
    ], 
    function (err) {
        if (err) {
            helpers.send_failure(res, err, "public_handler", exports.version, "dbp_query");
        } else {
            var sortBylastModDate = function(obj1,obj2) { return obj2._date_Modified - obj1._date_Modified; }
            data_records = data_records.sort(sortBylastModDate)
            if (req.freezrInternalCallFwd) {
                if (errs && errs.length>0) console.log("end of query with "+data_records.length+" results and errs "+JSON.stringify(errs))
                req.freezrInternalCallFwd(null, {results:data_records, errors:errs, next_skip:(skip+count)});
            } else {
                helpers.send_success(res, {results:data_records, errors:errs, next_skip:(skip+count)});
            }
        }
    });
}


var recheckPermissionExists = function(permission_record, callback) {
    // todo - consider removing this in future - this is redundant if app_handler.setObjectAccess works correctly
    //onsole.log("recheckPermissionExists", permission_record)
    var app_config = file_handler.get_app_config(permission_record.requestee_app);
    var success = false;
    var permission_model= (app_config && app_config.permissions && app_config.permissions[permission_record.permission_name])? app_config.permissions[permission_record.permission_name]: null;
    if (!app_config){
        callback(helpers.app_data_error(exports.version, "recheckPermissionExists", permission_record.requestee_app, "missing or removed app_config"));
    } else if (!permission_model){
        callback(helpers.app_data_error(exports.version, "recheckPermissionExists", permission_record.requestee_app, "missing or removed app_config"));
    } else {
        async.waterfall([
            // 1. get app permissions and...
            function (cb) {
                freezr_db.permission_by_creator_and_permissionName (permission_record._creator, permission_record.requestor_app, permission_record.requestee_app, permission_record.permission_name, cb)
            },
                /* from setObjectAccess for permission_record
                var unique_object_permission_attributes =
                    {   'requestor_app':req.params.requestor_app,
                        'requestee_app':requestee_app,
                        '_creator':req.session.logged_in_user_id,
                        'permission_name':req.params.permission_name,
                        'collection_name': collection_name,
                        'data_object_id': data_object_id,
                        'shared_with_group':new_shared_with_group
                        '_id':requestee_app+"_"+req.session.logged_in_user_id+"_"+data_object_id;

                        also: data_object
                    }
                */
       
            // 2.  if granted, success
            function (results, cb) {
                if (!results || results.length==0) {
                    cb(app_auth("permission does not exist"));
                }  else if (!results.length>1) {
                    cb(app_auth("internal error - more than one permission retrieved."));
                }  else if (!results[0].granted) {
                    cb(app_auth("permission no longer granted."));
                } else {
                    success = true;
                    cb(null)
                }
            },
            ],
            function(err, results){
                if (err) {
                    helpers.app_data_error(exports.version, "recheckPermissionExists", permission_record.requestee_app, err)
                    callback(err, {'_id':permission_record.data_object_id, success:success})
                } else {
                    callback(null, {'_id':permission_record.data_object_id, success:success});
                }
            }
        )
    }
}

// ancillary functions and name checks
    function isEmpty(obj) {
      // stackoverflow.com/questions/4994201/is-object-empty
        if (obj == null) return true;
        if (obj.length > 0)    return false;
        if (obj.length === 0)  return true;
        for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) return false;
        }
        return true;
    }
    function firstElementKey(obj) {
        if (obj == null) return null;
        if (obj.length === 0)  return null;
        for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) return key;
            break;
        }
        return null;
    }

    var folder_name_from_id = function(the_user, the_id) {
        return the_id.replace((the_user+"_"),"");
    }
    var formatDates = function(permission_record, app_config) {
        //onsole.log("formatting dates for ",permission_record);
        var coreDateList = ['_date_Modified','_date_Created']
        coreDateList.forEach(function(name) {
            var aDate = new Date(permission_record[name])
            permission_record[name] = aDate.toLocaleString();
         })
        var field_names = (app_config && 
            app_config.collections && 
            app_config.collections[permission_record._collection_name] && 
            app_config.collections[permission_record._collection_name].field_names)? app_config.collections[permission_record._collection_name].field_names: null;
        if (field_names){
            for (var name in field_names) {
                if (Object.prototype.hasOwnProperty.call(field_names, name)) {
                    if (field_names[name].type == "date" && permission_record[name]) {
                        var aDate = new Date(permission_record[name])
                        permission_record[name] = aDate.toDateString()
                    } 
                };
            }
        }
        return permission_record;
    }



/* Todo - to be redone, or integrated into above
exports.getPublicDataObject= function(req, res) {
    // todo - Needs to be redone for files only
    // app.get('/v1/pfile/:user_id/:app_name/:collection_name/*', public_handler.getPublicDataObject); // collection_name is files 
        
    // Initialize variables
        var request_file = helpers.startsWith(req.path,"/v1/pfile"),
            permission_collection_name = "accessible_objects";
        var permission_record, app_config, permission_model;
        var requestedFolder, parts, resulting_record = null, app_permission, data_record, permission_collection_name;
        if (request_file) {
            parts = req.originalUrl.split('/');
            parts.splice(0,5,"userfiles",parts[4],parts[3]);
            requestedFolder = parts.length==6? "/": (parts.slice(4,parts.length-1)).join("/");
            data_object_id = unescape(parts.slice(3).join("/"));
        } else {
            public_id = decodeURIComponent(req.params.public_id);
        }

        var record_is_permitted = false;
        var permission_type; // = permission_type = (permission_model && permission_model && permission_model.type)? permission_model.type: null;

        var collection_name; // = req.params.collection_name?  req.params.collection_name: (permission_model.collection? permission_model.collection :  ( (permission_model.collections && permission_model.collections.length>0)? permission_model.collections[0]: null ) ) 

        function app_err(message) {return helpers.app_data_error(exports.version, "getDataObject", req.params.app_name, message);}
        function app_auth(message) {return helpers.auth_failure("public_handler", exports.version, "getDataObject", message);}

    async.waterfall([
    // 1. make sure all data exits and open permission collection
        function (cb) {
            if (!public_id){
                cb(app_err("missing data_object_id"));
            } else {
                freezr_db.app_db_collection_get("info_freezr_permissions" , permission_collection_name, cb);
            }
        },

        // 2 get the permission
        function (theCollection, cb) {
            var permission_collection = theCollection;
            var permission_attributes = { 
                'granted':true,
                '_id':public_id,
                'shared_with_group':'public'
            }
            permission_collection.find(permission_attributes).toArray(cb);
        },
        // 3 see permission record and open permissions to make sure it is still granted 
        function (results, cb) {
            if (!results || results.length==0) {
                cb(app_auth("permission record does not exist"));
            }  else if (results.length>1){
                cb(app_err("Internal error - more than one permission retrieved"));
            }  else {
                permission_record = results[0];
                if (request_file){
                    cb(null)
                } else {
                    recheckPermissionExists(permission_record, cb);
                }
            }
        }

    ], 
    function (err, resulting_record) {
        if (err) {
            if (req.freezrInternalCallFwd) {
                req.freezrInternalCallFwd(err)
            } else {
                helpers.send_failure(res, err, "public_handler", exports.version, "getDataObject");
            }
        } else if (request_file){
            // use permission record to send file
            //onsole.log("sending getDataObject "+__dirname.replace("/freezr_system","/") + unescape(parts.join('/')));
            console.log("Todo - fix for files")
            res.sendFile(file_handler.fullPath(unescape(parts.join('/')),true)) ;
        } else {
            if (req.freezrInternalCallFwd) {
                var permission_name = (app_config && app_config.permissions && permission_record && permission_record.permission_name)? app_config.permissions[permission_record.permission_name]: null;
                req.freezrInternalCallFwd(null, resulting_record, permission_record.permission_name);
            } else {
                helpers.send_success(res, {'results':resulting_record});
            }
        }
    }); // to bo redone
}
*/