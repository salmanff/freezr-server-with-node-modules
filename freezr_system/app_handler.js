// freezr.info - nodejs system files - app_handler.js
exports.version = "0.0.1";

var helpers = require('./helpers.js'),
    freezr_db = require("./freezr_db.js"),
    fs = require('fs'), 
    async = require('async');

var reserved_field_name_list = ["_creator","_date_Created", "_date_Modified"];
var reserved_collection_names = ["files", "field_permissions", "object_permissions"];

exports.generateDataPage = function (req, res) {
    if (req.params.whattodo == "view" ) {
        req.params.sysConfig = {
            'pages':{
                'allmydata_view': {
                    "page_title":"View all my data for "+req.params.app_name,
                    "html_file":"info.freezr.public/allmydata_view.html",
                    "css_files": ["info.freezr.public/allmydata_view.css"],
                    "script_files": ["info.freezr.public/allmydata_view.js","info.freezr.public/FileSaver.js"]
                }
        }}
       req.params.page = 'allmydata_view'
 } else if (req.params.whattodo == "backup" ) {
        req.params.sysConfig = {
            'pages':{
                'allmydata_backup': {
                    "page_title":"Backup and Restore data for "+req.params.app_name,
                    "html_file":"info.freezr.public/allmydata_backup.html",
                    "css_files": ["info.freezr.public/allmydata_backup.css"],
                    "script_files": ["info.freezr.public/allmydata_backup.js","info.freezr.public/FileSaver.js"]
                }
        }}
        req.params.page = 'allmydata_backup'
    } 
    
    exports.generatePage(req, res);
}

