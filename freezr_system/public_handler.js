// freezr.info - nodejs system files - public_handler.js
exports.version = "0.0.1";

var helpers = require('./helpers.js'),
    freezr_db = require("./freezr_db.js"),
    fs = require('fs'), 
    async = require('async');

const ALL_APPS_CONFIG = {
    'meta': {
        'app_display_name':"freezr - All public cards",
        'app_version': "0.0.1"
    },
    'public_pages' : {
        "allPublicRecords" : {
            'html_file':"allpublcirecords.html",
            'css_file': "allpublcirecords.css",
            'js_files': ["allpublcirecords.js"],
        }
    }

}

exports.generatePublicPage = function (req, res) { 
    //    app.get('/pcard/:public_id', addVersionNumber, public_handler.generatePublicPage); 
    //    app.get('/pcard/:public_id', addVersionNumber, public_handler.generatePublicPage); 
    //    app.get('/ppage/:app_name/:page', addVersionNumber, public_handler.generatePublicPage); 
    //    app.get('/ppage/:app_name', addVersionNumber, public_handler.generatePublicPage); 
    //    app.get('/ppage', addVersionNumber, public_handler.generatePublicPage); 
    console.log("generating public page "+req.url);
   

    var isCard    = helpers.startsWith(req.path,"/pcard");
    var app_name  = allApps? "info.freezr.public" : req.params.app_name;
    var allApps   = (!isCard && !app_name);

    var public_id = req.params.public_id? decodeURIComponent(req.params.public_id): null;
        if (public_id && public_id.length>0) {
            var parts = public_id.split('_');
            if (parts.length<3) {
                helpers.send_internal_err_failure("public_handler", exports.version, "generatePublicPage", null, "invalid publicid");
            } else {
                app_name =parts[0];
                user_id = parts[1];
                parts.splice(0,2)
                record_id = parts.join("_");
            }
        } 
    var record_id, user_id;

    var app_config  = allApps? ALL_APPS_CONFIG : helpers.get_app_config(app_name);

    var page_name; page_params = {};

    //onsole.log({app_config})

    if (!app_config || !app_config.public_pages || isEmpty(app_config.public_pages) ){
        helpers.auth_failure("public_handler", exports.version, "generatePublicPage", null, "app config element missing");
    } else {

        page_name   = req.params.page;
        if (!page_name || !app_config.public_pages[page_name]) page_name = firstElementKey(app_config.public_pages);
        if (!page_name) {
            page_name = "index";
            page_params = {
                html_file:"index.html",
                css_file:"index.css",
                js_file:"index.js"
            }
        } else {
            if (helpers.endsWith(page_name, '.html')) page_name = page_name.slice(0,-5);
            page_params = app_config.public_pages[page_name];
        }

        if (!page_params.html_file) {
            helpers.invalid_data("public_handler", exports.version, "generatePublicPage", null, "html file missing in app_config");
        }

        if (!isCard) {
            var options = {
                page_url: "public/"+page_params.html_file,
                page_title: page_params.page_title+" - freezr.info",
                css_files: [], // page_params.css_files,
                initial_data: page_params.initial_data? page_params.initial_data: null,
                script_files: [], //page_params.script_files, //[],
                messages: {showOnStart:false},
                app_name: app_name,
                app_display_name : ( (app_config && app_config.meta && app_config.meta.app_display_name)? app_config.meta.app_display_name:app_name),
                app_version: (app_config && app_config.meta && app_config.meta.app_version)? app_config.meta.app_version:"N/A",
                freezr_server_version: req.freezr_server_version,
                other_variables: null,
                server_name: req.protocol+"://"+req.get('host')
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
                        var thePath = helpers.startsWith(js_file,"info.freezr.public")? helpers.partPathToFreezrPublicFile(js_file):helpers.partPathToAppFiles(req.params.app_name, "public/"+js_file)
                        if (helpers.fileExt(thePath) == 'js'){
                            options.script_files.push(thePath);
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
                        var thePath = helpers.startsWith(css_file,"info.freezr.public")? helpers.partPathToFreezrPublicFile(css_file):"public/"+css_file;
                        if (helpers.fileExt(css_file) == 'css'){
                            options.css_files.push(thePath);
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
                        helpers.load_page_skeleton(res, options);
                    }
                })
            } else {
                helpers.load_page_skeleton(res, options);
            }
        } else {

            req.internalCallback = function(err, record, permission_name) {
                var contents;
                if (err) {
                    contents = "error getting data "+JSON.stringify(err)
                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.end(contents);
                } else {
                    var html_file = (app_config && app_config.permissions && app_config.permissions[permission_name] && app_config.permissions[permission_name].card)? app_config.permissions[permission_name].card : null;
                    if (html_file && fileExists(app_name,"public/"+html_file) ) {
                        contents = "Need to get the html file nad merge it."
                        // get the card html file
                        // merge it with mustache and send
                        var Mustache = require('mustache');
                        fs.readFile("app_files/"+app_name+"/public/"+html_file, 'utf8', (err, html_content) => {
                            if (err) throw err;
                            contents = Mustache.render(html_content, record);
                            res.writeHead(200, { "Content-Type": "text/html" });
                            res.end(contents);
                        });
                    } else {
                        contents = "The app has not defined a card (file:"+html_file+")for this public record: <br/>"+JSON.stringify(record);
                        res.writeHead(200, { "Content-Type": "text/html" });
                        res.end(contents);
                    }
                }
            }
            exports.getPublicDataObject (req, res);
        }
    }
};