exports.generatePage = function (req, res) { 
    // '/apps/:app_name' and '/apps/:app_name/:page'
    console.log("generating page for app "+req.params.app_name+" page "+req.params.page);
   
    var app_config = (req.params.sysConfig === undefined)? helpers.get_app_config(req.params.app_name): req.params.sysConfig;
    //var app_config = helpers.get_app_config(req.params.app_name);

    var page_name = req.params.page? req.params.page: "index";
    if (helpers.endsWith(page_name, '.html')) page_name = page_name.slice(0,-5);

    var page_params = {};
    if (app_config && app_config.pages && app_config.pages[page_name]) {
        page_params = app_config.pages[page_name];
    } else {
        function fileExists(fileName) {
            //onsole.log("fileExists "+helpers.fullPathToAppFiles(req.params.app_name,fileName)+"? "+fs.existsSync(helpers.fullPathToAppFiles(req.params.app_name,fileName)))
            return fs.existsSync(helpers.fullPathToAppFiles(req.params.app_name,fileName));}
        page_params.page_title = page_name;
        page_params.html_file = fileExists(page_name+".html")? page_name+".html" : null;
        page_params.css_files  = fileExists(page_name+".css") ? page_name+".css"  : null;
        page_params.script_files  = fileExists(page_name+".js")  ? [page_name+".js"]  : null;
    }

    var options = {
        page_title: page_params.page_title+" - freezr.info",
        page_url: page_params.html_file? page_params.html_file: 'info.freezr.public/fileNotFound.html',
        css_files: [],
        initial_data: page_params.initial_data? page_params.initial_data: null,
        script_files: [], //page_params.script_files, //[],
        messages: {showOnStart:false},
        user_id: req.session.logged_in_user_id,
        user_is_admin :req.session.logged_in_as_admin,
        app_name: req.params.app_name,
        app_display_name : ( (app_config && app_config.meta && app_config.meta.app_display_name)? app_config.meta.app_display_name:req.params.app_name),
        app_version: (app_config && app_config.meta && app_config.meta.app_version)? app_config.meta.app_version:"N/A",
        freezr_server_version: req.freezr_server_version,
        other_variables: null,
        server_name: req.protocol+"://"+req.get('host')
    }     

    freezr_db.get_or_set_user_app_code (req.session.logged_in_user_id,req.params.app_name, function(err,results,cb){
        if (err || !results.app_code) {
            helpers.send_internal_err_page(res, "app_handler", exports.version, "generatePage", "Could not get app code");
        } else {
            options.app_code = results.app_code;
            options.messages.showOnStart = (results.newCode && app_config && app_config.permissions && Object.keys(app_config.permissions).length > 0);


            freezr_db.check_device_code_specific_session(req.session.device_code, req.session.logged_in_user_id, req.params.app_name, function(err, cb) {
                // Put page param scripts in options.scrip_files, except for outside scripts to be checked below
                if (err) {
                    req.session.device_code=null;
                    res.redirect('/account/login?error=true&error_type=login_redentials_for_app_only')
                } else {
                    if (page_params.css_files) {
                        if (typeof page_params.css_files == "string") page_params.css_files = [page_params.css_files];
                        page_params.css_files.forEach(function(css_file) {
                            if (helpers.startsWith(css_file,"http")) {
                                helpers.app_data_error(exports.version, "generatePage", req.params.app_name, "Cannot have css files referring to other hosts")
                            } else if (helpers.startsWith(css_file,"/") || helpers.startsWith(css_file,".")) {
                                helpers.app_data_error(exports.version, "generatePage", req.params.app_name, "Cannot have css files referring to other folders")
                            } else {
                                //var thePath = helpers.startsWith(css_file,"info.freezr.public")? helpers.partPathToFreezrPublicFile(css_file):helpers.partPathToAppFiles(req.params.app_name, css_file)
                                if (helpers.fileExt(css_file) == 'css'){
                                    options.css_files.push(css_file);
                                } else {
                                    helpers.app_data_error(exports.version, "generatePage", req.params.app_name, "Cannot have non js file used as css "+css_file)
                                }
                            }
                        });
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
                                var thePath = helpers.startsWith(js_file,"info.freezr.public")? helpers.partPathToFreezrPublicFile(js_file):helpers.partPathToAppFiles(req.params.app_name, js_file)
                                if (helpers.fileExt(thePath) == 'js'){
                                    options.script_files.push(thePath);
                                } else {
                                    helpers.app_data_error(exports.version, "generatePage", req.params.app_name, "Cannot have non js file used as js.")
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
                }
            })   
        }
    });    
};

// database operations
exports.putData = function (req, res){
    // /v1/app_data/:app_name/:source_app_code/:collection
    console.log("putData at "+req.url); // "body:"+JSON.stringify(req.body)

    // Initialize variables
        if (req.body.options && (typeof req.body.options == "string")) req.body.options = JSON.parse(req.body.options); // needed when upload file
        if (req.body.data && (typeof req.body.data == "string")) req.body.data = JSON.parse(req.body.data); // needed when upload file

        var app_config = helpers.get_app_config(req.params.app_name);
        var data_object_id= (req.body.options && req.body.options.data_object_id)? req.body.options.data_object_id: null;
        var flags = new Flags({'app_name':req.params.app_name});
        var real_object_id, data_model, dbCollection = null, collection_name=null, returned_confirm_fields={},  real_object_id;
        function app_err(message) {return helpers.app_data_error(exports.version, "putData", req.params.app_name, message);}
        var fileParams = {'dir':"", 'name':"", 'duplicated_file':false};
        fileParams.is_attached = (req.file)? true:false;

    // Set collection_name and data_model
        if (fileParams.is_attached) {
            if (req.params.collection) flags.add('warnings','collectionNameWithFiles',{'collection_name':collection_name});
            if (data_object_id) flags.add('warnings','dataObjectIdSentWithFiles');
            collection_name = "files";
            data_model = (app_config && app_config.files)? app_config.files: null;
        } else if (req.params.collection == "files" && req.body.options && req.body.options.updateRecord){
            collection_name = "files";
            data_model = (app_config && app_config.files)? app_config.files: null;
        } else {
            collection_name  = req.params.collection? req.params.collection.replace(".json",""): null;
            data_model= (app_config && app_config.collections && collection_name && app_config.collections[collection_name])? app_config.collections[collection_name]: null;
        }

    
    async.waterfall([
    // 1. make sure all data exits
        function (cb) {
            if (!req.session.logged_in_user_id) {
                cb(helpers.auth_failure("app_handler", exports.version, "putData", req.params.app_name, "Need to be logged in to access app"));
            } else if (!collection_name) { 
                cb(app_err("Missing collection name"));
            } else if (!collectionIsValid(collection_name,app_config,fileParams.is_attached)) {
                cb(app_err("Collection name is invalid."));
            } else if (!newObjectFieldNamesAreValid(req,data_model)) {
                cb(app_err("invalid field names"));
            } else if (fileParams.is_attached && data_model && data_model.do_not_allow) {
                cb(app_err("config doesnt allow file uploads."));
            } else if (!fileParams.is_attached && Object.keys(req.body.data).length<=0 ) {
                cb(app_err("Missing data parameters."));
            } else if (!fileParams.is_attached && Object.keys(req.body.data).length<=0 ) {
                cb(app_err("Missing data parameters."));               
            } else if (helpers.system_apps.indexOf(req.params.app_name)>-1){
                cb(helpers.invalid_data("app name not allowed: "+app_name, "account_handler", exports.version, "add_uploaded_app_zip_file"));
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

    // 3. get data_object_id (if needed to be set manually) 
    //     and if file: error check and write file  
        function(cb) {
            if (fileParams.is_attached) {
                fileParams.dir = (req.body.options && req.body.options.targetFolder)?req.body.options.targetFolder : "";
                data_object_id = helpers.removeStartAndEndSlashes(req.session.logged_in_user_id+"/"+helpers.removeStartAndEndSlashes(""+fileParams.dir));
                fileParams.dir = helpers.normUrl(helpers.removeStartAndEndSlashes("userfiles/"+req.session.logged_in_user_id+"/"+req.params.app_name+"/"+helpers.removeStartAndEndSlashes(""+fileParams.dir)) );
                fileParams.name = ( req.body.options && req.body.options.fileName)?req.body.options.fileName : req.file.originalname; 

                if (!helpers.valid_filename(fileParams.name) ) {
                    cb(app_err("Invalid file name"));
                } else if (data_model && data_model.allowed_file_types && data_model.allowed_file_types.length>0 && data_model.allowed_file_types.indexOf(helpers.fileExt(fileParams.name))<0 ){
                    cb(app_err("invalid file type"));
                } else if (!helpers.valid_path_extension(fileParams.dir)) {
                    cb(app_err("invalid folder name"));
                } else {
                    helpers.checkUserDirExists(fileParams.dir, function() {
                        if (fs.existsSync(fileParams.dir +helpers.sep() +fileParams.name) ) {
                            if ( req.body.options && req.body.options.fileOverWrite  ) {
                                // all okay
                            } else if (data_model && data_model.file && data_model.file.donot_auto_enumerate_duplicates) {
                                    cb(app_err("Config settings are set to donot_auto_enumerate_duplicates. To over-write a file, fileOverWrite must be set to true in options."));
                            } else {
                                fileParams.name = helpers.auto_enumerate_filename(fileParams.dir,fileParams.name);
                                fileParams.duplicated_file = true;
                            }
                        }
                        data_object_id = data_object_id+helpers.sep()+fileParams.name;
                        fs.writeFile(fileParams.dir+helpers.sep()+fileParams.name, req.file.buffer, cb);
                    });
                }
            } else if (!data_model || !data_model.make_data_id || !data_model.make_data_id.from_field_names) {
                cb(null);
            } else if (data_model.make_data_id.manual) {
                if (data_object_id) {
                    cb(null);
                } else {
                    cb(app_err("object id is set to manual but is missing"));
                }
            // then is must be make_data_id.from_field_names...
            } else if (!data_model.make_data_id.reference_field_names || !(data_model.make_data_id.reference_field_names instanceof Array) || data_model.make_data_id.reference_field_names.length==0){
                cb(app_err("object id reference field_names but none are included"));
            } else { 
                var err = null;
                try {
                    data_object_id = unique_id_from(data_model.make_data_id.reference_field_names, req.body.data, req.session.logged_in_user_id);
                } catch (e) {
                    err=e; 
                }
                if (err) {cb(app_err("Could not set object_id - "+err));} else {cb(null);}
            }
        },

    // 4. get collection, set real_object_id and get existing object (if it exists).
        function (cb) {
            //onsole.log("getting colleciton "+collection_name);
            freezr_db.app_db_collection_get(req.params.app_name.replace(/\./g,"_") , collection_name, cb);
        },
        function (theCollection, cb) {
            dbCollection = theCollection;
            if (!data_object_id) {
                cb(null, null);
            } else {
                real_object_id = freezr_db.real_id(data_object_id,app_config,collection_name);
                dbCollection.find({ _id: real_object_id }).toArray(cb);
            }
        },

    // 5. write or update the results
        function (results, cb) {
            //onsole.log("Going to write id "+data_object_id+((results && results.length>0)? "item exists": "new item"));
            var write = req.body.data? JSON.parse(JSON.stringify(req.body.data)): {};
                write._creator = req.session.logged_in_user_id; 
                if (!req.body.options || !req.body.options.restoreRecord || !write._date_Modified) write._date_Modified =  0 + (new Date().getTime() );
                
                if (fileParams.is_attached) {write._folder = (req.body.options && req.body.options.targetFolder)? helpers.removeStartAndEndSlashes(req.body.options.targetFolder):"/";}

                // set confirm_return_fields
                    var return_fields_list = (req.body.options && req.body.options.confirm_return_fields)? req.body.options.confirm_return_fields: ['_id'];
                    for (var i =0; i<return_fields_list.length; i++) {
                        if ((typeof return_fields_list[i] == "string")  && 
                            write[return_fields_list[i]]) {
                            returned_confirm_fields[return_fields_list[i]] = write[return_fields_list[i]];
                        }
                        if (data_object_id) {returned_confirm_fields._id = data_object_id};
                    }
            
            if ((results == null || results.length == 0) && req.body.options && req.body.options.updateRecord && !req.body.options.restoreRecord && !data_model.make_data_id.manual){
                cb(helpers.rec_missing_error(exports.version, "putData", req.params.app_name, "Document not found. (updateRecord with no record) for record "))
            } else if ( (results == null || results.length == 0) ) { // new document
                write._date_Created = new Date().getTime();
                if (data_object_id) {write._id = real_object_id};
                if ((req.body.options && req.body.options.fileOverWrite) && fileParams.is_attached) flags.add('warnings','fileRecordExistsWithNoFile');
                dbCollection.insert(write, { w: 1, safe: true }, cb);
            } else if (results.length == 1 && fileParams.is_attached && (req.body.options && req.body.options.fileOverWrite) && results[0]._creator == req.session.logged_in_user_id) { // file data being updated
                dbCollection.update({_id: real_object_id },
                    {$set: write}, {safe: true }, cb);
            } else if (results.length == 1 && req.body.options && (req.body.options.updateRecord || data_model.make_data_id.manual) && results[0]._creator == req.session.logged_in_user_id) { // document update
                //todo: have option of overwriting all? dbCollection.update({ _id: real_object_id }, ie write, {safe: true }, cb);
                returned_confirm_fields._updatedRecord=true;
                dbCollection.update({ _id: real_object_id },
                    {$set: write}, {safe: true }, cb);                
            } else if (results[0]._creator != req.session.logged_in_user_id) {
                cb(helpers.auth_failure("app_handler", exports.version, "putData", req.params.app_name, "Cannot write to another user's record"));
            } else if (results.length == 1) {
                cb(app_err("data object ("+data_object_id+") already exists. Set updateRecord to true in options to update a document, or fileOverWrite to true when uploading files."));
            } else {
                cb(app_err("Multiple Objects retrieved - SNBH"));
            }
        }
    ], 
    function (err, final_object) {
        if (err) {
            helpers.send_failure(res, err, "app_handler", exports.version, "putData");
        } else {
            final_object = final_object[0];
            //onsole.log("got back final object "+JSON.stringify(final_object))
            if (final_object && final_object._id) returned_confirm_fields._id = final_object._id; // new document
            if (final_object && final_object._date_Created) returned_confirm_fields._date_Created = final_object._date_Created;
            helpers.send_success(res, {'success':true, 'confirmed_fields':returned_confirm_fields, 'duplicated_file':fileParams.duplicated_file, 'flags':flags});
        }
    });
}
exports.getDataObject= function(req, res) {
    //app.get('/v1/db/getbyid/:permission_name/:collection_name/:requestor_app/:source_app_code/:requestee_app/:data_object_id', app_handler.getDataObject); // here request type must be "one"
    //app.get('/v1/userfiles/:permission_name/:collection_name/:requestor_app/:source_app_code/:requestee_app/:user_id/*', app_handler.getDataObject);

    // Initialize variables
        var request_file = helpers.startsWith(req.path,"/v1/userfiles") ;
        var requestedFolder, parts, resulting_record = null, app_permission, data_object_id, data_record;
        if (request_file) {
            parts = req.originalUrl.split('/');
            parts.splice(0,9,"userfiles",parts[8],parts[7]);
            requestedFolder = parts.length==6? "/": (parts.slice(4,parts.length-1)).join("/");
            data_object_id = unescape(parts.slice(3).join("/"));
        } else {
            data_object_id = req.params.data_object_id;
        }

        var app_config = helpers.get_app_config(req.params.requestor_app);
        var permission_model= (app_config && app_config.permissions && app_config.permissions[req.params.permission_name])? app_config.permissions[req.params.permission_name]: null;
        var permission_type = (permission_model && permission_model && permission_model.type)? permission_model.type: null;

        var collection_name = req.params.collection_name?  req.params.collection_name: (permission_model.collection? permission_model.collection :  ( (permission_model.collections && permission_model.collections.length>0)? permission_model.collections[0]: null ) ) 

        var own_record = (req.params.requestor_app == req.params.requestee_app  && (!request_file || (req.session.logged_in_user_id == req.params.user_id) ) );
        
        var record_is_permitted = false;

        var permission_collection_name = permission_type=="field_delegate"? "field_permissions": (permission_type=="object_delegate"? "object_permissions": null);

        function app_err(message) {return helpers.app_data_error(exports.version, "getDataObject", req.params.app_name, message);}
        function app_auth(message) {return helpers.auth_failure("app_handler", exports.version, "getDataObject", message);}
        //onsole.log("getDataObject "+data_object_id+" from coll "+collection_name);

    async.waterfall([
    // 1. make sure all data exits
        function (cb) {
            if (!req.session || !req.session.logged_in || !req.session.logged_in_user_id) {
                cb(app_auth("Need to be logged in to access app"));
            } else if (!data_object_id){
                cb(app_err("missing data_object_id"));
            } else if (own_record && request_file) {
                cb(null); // no need to check for other issues - just app code
            } else if (!app_config){
                cb(app_err("missing app_config"));
            } else if (!own_record && !permission_model){
                cb(app_err("missing permission"));
            } else if (!own_record && !permission_type){
                cb(app_err("missing permission type"));
            } else if (!own_record && helpers.permitted_types.type_names.indexOf(permission_type)<0) {
                cb(app_err("invalid permission type"));
            } else {
                cb(null);
            }
        },

    // 2. checkapp code (make sure the right app is sending data) and device_code (to make sure rights exist)
        function (cb) {
            freezr_db.check_app_code(req.session.logged_in_user_id, req.params.requestor_app, req.params.source_app_code, cb)
        },
        function (cb) {
            freezr_db.check_device_code_specific_session(req.session.device_code, req.session.logged_in_user_id, req.params.requestor_app, cb)
        },

    // 3. open app db
        function (cb) {
            if (own_record && request_file) {    
                record_is_permitted = true;
            } 
            if (request_file && permission_type != "field_delegate") {
                cb(null, null);
            } else {
                freezr_db.app_db_collection_get(req.params.requestee_app.replace(/\./g,"_") , collection_name, cb);
            }
        },

    // 4. get the record (unless you are getting a file)
        function (theCollection, cb) {
            if (request_file && permission_type != "field_delegate") {
                cb(null, null);
            } else {
                var real_object_id = freezr_db.real_id(data_object_id,app_config,collection_name);
                theCollection.find({'_id':real_object_id}).toArray(cb);
            }
        },

    // 5. check if record fits criteria and return it if it belongs to the logged in user (own_record)
        function (results, cb) {
            if (request_file && permission_type != "field_delegate") {
                if (own_record) {
                    record_is_permitted = true;
                    cb({"success":true}, null)
                } else {
                    cb(null);
                }
            } else if (!results || results.length==0) {
                cb(app_err("no related records"))
            } else {
                if (results.length>1) {console.log("ERROR - GOT more than 1 record "+JSON.stringify(results));s}
                if(!req.params.user_id) {
                    req.params.user_id = req.session.logged_in_user_id; // cnsole check - changed sep 9 2015 replaced results[0]._creator;
                    //own_record = (req.params.requestor_app == req.params.requestee_app  && req.session.logged_in_user_id == req.params.user_id);
                }
                if (!own_record && !request_file && permission_model.return_fields && permission_model.return_fields.length>0) {
                    resulting_record = {};
                    for (var i=0; i<permission_model.return_fields.length; i++) {
                        resulting_record[permission_model.return_fields[i]] =  results[0][permission_model.return_fields[i]];
                    }
                } else {
                    resulting_record = results[0];
                }
                cb(null);

                if (own_record) {
                    record_is_permitted = true;
                    cb({"success":true}, null)
                } else {
                    cb(null);
                }
            }
        },

    // 6. get app permissions and if granted, open field_permissions or object_permission collection 
        function(cb) {
            freezr_db.permission_by_creator_and_permissionName (req.params.user_id, req.params.requestor_app, req.params.requestee_app, req.params.permission_name, cb)
        },
        function (results, cb) {
            if (!results || results.length==0) {
                cb(app_auth("permission does not exist"));
            }  else if (!results[0].granted) {
                cb(app_auth("permission not granted yet"));
            }  else {
                app_permission = results[0];
                if (permission_collection_name) {
                    freezr_db.app_db_collection_get("info_freezr_permissions" , permission_collection_name, cb);
                } else {
                    cb(null, null)
                }
            }
        },
    // 7 Find right permisssion attributes to see if they are granted and consistent with app permission
        function (theCollection, cb) {
            var permission_collection = theCollection;
            var permission_attributes = { 
                'granted':true,
                'requestor_app':req.params.requestor_app,
                'requestee_app':req.params.requestee_app,
                '_creator': req.params.user_id,
                'permission_name':req.params.permission_name,
                '$or': [{'shared_with_group':'logged_in'},{'shared_with_group':'public'},{'shared_with_user': req.session.logged_in_user_id} ] 
            }
            if (permission_collection_name == "field_permissions") {
                // no extra conditions
                permission_collection.find(permission_attributes).toArray(cb);
            } else if (permission_collection_name ==  "object_permissions") {
                permission_attributes.collection_name = req.params.collection_name;
                permission_attributes.data_object_id = data_object_id;
                permission_collection.find(permission_attributes).toArray(cb);
            } else {
                cb(null, null)
            }            
        },
        function (all_permissions, cb) {
            if (own_record) {
                cb(null);
            } else  if (permission_type == "folder_delegate") {
                // go through all directories permitted and see if file is permitted
                var sharable_folder, folder_delegate_perm_granted = false, app_perm_granted = false;
                for (var i= 0; i<app_permission.sharable_folders.length; i++) {
                    sharable_folder = helpers.removeStartAndEndSlashes(app_permission.sharable_folders[i]);
                    if (helpers.startsWith(requestedFolder, sharable_folder)) {
                        // app_perm_granted - permitted due to field perm app_permission.sharable_folders[i]
                        app_perm_granted = true;
                    }
                }
                if (app_perm_granted) {
                    record_is_permitted = true;
                    cb(null);
                } else {
                    cb(app_auth("app permission granted does not correspond to request"));
                }
            } else if (all_permissions == null || all_permissions.length == 0) {
                cb(app_auth("no permission")); 
            } else if (permission_type=="object_delegate") {
                // note that it is possible for multiple permissions to have been given the "or" in the query allowing one for groups and one for users.. but it doesnt really matter because it is allowed in any case
                if (app_permission.collections.indexOf(collection_name)<0) {
                    cb(app_auth("permission doesnt allow specified collection"))
                } else {
                    record_is_permitted = true;
                    cb(null);
                }
            } else if (permission_type == "field_delegate") {
                for (var i= 0; i<all_permissions.length; i++) {
                    if (permission_model.sharable_fields.indexOf(all_permissions[i].field_name) >= 0 && app_permission.sharable_fields.indexOf(all_permissions[i].field_name) >= 0 && resulting_record[all_permissions[i].field_name] == all_permissions[i].field_value) {
                        // record is permitted due to field perm: all_permissions[i]
                        record_is_permitted = true;
                    }
                }
                cb(null);
            } else {
                cb(app_err("Wrong permission type - SNBH"));
            }
        }
    ], 
    function (err) {
        //onsole.log("got to end of getDataObject");
        if (!record_is_permitted) {
            if (request_file){
                res.sendStatus(401);
            } else {
                helpers.send_failure(res, err, "app_handler", exports.version, "getDataObject");
            }
        } else if (request_file){
            //onsole.log("sending getDataObject "+__dirname.replace("/freezr_system","/") + unescape(parts.join('/')));
            res.sendFile(helpers.fullPath(unescape(parts.join('/')),true)) ;
        } else {
            //onsole.log("sending record:"+JSON.stringify(resulting_record));
            helpers.send_success(res, {'results':resulting_record});
        }
    });
}
exports.db_query = function (req, res){
    console.log("db_query: "+req.url)
    //app.post('/v1/db/query/:requestor_app/:source_app_code/:requestee_app', userDataAccessRights, app_hdlr.db_query); 
    //app.post('/v1/db/query/:requestor_app/:source_app_code/:requestee_app/:permission_name', userDataAccessRights, app_hdlr.db_query); 

    var appDb = {}, dbCollection, permissionCollection, usersWhoGrantedAppPermission = [], objectsPermittedList=[];
    var usersWhoGrantedFieldPermission = (req.params.requestee_app == req.params.requestor_app)? [{'_creator':req.session.logged_in_user_id}]: []; // if requestor is same as requestee then user is automatically included
    var app_config = helpers.get_app_config(req.params.requestee_app);

    var app_config_permission_schema = (app_config && app_config.permissions)? app_config.permissions[req.params.permission_name]: null;
    var permission_collection_name = (app_config_permission_schema && app_config_permission_schema.type=="field_delegate")? "field_permissions": ((app_config_permission_schema && app_config_permission_schema.type=="object_delegate")? "object_permissions": null);

    var permission_attributes = {
        'requestor_app': req.params.requestor_app,
        'requestee_app': ((app_config_permission_schema && app_config_permission_schema.requestee_app)? app_config_permission_schema.requestee_app: req.params.requestee_app),
        'permission_name': req.params.permission_name,
        'granted':true
        // field_value - to be assigned
    };

    // get permissions and get list of users who granted okay and check field name is right
    // get field permissions and check again

    function app_err(message) {return helpers.app_data_error(exports.version, "db_query", req.params.requestor_app, message);}
    function app_auth_err(message) {return helpers.auth_failure("app_handler", exports.version, "db_query", req.params.requestor_app,  message);}

    //onsole.log("db_query from: "+req.params.requestor_app+" - "+JSON.stringify(req.body));

    var own_record = (!req.params.permission_name && req.params.requestor_app==permission_attributes.requestee_app)
    var usersWhoGrantedAppPermission = own_record? [{'_creator':req.session.logged_in_user_id}]: []; // if requestor is same as requestee then user is automatically included
    
    async.waterfall([
        // 1. make sure all data exits
        function (cb) {
            if (!req.session.logged_in_user_id) {
                cb(app_auth_err("Need to be logged in to access app"));
            } else if (!req.params.permission_name && !own_record) {
                cb(app_err("Missing permission_name"));
            } else if (own_record) {
                cb(null)
            } else if (!app_config || !app_config_permission_schema){
                cb(app_err("Missing app_config && permission_schema"));
            } else  {
                if (app_config_permission_schema.type=="folder_delegate") {
                    permission_attributes.field_name = "_folder";
                    if (!app_config_permission_schema.sharable_folders || app_config_permission_schema.sharable_folders.length==0) {
                        cb(app_err("No folders have been specified in app config"));
                    } else {
                        permission_attributes.field_value = req.body.field_value? req.body.field_value :app_config_permission_schema.sharable_folders[0];
                        cb(null);
                    }
                } else if (app_config_permission_schema.type=="field_delegate") {
                    permission_attributes.field_name = req.body.field_name;
                    permission_attributes.field_value = req.body.field_value;
                    if (!req.body.field_name && app_config_permission_schema.sharable_fields && app_config_permission_schema.sharable_fields.length>0) {
                        permission_attributes.field_name = app_config_permission_schema.sharable_fields[0];
                    }
                    if (!permission_attributes.field_name) {
                        cb(app_err("missing ield name in app config"));
                    } else if (!permission_attributes.field_value){
                        cb(app_err("missing field value"));
                    }  else {
                        cb(null);
                    }  
                } else { // types are db_query or object_delegate
                    cb(null);
                }
                          
            }
        },

        // 2. checkapp code (make sure the right app is sending data) and device_code (to make sure rights exist)
        function (cb) {
            freezr_db.check_app_code(req.session.logged_in_user_id, req.params.requestor_app, req.params.source_app_code, cb)
        },
        function (cb) {
            freezr_db.check_device_code_specific_session(req.session.device_code, req.session.logged_in_user_id, req.params.requestor_app, cb)
        },

        // 3. Get app permission
        function (cb) {
            if (own_record) {
                cb(null, []);
            } else {
                freezr_db.all_granted_app_permissions_by_name(req.params.requestor_app, permission_attributes.requestee_app, req.params.permission_name, null , cb) 
            }
        },

        // 4. Recheck that have given the required permission and add to usersWhoGrantedAppPermission list
        function (allUserPermissions, cb) {
            if (allUserPermissions && allUserPermissions.length>0) {
                for (var i=0; i<allUserPermissions.length; i++) {
                    if (  (allUserPermissions[i].sharable_groups && allUserPermissions[i].sharable_groups.indexOf("logged_in")>-1 && req.session.logged_in_user_id)
                          ||
                          (allUserPermissions[i].sharable_groups && allUserPermissions[i].sharable_groups.indexOf("self")>-1 && allUserPermissions[i]._creator==req.session.logged_in_user_id) 
                        // todo - if statement to be pushed in freezr_db as a function... and used in other permission functions as an extra security (and everntually to allow non logged in users)
                        ) {
                            if (["field_delegate","folder_delegate"].indexOf(app_config_permission_schema.type)>=0 && freezr_db.fieldNameIsPermitted(allUserPermissions[i],app_config_permission_schema,permission_attributes.field_name) ) {
                                usersWhoGrantedAppPermission.push({'_creator':allUserPermissions[i]._creator});
                            } else if (app_config_permission_schema.type=="db_query" && freezr_db.queryIsPermitted(allUserPermissions[i],app_config_permission_schema,req.body)) {
                                // Note: Currently no field permissions in db_query
                                usersWhoGrantedAppPermission.push({'_creator':allUserPermissions[i]._creator});
                            } 

                            /* else {
                                helpers.warning("app_handler - "+req.params.requestor_app, exports.version, "error? - permission changed and no longer permitted for "+allUserPermissions[i]._creator)
                            }*/
                    }
                }
            }
            if (own_record || (usersWhoGrantedAppPermission.length>0)) {
                cb(null)
            } else {
                cb(app_auth_err("No users have granted permissions"));
            }

        },

        // 5. get collection 
        function (cb) {
            //onsole.log("db query getting collection "+permission_collection_name+" in "+req.params.requestor_app)
            if (permission_collection_name) { // ie app_config_permission_schema.type=="field_delegate" or app_config_permission_schema.type=="object_delegate"
                freezr_db.app_db_collection_get("info_freezr_permissions" , permission_collection_name, cb);
            } else {
                cb(null, null)
            }
        },

        // 7. find field permissions
        function (theCollection, cb) {
            permissionCollection = theCollection;
            if (permission_collection_name && usersWhoGrantedAppPermission && usersWhoGrantedAppPermission.length>0){ 
                var permissionQuery = {'$and':[{'$or':usersWhoGrantedAppPermission},
                                                permission_attributes
                                                ]}
                //onsole.log("getting permissions type"+app_config_permission_schema.type+" permissionQuery "+JSON.stringify(permissionQuery))
                if (app_config_permission_schema.type=="field_delegate") {
                    permissionCollection.find(permissionQuery).toArray(cb);
                } else if (app_config_permission_schema.type=="object_delegate"){
                    var skip =  0, 
                        sort = {'_date_Modified': -1};
                        permissionCollection.find(permissionQuery).sort(sort).skip(skip).toArray(cb);

                } else if (app_config_permission_schema.type=="db_query") {
                    if (usersWhoGrantedAppPermission.length>0) {
                        cb(null, [])
                    } else {
                        cb(app_err("no permission granted"));
                    }
                } else {
                    // shouldnt be here
                    cb(null, []);
                }
            } else { 
                cb(null, []);
            }
        },

        // 8. Add creators to usersWhoGrantedFieldPermission list
        function (allUserFieldPermissions, cb) {
            //onsole.log("got field permission list "+JSON.stringify(allUserFieldPermissions));
            if (!permission_collection_name) {
                usersWhoGrantedFieldPermission = usersWhoGrantedAppPermission;
            } else if (allUserFieldPermissions && allUserFieldPermissions.length>0) {
                for (var i=0; i<allUserFieldPermissions.length; i++) {
                    if (app_config_permission_schema.type=="field_delegate") {
                        usersWhoGrantedFieldPermission.push({'_creator':allUserFieldPermissions[i]._creator});
                    } else if (app_config_permission_schema.type=="object_delegate") {
                        objectsPermittedList.push({'_id':freezr_db.real_id(allUserFieldPermissions[i].data_object_id,app_config,collection_name) });
                    } 
                }
            }
            cb(null);
        },

        // 9. Open relevant collection
        function (cb) {
            var collection_name = collection_name = req.body.collection? req.body.collection : (app_config_permission_schema && app_config_permission_schema.type=="folder_delegate")? "files": (app_config_permission_schema && app_config_permission_schema.collection)? app_config_permission_schema.collection:(app_config_permission_schema && app_config_permission_schema.collections)? app_config_permission_schema.collections[0]:null;
            if (own_record && !collection_name) collection_name = 'main';
            if (collection_name) {
                //onsole.log("Querying coll "+collection_name+" in app "+permission_attributes.requestee_app.replace(/\./g,"_"));
                freezr_db.app_db_collection_get(permission_attributes.requestee_app.replace(/\./g,"_") , collection_name, cb);
            } else {
                cb(app_err("missing collection_name"));
            }
        },

        // 10. do query on collection
        function (theCollection, cb) {
            var query_params = req.body.query_params;
            if (!query_params) query_params = {};

            if (app_config_permission_schema && (app_config_permission_schema.type=="folder_delegate" || app_config_permission_schema.type=="field_delegate")) {
                query_params[permission_attributes.field_name] = permission_attributes.field_value;
            }
            if (!query_params || Object.keys(query_params).length==0) {
                query_params = {'$or':usersWhoGrantedFieldPermission};
            } else {
                query_params = {'$and':[ {'$or':usersWhoGrantedFieldPermission}, query_params]};
            }

            if (app_config_permission_schema && app_config_permission_schema.type=="object_delegate") {
                query_params.$and.push({'$or':objectsPermittedList});
            }

            //onsole.log("permission_attributes is "+JSON.stringify(permission_attributes));
            //onsole.log("query_params is "+JSON.stringify(query_params));

            var skip = req.body.skip? parseInt(req.body.skip): 0, 
                count= req.body.count? parseInt(req.body.count):((app_config_permission_schema && app_config_permission_schema.max_count)? app_config_permission_schema.max_count: 50);
            if (app_config_permission_schema && app_config_permission_schema.max_count && count+skip>app_config_permission_schema.max_count) {count = Math.max(0,app_config_permission_schema.max_count-skip);}

            var sort = {};
            if (req.body.sort_field) {
                sort[req.body.sort_field] = req.body.sort_direction? parseInt(sort_direction):-1;
            } else if (app_config_permission_schema && app_config_permission_schema.sort_fields) {
                sort = app_config_permission_schema.sort_fields;
            } else {
                sort =  {'_date_Modified': -1}
            }
            //onsole.log("query_params for permitted fields "+JSON.stringify(query_params)+" count "+count+" skip "+skip+" sort "+JSON.stringify(sort));

            theCollection.find(query_params)
                .sort(sort)
                .limit(count)
                .skip(skip)
                .toArray(cb);

        },

        // 11. parse to send only the permitted return fields and anonimyze as necessary
        function (results, cb) {
            var returnArray = [], aReturnObject={};

            for (var i= 0; i<results.length; i++) {
                if (!app_config_permission_schema || !app_config_permission_schema.return_fields || app_config_permission_schema.return_fields.length==0) {
                    aReturnObject = results[i];
                } else {
                    aReturnObject = {};
                    for (j=0; j<app_config_permission_schema.return_fields.length;j++) {
                        aReturnObject[app_config_permission_schema.return_fields[j]] = results[i][app_config_permission_schema.return_fields[j]];
                    }
                }
                if (aReturnObject._creator && results[i].anonymously) {
                    aReturnObject._creator="_Anonymous_";
                }
                returnArray.push(aReturnObject);
            }
            cb (null, returnArray);
        }


    ], 
    function (err, results) {
        if (err) {
            helpers.send_failure(res, err, "app_handler", exports.version, "db_query");
        } else {
            //onsole.log("results to send for query "+JSON.stringify(results));
            helpers.send_success(res, {'results':results});
        }
    });
}

// permission access operations
exports.setObjectAccess = function (req, res) {
    // After app-permission has been given, this sets or updates permission to access a record
    //app.put('/v1/permissions/setobjectaccess/:requestor_app/:source_app_code/:permission_name', userDataAccessRights, app_hdlr.setObjectAccess);
    //'action': 'grant' or 'deny' // default is grant
    //'data_object_id': 
    // can have one of:  'shared_with_group':'logged_in' or 'self' or 'public'
    // 'requestee_app': app_name (defaults to self)
    // todo this could be merged with setFieldAccess
    
    var dbCollection, permission_collection;
    var app_config = helpers.get_app_config(req.params.requestor_app);
    var permission_model= (app_config && app_config.permissions && app_config.permissions[req.params.permission_name])? app_config.permissions[req.params.permission_name]: null;
    var permission_type = (permission_model && permission_model && permission_model.type)? permission_model.type: null;
    var requestee_app = req.body.requestee_app? req.body.requestee_app: req.params.requestor_app; 
    var collection_name = req.body.collection? req.body.collection: ((permission_model && permission_model.collections && permission_model.collections.length>0)? permission_model.collections[0] : null);
    var data_object_id = req.body.data_object_id? req.body.data_object_id : null;
    var new_shared_with_user = req.body.shared_with_user? req.body.shared_with_user: null;
    var new_shared_with_group = new_shared_with_user? "user": (req.body.shared_with_group? req.body.shared_with_group: 'self');

    console.log("setObjectAccess for"+data_object_id+" grant/deny?"+JSON.stringify(req.body.action)+" perm: " +req.params.permission_name);

    var unique_object_permission_attributes =
            {   'requestor_app':req.params.requestor_app,
                'requestee_app':requestee_app,
                '_creator':req.session.logged_in_user_id,
                'permission_name':req.params.permission_name,
                'collection_name': collection_name,
                'data_object_id': data_object_id,
                'shared_with_group':new_shared_with_group,
                '_id':requestee_app+"_"+req.session.logged_in_user_id+"_"+data_object_id
            }
    if (new_shared_with_user) unique_object_permission_attributes.shared_with_user = new_shared_with_user;

    function app_err(message) {return helpers.app_data_error(exports.version, "putData", req.params.app_name, message);}

    async.waterfall([
        // 1. make sure all data exits
        function (cb) {
            if (!req.session.logged_in_user_id) {
                cb(helpers.auth_failure("app_handler", exports.version, "setObjectAccess", req.params.app_name, "Need to be logged in to access app"));
            } else if (!app_config){
                cb(app_err("Missing app_config"));
            } else if (!permission_model){
                cb(app_err("Missing permission"));
            } else if (!permission_type){
                cb(app_err("Missing permission type"));
            } else if (permission_type != "object_delegate"){
                cb(app_err("permission type mismatch"));
            } else if (helpers.permitted_types.groups_for_objects.indexOf(new_shared_with_group)<0 ){
                cb(app_err("invalid permission group"));
            } else if (!collection_name){
                cb(app_err("Missing collection"));
            } else if (!data_object_id){
                cb(app_err("Missing data_object_id"));
            } else if (!req.body.action){
                cb(app_err("Missing action (grant or deny)"));
            } else if (req.body.action && ["grant","deny"].indexOf(req.body.action)<0 ){
                cb(app_err("invalid field permission action :"+req.body.action));
            } else {
                cb(null);
            }
        },

        // 2. checkapp code (make sure the right app is sending data) and device_code (to make sure rights exist)
        function (cb) {
            freezr_db.check_app_code(req.session.logged_in_user_id, req.params.requestor_app, req.params.source_app_code, cb)
        },
        function (cb) {
            freezr_db.check_device_code_specific_session(req.session.device_code, req.session.logged_in_user_id, req.params.requestor_app, cb)
        },

        // 3. get app permissions 
        function(cb) {
            freezr_db.permission_by_creator_and_permissionName (req.session.logged_in_user_id, req.params.requestor_app, requestee_app, req.params.permission_name, cb)
        },

        // 4. check permission is granted and can authorize requested fields, and if so, get permission collection
        function (results, cb) {
            if (!results || results.length==0) {
                cb(helpers.error("permission does not exist"))
            }  else if (!results[0].granted) {
                cb(helpers.error("permission not granted yet"))
            }  else if (!results[0].collections || results[0].collections.length<0)  {
                cb(app_err("No collections sited in config file"))
            }  else if (results[0].collections.indexOf(collection_name) < 0)  {
                cb(app_err("bad collection_name"))
            } else {
                freezr_db.app_db_collection_get("info_freezr_permissions" , "object_permissions", cb);
            }
        },

        // 6. open or create db collection
        function (theCollection, cb) {
            permission_collection = theCollection;
            freezr_db.app_db_collection_get(requestee_app.replace(/\./g,"_") , collection_name, cb);
        },

        // 7. open object by id 
        function (theCollection, cb) {
            dbCollection = theCollection;
            var real_object_id = freezr_db.real_id(data_object_id,app_config,collection_name);
            dbCollection.find({'_id':real_object_id}).toArray(cb);
        },

        // 8. If object exists, get permission attributes
        function (results, cb) {
            if (results == null || results.length == 0) {
                cb(helpers.missing_data(data_object_id+"no such object"))
            } else if (results.length == 1 && results[0]._creator == req.session.logged_in_user_id) {
                permission_collection.find(unique_object_permission_attributes).toArray(cb)
            } else {
                cb(helpers.auth_failure("app_handler", exports.version, "setObjectAccess", req.params.app_name,"Cannot grant access to other people's objects"));
            }
        },

        // 9. write or update the results
        function (results, cb) {
            var newgrant = (!req.body.action || req.body.action == "grant")? true:false;

            if (results == null || results.length == 0) {
                unique_object_permission_attributes._date_Modified = new Date().getTime();
                unique_object_permission_attributes._date_Created = new Date().getTime();
                if (!newgrant) {
                    app_err("cannot remove a permission that doesnt exist");
                    cb(null); // Internal error which can be ignored as non-existant permission was being removed
                } else { // write new permission
                    unique_object_permission_attributes.granted = newgrant;
                    permission_collection.insert(unique_object_permission_attributes, { w: 1, safe: true }, cb);
                }
            } else if (results.length == 1) { // update existing perm
                if (results[0].granted && newgrant) {
                    cb(app_err("user already has permission"));
                } else if (!results[0].granted && !newgrant) {
                    cb(app_err("user did not have permission so cannot remove it"));
                } else {
                    var write = {};
                    write._date_Modified = new Date().getTime();
                    write.granted = newgrant

                    permission_collection.update({ _id: results[0]._id }, {$set : write}, {safe: true }, cb);
                }
            } else {
                cb(app_err("Can not update multiple objects retrieved - SNBH"));
            }
        }
    ], 
    function (err, final_object) {
        if (err) {
            helpers.send_failure(res, err, "app_handler", exports.version, "setObjectAccess");
        } else { // sending back data_object_id
            helpers.send_success(res, {'data_object_id':data_object_id});
        }
    });
}
exports.setFieldAccess = function (req, res) {
    // After app-permission has been given, this sets a field permission or updates it
    // app.put('/v1/permissions/setfieldaccess/:requestor_app/:source_app_code/:permission_name', userDataAccessRights, app_hdlr.setFieldAccess);
    // Options: 'action': 'grant' // default - can also be 'deny'
        //'field_name': 'albums', // field name of value
        //'field_value':'myVacationAlbum2014' // gives access to 
        // can have one of:  'shared_with_group':'logged_in' or 'shared_with_user':a user id 
        // 'requestee_app': app_name (defaults to self)

    var app_config = helpers.get_app_config(req.params.requestor_app);

    var permission_model= (app_config && app_config.permissions && app_config.permissions[req.params.permission_name])? app_config.permissions[req.params.permission_name]: null;

    var permission_type = (permission_model && permission_model && permission_model.type)? permission_model.type: null;
    var requestee_app = req.body.requestee_app? req.body.requestee_app: req.params.requestor_app; 

    var shared_with_user = req.body.shared_with_user? req.body.shared_with_user: null;
    var shared_with_group = shared_with_user? "user": (req.body.shared_with_group? req.body.shared_with_group: 'logged_in');

    var requested_field_name = req.body.field_name? req.body.field_name: null;
    if (!requested_field_name && permission_type) {
        if (permission_type=="folder_delegate") {
            requested_field_name = "_folder";
        } else if (permission_type=="field_delegate" && permission_model && permission_model.sharable_fields && permission_model.sharable_fields.length>0) {
            requested_field_name = permission_model.sharable_fields[0];
        }
    }
    var requested_field_value = req.body.field_value? req.body.field_value: ((permission_type=="folder_delegate" && permission_model.sharable_folders && permission_model.sharable_folders.length>0)? permission_model.sharable_folders[0]: null);

    var permission_collection;

    //onsole.log("setFieldAccess with perm"+req.params.permission_name+" requested_field_name" + requested_field_name+" requested_field_value" + requested_field_value+"  - - body:"+JSON.stringify(req.body));

    var flags = new Flags({'app_name':req.params.requestor_app});

    var unique_field_permission_attributes =
            {   'requestor_app':req.params.requestor_app,
                'requestee_app':requestee_app,
                '_creator':req.session.logged_in_user_id,
                'permission_name':req.params.permission_name,
                'field_name':requested_field_name, 
                'field_value':requested_field_value,
                'shared_with_group':shared_with_group
            }
            // note: collection is already defined in the app_config
    if (shared_with_user) unique_field_permission_attributes.shared_with_user = shared_with_user;
    var flags = new Flags({'app_name':req.params.requestor_app});

    function app_err(message) {return helpers.app_data_error(exports.version, "setFieldAccess", req.params.app_name, message);}
    function app_auth_err(message) {return helpers.auth_failure("app_handler", exports.version, "setFieldAccess", req.params.requestor_app,  message);}


    async.waterfall([
        // 1. make sure all data exits
        function (cb) {
            if (!req.session.logged_in_user_id) {
                cb(helpers.missing_data("Not logged in"));
            } else if (!app_config){
                cb(helpers.missing_data("app_config"));
            } else if (!permission_model){
                cb(helpers.missing_data("permission"));
            } else if (!permission_type){
                cb(helpers.missing_data("permission type"));
            } else if (["folder_delegate","field_delegate"].indexOf(permission_type)<0){
                cb(app_err("invalid permission type"));
            } else if (helpers.permitted_types.groups_for_fields.indexOf(shared_with_group)<0 ){
                cb(app_err("invalid permission group"));
            } else if (!requested_field_value || !requested_field_name){
                cb(app_err("missing field name / value / collection"));
            } else if (req.body.action && ["grant","deny"].indexOf(req.body.action)<0 ){
                cb(app_err("invalid field permission action :"+req.body.action));
            } else {
                cb(null);
            }
        },
        function (cb) {
            freezr_db.check_app_code(req.session.logged_in_user_id, req.params.requestor_app, req.params.source_app_code, cb)
        },
        function (cb) {
            freezr_db.check_device_code_specific_session(req.session.device_code, req.session.logged_in_user_id, req.params.requestor_app, cb)
        },

        // 3. get app permissions 
        function(cb) {
            freezr_db.permission_by_creator_and_permissionName (req.session.logged_in_user_id, req.params.requestor_app, requestee_app, req.params.permission_name, cb)
        },

        // 4. check permission is granted and can authorize requested fields, and if so, open db
        function (results, cb) {
            if (!results || results.length==0) {
                cb(app_auth_err("permission does not exist"))
            }  else if (!results[0].granted) {
                cb(app_auth_err("permission not granted yet"));
            } else if (!freezr_db.field_requested_is_permitted(results[0],requested_field_name, requested_field_value)) {
                cb(app_auth_err("app permission granted does not corresppnd to request"))
            } else {
                freezr_db.app_db_collection_get("info_freezr_permissions", "field_permissions", cb);
            }
        },

        // 5. open object ... make sure object doesn't already exist
        // combo of following fields should be unique: user, requstor app, requestee app, permission name, field_name, 'field_value'
        function (theCollection, cb) {
            permission_collection = theCollection;
            permission_collection.find(unique_field_permission_attributes).toArray(cb);
        },

        // 6. write or update the results
        function (results, cb) {

            if (results == null || results.length == 0) {
                var write = unique_field_permission_attributes;
                write._date_Modified = new Date().getTime();
                write.granted = (!req.body.action || req.body.action == "grant")? true:false;
                write._date_Created = new Date().getTime();
                permission_collection.insert(write, { w: 1, safe: true }, cb);
            } else if (results.length == 1) { // updating record
                var write = {};
                write._date_Modified = new Date().getTime();

                var newgrant = (!req.body.action || req.body.action == "grant")? true:false;
                if (newgrant != results[0].granted) {
                    flags.add('notes','Updated grant permission from '+results[0].granted+' to '+newgrant);
                    write.granted = newgrant; 
                    dbCollection.update({ _id: results[0]._id }, {$set : write}, {safe: true }, cb);
                } else {
                    cb(app_err("record was already updated"));
                }                
            } else {
                cb(helpers.internal_error("app_handler", exports.version, "setFieldAccess", req.params.requestor_app,  message+" - cant update if multiple objects retrieved - SNBH"));
            }
        },
    ], 
    function (err, final_object) {
        if (err) {
            helpers.send_failure(res, err, "app_handler", exports.version, "setFieldAccess");
        } else {
            helpers.send_success(res, {'flags':flags});
        }
    });
}
exports.getFieldPermissions = function (req, res) {
    //app.get('/v1/permissions/getfieldperms/:requested_type/:requestor_app/:source_app_code/', userDataAccessRights, app_hdlr.getFieldPermissions)
    // todo - note on slight hole to fill: if app permission has been denied after field permission was granted, the field permission still shows up here (if there was an error deleting it after denying the grant..)

    //onsole.log("getFieldPermissions "+req.url)
    var dbCollection;

    var requestee_app = req.query.requestee_app? req.query.requestee_app: req.params.requestor_app;

    var field_permission_attributes = {};
    if (req.query.permission_name) field_permission_attributes.permission_name = req.query.permission_name;
    if (req.query.collection) field_permission_attributes.collection = req.query.collection;
    if (req.query.field_name) field_permission_attributes.field_name = req.query.field_name;
    if (req.query.granted) field_permission_attributes.granted = (req.query.granted=="true");
    switch(req.params.requested_type) {
        case 'ihavegranted':
        // options: permission_name, collection, field_name, granted, field_value, shared_with_group, shared_with_user
            if (req.query.field_value) field_permission_attributes.field_value = req.query.field_value;
            if (req.query.shared_with_group) field_permission_attributes.shared_with_group = req.query.shared_with_group;
            if (req.query.shared_with_user) field_permission_attributes.shared_with_user = req.query.shared_with_user;
            field_permission_attributes._creator = req.session.logged_in_user_id;
            break;
        case 'ihaveccessto':
        // options: permission_name, collection, field_name, granted,  _creator
            field_permission_attributes.requestor_app = req.params.requestor_app;
            field_permission_attributes.$or = 
                    [{'shared_with_group': 'logged_in'},
                     {'shared_with_user' :  req.session.logged_in_user_id} ];
            if (req.query._creator) field_permission_attributes._creator = req.query._creator;
            break;
        default:
            field_permission_attributes = null;
    }

    async.waterfall([
        // 1. make sure all data exits
        function (cb) {
            if (!req.session.logged_in_user_id) {
                cb(helpers.missing_data("Not logged in"));
            } else if (!field_permission_attributes){
                cb(helpers.error("invalid request type"))
            } else {
                cb(null);
            }
        },


        // 2. checkapp code (make sure the right app is sending data) and device_code (to make sure rights exist)
        function (cb) {
            freezr_db.check_app_code(req.session.logged_in_user_id, req.params.requestor_app, req.params.source_app_code, cb)
        },
        function (cb) {
            freezr_db.check_device_code_specific_session(req.session.device_code, req.session.logged_in_user_id, req.params.requestor_app, cb)
        },

        // 3. get collection
        function (cb) {
            freezr_db.app_db_collection_get("info_freezr_permissions" , "field_permissions", cb);
        },

        // 3. find permissions
        function (theCollection, cb) {
            dbCollection = theCollection;
            dbCollection.find(field_permission_attributes).toArray(cb);
        },

    ], 
    function (err, results) {
        if (err) {
            helpers.send_failure(res, err, "app_handler", exports.version, "getFieldPermissions");
        } else {
            helpers.send_success(res, {'results':results});
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
                        if (requiredFieldNameList.indexOf(key)>-1) {
                            requiredFieldNameList.splice(requiredFieldNameList.indexOf(key),1)
                        }
                        if (!req.body.options.restoreRecord && reserved_field_name_list.indexOf(key)>-1) {
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

// NOT USED / EXTRA
    var make_sure_required_field_names_exist = function (params, data_model, cb) {
        // NOTE - Currently not used... can be used if want to have records point to other records... can be put in putData
        // checks the data model to see if there are requried referecne objects and make sure the refeenced objects actually exist
        // todo - Works with ONE ref object... need to expand it to multiple
        var ref_names = [];
        if (data_model && data_model.field_names) {
            for (key in data_model.field_names) {
                if (data_model.field_names.hasOwnProperty(key) && data_model.field_names[key].type=="data_object") {
                    ref_names.push(key);
                }
            }
        }
        if (ref_names.length == 0) {
            cb(null);
        } else {
            // TODO Need to loop through multiple references
            a_ref_name = ref_names[0];
            referenced_object_name = data_model.field_names[a_ref_name].referenced_object;
            ref_value = params[a_ref_name];

            db.collection(referenced_object_name, function(err, referenced_object){
                if (err) {
                    cb(helpers.app_data_error(exports.version, "make_sure_required_field_names_exist", "app name uknown","Could not get referenced object "+referenced_object_name+"from "+a_ref_name,""))
                } else {
                    referenced_object.find({ _id: ref_value }).toArray(function (err, results) {
                        if (err) {
                            cb(err);
                        } else if (results.length == 0) {
                            cb(helpers.app_data_error(exports.version, "make_sure_required_field_names_exist", "app name uknown","referenced object "+ref_value+" in collection "+referenced_object_name+" from key id "+a_ref_name));
                        } else if (results.length == 1) {
                            cb(null);
                        } else {
                            cb(helpers.app_data_error(exports.version, "make_sure_required_field_names_exist", "app name uknown","More than one result retuened for referenced object "+referenced_object_name+"from "+a_ref_name,""));
                        }
                    });

                }
            } );

        }
    }