// database operations

exports.getPublicDataObject= function(req, res) {
    //    app.get('/v1/pdb/:public_id', public_handler.getDataObject); 
    //    app.get('/v1/pufile/:requestee_app/:user_id/*', public_handler.getDataObject); // collection_name is files

    // Initialize variables
        var request_file = helpers.startsWith(req.path,"/v1/pufile"),
            permission_collection_name = "object_permissions";
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

        if (public_id){
            parts = public_id.split('_');
            var requestee_app = parts[0];
            var user_id = parts[1];
            parts.splice(0,2)
            var record_id = parts.join("_");
        }

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
                    getRecordFromPermissionRecord(permission_record, cb);
                }
            }
        }

    ], 
    function (err, resulting_record) {
        if (err) {
            if (req.internalCallback) {
                req.internalCallback(err)
            } else {
                helpers.send_failure(res, err, "public_handler", exports.version, "getDataObject");
            }
        } else if (request_file){
            // use permission record to send file
            //onsole.log("sending getDataObject "+__dirname.replace("/freezr_system","/") + unescape(parts.join('/')));
            console.log("Todo - fixfor files")
            res.sendFile(helpers.fullPath(unescape(parts.join('/')),true)) ;
        } else {
            if (req.internalCallback) {
                var permission_name = (app_config && app_config.permissions && permission_record && permission_record.permission_name)? app_config.permissions[permission_record.permission_name]: null;
                req.internalCallback(null, resulting_record, permission_record.permission_name);
            } else {
                helpers.send_success(res, {'results':resulting_record});
            }
        }
    });
}

var getRecordFromPermissionRecord = function(permission_record, callback) {
    var app_config = helpers.get_app_config(permission_record.requestee_app);
    var permission_model= (app_config && app_config.permissions && app_config.permissions[permission_record.permission_name])? app_config.permissions[permission_record.permission_name]: null;
    if (!app_config){
        callback(app_err("missing or removed app_config"));
    } else if (!permission_model){
        callback(app_err("missing permission in app_config"));
    } else {
        async.waterfall([
            // 1. make sure all data exits and get permission
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
                    }
                */
       
            // 2. get app permissions and if granted, open data collection (unless requesting a file) 
            function (results, cb) {
                if (!results || results.length==0) {
                    cb(app_auth("permission does not exist"));
                }  else if (!results.length>1) {
                    cb(app_auth("internal error - more than one permission retrieved."));
                }  else if (!results[0].granted) {
                    cb(app_auth("permission no longer granted."));
                } else {
                    freezr_db.app_db_collection_get(permission_record.requestee_app.replace(/\./g,"_") , permission_record.collection_name, cb);
                }
            },
            // 3. get the record (unless you are getting a file)
            function (theCollection, cb) {
                var real_object_id = freezr_db.real_id(permission_record.data_object_id,app_config,permission_record.collection_name);                
                theCollection.find({'_id':real_object_id}).toArray(cb);
            }
            ],
            function(err, results){
                if (err) {
                    helpers.app_data_error(exports.version, "getRecordFromPermissionRecord", permission_record.requestee_app, err)
                    callback(err)
                } else {
                    resulting_record = results[0];
                    var new_resulting_record = {};
                    if (permission_model.return_fields && permission_model.return_fields.length>0) {   
                        for (var i=0; i<permission_model.return_fields.length; i++) {
                            new_resulting_record[permission_model.return_fields[i]] =  resulting_record[permission_model.return_fields[i]];
                        }
                    } else {
                        new_resulting_record = resulting_record;
                    }
                    callback(null, new_resulting_record);
                }


            }
        )
    }
}



exports.dbp_query = function (req, res){
    //app.post('/v1/pdbq', public_handler.pdb_query); 
    //app.get ('/v1/pdbq', public_handler.pdb_query); 
    /* 
    options are: 
        - app_name
        - user_id
        - skip
        - count
    */
    console.log("dbp_query req "+req.url)
    //onsole.log("req.body is",req.body)
    // Initialize variables
        var permission_collection_name = "object_permissions";
        var data_records= [];
        var errs = [];

        function app_err(message) {return helpers.app_data_error(exports.version, "dbp_query", "public query for "+(req.body.app_name || "all apps"), message);}
        function app_auth(message) {return helpers.auth_failure("public_handler", exports.version, "dbp_query", message);}
    

    async.waterfall([
    // 1. make sure all data exits and open permission collection
        function (cb) {
            freezr_db.app_db_collection_get("info_freezr_permissions" , permission_collection_name, cb);
        },

        // 2 get the permission
        function (theCollection, cb) {
            var permission_collection = theCollection;
            var permission_attributes = { 
                'granted':true,
                'shared_with_group':'public'
            }
            if (req.body.app_name) permission_attributes.requestee_app = req.body.app_name;
            if (req.body.user_id ) permission_attributes._creator = req.body.user_id;

            var skip = req.body.skip? parseInt(req.body.skip): 0, 
                count= req.body.count? parseInt(req.body.count): 50,
                sort =  {'_date_Modified': -1}

            permission_collection.find(permission_attributes)
                .sort(sort)
                .limit(count)
                .skip(skip)
                .toArray(cb);

        },
        // 3 see permission record and open permissions to make sure it is still granted 
        function (results, cb) {
            if (!results || results.length==0) {
                cb(app_err("No permitted objects exist"));
            }  else {

                async.forEach(results, function (permission_record, cb2) {
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
                        }
                    */

                    getRecordFromPermissionRecord(permission_record, function (err, data_record) {
                        if (err) {
                            errs.push({error:err, permission_record:permission_record})
                            cb2(null)
                        } else {
                            data_record._app_name = permission_record.requestee_app;
                            data_records.push (data_record)
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
            if (req.internalCallback) {
                req.internalCallback(null, {results:data_records, errors:errs});
            } else {
                helpers.send_success(res, {results:data_records, errors:errs});
            }
        }
    });
}

// developer utilities
    exports.getConfig = function (req, res){
        //app.get(''/v1/developer/config/:app_name/:source_app_code'

        var app_config = helpers.get_app_config(req.params.app_name);

        var collection_names = null;

        function app_err(message) {return helpers.app_data_error(exports.version, "getConfig", req.params.app_name, message);}
        
        async.waterfall([
            // 1. make sure all data exits
            function (cb) {
                if (!req.session.logged_in_user_id) {
                    cb(helpers.auth_failure("app_handler", exports.version, "getConfig", req.params.app_name, "Need to be logged in to access app"));
                } else {
                    cb(null);
                }
            },

            // 2. checkapp code (make sure the right app is sending data) and device_code (to make sure rights exist)
            function (cb) {
                freezr_db.check_app_code(req.session.logged_in_user_id, req.params.app_name, req.params.source_app_code, cb)
            },
            function (cb) {
                freezr_db.check_device_code_specific_session(req.session.device_code, req.session.logged_in_user_id, req.params.app_name, cb)
            },

            // 3. open database connection & get collections
            function (cb) {
                freezr_db.getAllCollectionNames(req.params.app_name.replace(/\./g,"_"), cb);
            },

            // 4. keep names
            function (names, cb) {
                collection_names = names;
                cb(null)
            },

        ], 
        function (err) {
            if (err) {
                helpers.send_failure(res, err, "app_handler", exports.version, "getConfig");
            } else {
                helpers.send_success(res, {'app_config':app_config, 'collection_names':collection_names});
            }
        });
    }
    exports.updateFileList = function (req, res){
        //app.get('/v1/developer/fileListUpdate/:app_name/:source_app_code/:folder_name', userDataAccessRights, app_hdlr.updateFileList);
        // Note: Currently ignores files within directories - ie doesnt iterate

        //onsole.log("got to updateFileDb request for body"+JSON.stringify(req.body)); 

        var app_config = helpers.get_app_config(req.params.app_name);
        var flags = new Flags({'app_name':req.params.app_name}, {'collection_name':'files'});

        var collection_name = "files";
        var data_model = (app_config && app_config.files)? app_config.files: null;

        var dbCollection = null, warning_list =[], files_added_list = [];

        function app_err(message) {return helpers.app_data_error(exports.version, "updateFileList", req.params.app_name, message);}
        
        async.waterfall([
            // 1. make sure all data exits
            function (cb) {
                if (!req.session.logged_in_user_id) {
                    cb(helpers.auth_failure("app_handler", exports.version, "updateFileList", req.params.app_name, "Need to be logged in to access app"));
                } else if (!collectionIsValid(collection_name, app_config, true)) {
                    cb(app_err("invalid collection name"));
                } else if (!newObjectFieldNamesAreValid(null,data_model)) {
                    cb(app_err("cannot update file list with required field_names"));
                } else if (data_model && data_model.do_not_allow) {
                    cb(app_err("files not allowed"));
                } else if (!helpers.valid_path_extension(req.params.folder_name)) {
                    cb(app_err("invalid folder name", ""));
                } else {
                    cb(null);
                }
            },

            // 2. checkapp code (make sure the right app is sending data) and device_code (to make sure rights exist)
            function (cb) {
                freezr_db.check_app_code(req.session.logged_in_user_id, req.params.app_name, req.params.source_app_code, cb)
            },
            function (cb) {
                freezr_db.check_device_code_specific_session(req.session.device_code, req.session.logged_in_user_id, req.params.app_name, cb)
            },

            // 3. open database connection & get collection
            function (cb) {
                freezr_db.app_db_collection_get(req.params.app_name.replace(/\./g,"_") , collection_name, cb);
            },

            // 4. read files
            function (theCollection, cb) {
                dbCollection = theCollection;
                fs.readdir("userfiles"+helpers.sep()+req.session.logged_in_user_id+helpers.sep()+req.params.app_name+(req.params.folder_name?helpers.sep()+req.params.folder_name:""), cb)
            },


            // 5. handle file and get a unique id
            function(folderlist, cb) {
                if (folderlist && folderlist.length>0) {
                    var file_name;
                    async.forEach(folderlist, function (file_name, cb2) {

                        var data_object_id = req.session.logged_in_user_id+(req.params.folder_name?helpers.sep()+req.params.folder_name:"")+helpers.sep()+file_name;

                        if (!helpers.valid_filename(file_name) ) {
                            warning_list.push(file_name+": invalid file name");
                            cb2(null);
                        } else if (data_model && data_model.allowed_file_types && data_model.allowed_file_types.length>0 && data_model.allowed_file_types.indexOf(helpers.fileExt(file_name))<0 ){
                            warning_list.push(file_name+": invalid file type");
                            cb2(null);
                        } else {

                            async.waterfall([
                                function (cb3) {
                                    fs.stat("userfiles"+helpers.sep()+req.session.logged_in_user_id+helpers.sep()+req.params.app_name+(req.params.folder_name?helpers.sep()+req.params.folder_name:"")+helpers.sep()+file_name, cb3);
                                },

                                function(fileStats, cb3) {
                                    if (fileStats.isDirectory() ) {
                                        cb3(helpers.app_data_error(exports.version, "updateFileList", req.params.app_name, "directory error exception - file is a directory"));
                                    } else {
                                        cb3(null)
                                    }
                                },

                                function (cb3) {
                                    dbCollection.find({ _id: data_object_id }).toArray(cb3);
                                },

                                // 7. write or update the results
                                function (results, cb3) {
                                    if (!results  || results.length == 0) {
                                        var write = {};
                                        write._creator = req.session.logged_in_user_id; 
                                        write._date_Modified = new Date().getTime();
                                        write._id = data_object_id;
                                        write._folder = req.params.folder_name? req.params.folder_name:helpers.sep();                                       
                                        write._date_Created = new Date().getTime();
                                        dbCollection.insert(write, { w: 1, safe: true }, cb3);
                                    } else if (results.length > 1) {
                                        cb3(helpers.app_data_error(exports.version, "updateFileList", req.params.app_name, "multiple_files_exception - Multiple Objects retrieved for "+file_name))
                                    } else {
                                        cb3(null, null);
                                    }
                                }, 

                                function (written_object, cb3) {
                                    if (written_object) files_added_list.push(file_name); // else done with file: file_name 
                                    cb3(null);
                                }
                            ],
                            function (err) { // end cb3 - back to cb2
                                if (err) {
                                    warning_list.push(file_name+": "+(err.message? err.message:"unknown error"));
                                } 
                                cb2(null);
                            });
                        }
                    },
                    function (err) {
                        if (err) {
                            warning_list.push("'unkown_file_error': "+JSON.stringify(err));
                        } 
                        cb(null)
                    }

                    )
                } else {
                    cb(null);
                }            
            },

        ], 
        function (err) {
            if (err) {
                helpers.send_failure(res, err, "app_handler", exports.version, "updateFileList");
            } else {
                helpers.send_success(res, {'flags':flags, 'files_added_list':files_added_list, 'warning_list':warning_list});
            }
        });
    }
    function fileExists(app_name, fileName) {
        //onsole.log("fileExists "+helpers.fullPathToAppFiles(req.params.app_name,fileName)+"? "+fs.existsSync(helpers.fullPathToAppFiles(req.params.app_name,fileName)))
        return fs.existsSync(helpers.fullPathToAppFiles(app_name,fileName));}
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

// ancillary functions and name checks
    var collectionIsValid = function (collection_name, app_config,is_file_record){
        // checkes collection name and versus app_config requirements
        
        if (helpers.startsWith(collection_name,"_") ) {
            return false
        } else if (is_file_record && reserved_collection_names.indexOf(collection_name)>-1 && collection_name!="files"){
            return false;
        } else if (!is_file_record && reserved_collection_names.indexOf(collection_name)>-1){
            return false;
        } else if (!app_config || !app_config.meta || !app_config.meta.only_use_collections_listed) {
            return true;
        } else if (is_file_record) {
            return (app_config.files && !app_config.files.do_not_allow)
        } else if (collection_name=="files" && app_config.files && !app_config.files.do_not_allow){
            return true
        } else if (app_config.collections) {
           for (oneCollection in app_config.collections) {
                if (app_config.collections.hasOwnProperty(oneCollection) && oneCollection == collection_name) {return true;}
            }
        }
        return false;
    }
    var newObjectFieldNamesAreValid = function(req, data_model) {
        // Make lists of required field_names from data object
        if (!data_model) {
            return true;
        } else {
            var allFieldNameList= [],
                requiredFieldNameList = [];
            if (data_model && data_model.field_names) {
                for (field_name in data_model.field_names) {
                    if (data_model.field_names.hasOwnProperty(field_name)) {
                        allFieldNameList.push(field_name);
                        if (data_model.field_names[field_name].required) requiredFieldNameList.push(field_name)
                    }
                }
            }
            //onsole.log("allFieldNameList are "+allFieldNameList.join(", "));
            //onsole.log("requiredFieldNameList are "+requiredFieldNameList.join();
            
            if (req && req.body && req.body.data) {
                for (key in req.body.data) {
                    if (req.body.data.hasOwnProperty(key)) {
                        if (helpers.startsWith(key,"_")) {
                            helpers.warning("app_handler", exports.version, "newObjectFieldNamesAreValid","CANNOT USE KEYS STARTING WITH _");
                            return false;
                        }
                        if (requiredFieldNameList.indexOf(key)>-1) {
                            requiredFieldNameList.splice(requiredFieldNameList.indexOf(key),1)
                        }
                        if (reserved_field_name_list.indexOf(key)>-1) {
                            helpers.warning("app_handler", exports.version, "newObjectFieldNamesAreValid","key used is reserved  reserved field_names are "+reserved_field_name_list.join(" "));
                            return false;
                        }
                        if (data_model && data_model.strictly_Adhere_To_schema && allFieldNameList.indexOf(key)<0) {
                            helpers.warning("app_handler", exports.version, "newObjectFieldNamesAreValid","data schema was declared as strict but "+key+" is not declared");
                            return false
                        }
                    }
                }
            }

            // check if file is sent but shouldnt be
            if (data_model && data_model.strictly_Adhere_To_schema && !data_model.file && req.file) {
                helpers.warning("app_handler", exports.version, "newObjectFieldNamesAreValid","ER  SENDIGN FILES WHEN IT SHOULDNT BE");
                return false;
            }

            return (req && req.body && req.body.options && req.body.options.updateRecord) || requiredFieldNameList.length==0;
        }
    }
    var removeIds = function(jsonList) {
        // toto later: in config add a var: private or dontReturn which means that is not returned to third parties
        for (var i=0; i<jsonList.length;i++) {
            if (jsonList[i]._id) {
                delete jsonList[i]._id;
            }
        }
        return jsonList;
    }
    var unique_id_from = function(ref_field_names, params, user_id) {
        data_object_id= "";
        for (var i=0; i<ref_field_names.length; i++) {
            if (!params[ref_field_names[i]] || params[ref_field_names[i]]=="") {
                return helpers.app_data_error(exports.version, "unique_id_from", "app name uknown","missing data key needed for making unique id: "+ref_field_names[i]);
            }
            data_object_id = "_"+params[ref_field_names[i]];
        }
        return user_id + data_object_id;
    }
    var folder_name_from_id = function(the_user, the_id) {
        return the_id.replace((the_user+"_"),"");
    }

