// freezr.info - nodejs system files - admin_handler.js
exports.version = "0.0.1";

var helpers = require('./helpers.js'),
    freezr_db = require("./freezr_db.js"),
    user_obj = require("./user_obj.js"),
    async = require('async'),
    fs = require('fs'),
    file_handler = require('./file_handler.js');

exports.generateAdminPage = function (req, res) {
    console.log(" generateAdminPage "+req.url)
    var initial_data = '', script_files=null; page_title= null, initial_data_func= null, page_url = null, other_variables=null;
    var isPublicPage = helpers.startsWith(req.url,"/admin/public")
    switch(req.params.sub_page) {
        case "list_users":
            page_title = "freezr.info - User list";
            initial_data = {'url':"/v1/admin/user_list.json"};
            initial_data_func = exports.list_all_users
            break;
        case "register":
            script_files = ['./info.freezr.admin/admin_register.js'];
            page_title = "freezr.info - Register";
            break;
        case "starterror": 
            page_title = "Fatal Error (Freezr)",
            script_files = ['./info.freezr.admin/public/admin_starterror.js'],
            other_variables = "var startup_errors = "+JSON.stringify(req.freezrStatus)
            break;
    }
    var options = {
        page_title: page_title? page_title: "Admin "+req.params.sub_page.replace('_',' ')+" (Freezr)",
        css_files: './info.freezr.public/freezr_style.css',
        page_url: (isPublicPage? "public/":"") + ('admin_'+req.params.sub_page+'.html'),
        initial_data: initial_data,
        app_name: "info.freezr.admin",
        user_id:req.session.logged_in_user_id,
        user_is_admin:req.session.logged_in_as_admin,
        script_files: script_files,
        other_variables: other_variables? other_variables : (req.params.userid? ("var userid='"+req.params.userid+"';"):'')
    }
    if (!initial_data_func || isPublicPage) {
        file_handler.load_data_html_and_page(res,options)
    } else {
        req.freezrInternalCallFwd = function(err, results) {
            if (err) {
                options.success = false;
                options.error = err;
            } else {
                options.queryresults = results;
            }
            file_handler.load_data_html_and_page(res,options)
        }
        initial_data_func(req,res);
    }
}

exports.register = function (req, res) {
    //onsole.log("Registering "+req.body.user_id);
    var uid = freezr_db.user_id_from_user_input(req.body.user_id);
    var em = req.body.email_address;
    var fn = req.body.full_name;
    var isAdmin = req.body.isAdmin =="true";
    var register_type = req.body.register_type;
    function register_auth_error(message) {return helpers.auth_failure("admin_handler.js",exports.version,"register",message)}
    async.waterfall([    
        function (cb) {
            if (req.session && req.session.logged_in_as_admin && register_type=="normal") {
                cb(null);
            } else if (!register_type) {
                cb(register_auth_error("Missing register type"));
            } else {
                cb(register_auth_error("Missing Admin preivelages"));
            }
        },

        function (cb) {
            if (em && !helpers.email_is_valid(em))
                cb(helpers.invalid_email_address());
            else if (!uid) 
                cb(register_auth_error("Missing user id"));
            else if (!helpers.user_id_is_valid(uid))
                cb(register_auth_error("Invalid user id"));
            else if (!req.body.password)
                cb(register_auth_error("Missing password"));
            else
                cb(null);
        },


        // 2. check if person already exists
        function (cb) {
            exports.make_sure_user_is_unique(uid, em, cb);
        },

        function (field_is_clear, arg2, cb) {
            if (field_is_clear) {
                cb(null)
            } else {
                cb(register_auth_error("name or email address exists") );
            }
        },

        // 3. register the user.
        function (cb) {
            var creator = register_type=="normal"? req.session.logged_in_user_id: "_self_";
            freezr_db.add_user(uid, req.body.password, em, fn, isAdmin, creator, cb);
        }
    ],
    function (err, user_json) {
        if (err) {
            helpers.send_failure(res, err,"admin_handler", exports.version,"register");
        } else {
            var u = new User(user_json);
            helpers.send_success(res, {user: u.response_obj() });
        }
    });
};

validExternalDbParams = function(params){
    console.log("CHECK PARAMS need to todo now")
    return true;
} 
exports.first_registration = function (req, res) {
    //onsole.log("first time register "+req.body.user_id+" ");
    var uid = freezr_db.user_id_from_user_input(req.body.user_id);
    var isAdmin = true;
    var register_type = "setUp";

    var db_main = require('../freezr_system/db_main.js');

    function send_1st_reg_auth_fail(message, errCode) {helpers.send_auth_failure(res, "admin_handler", exports.version,"first_registration",message, errCode); }

    var init;
    var freezr_environment;
    
    if (req.freezr_environment.freezr_is_setup) {
        send_1st_reg_auth_fail("System is already initiated.", "auth-initedAlready");
    } else if (!uid) 
        helpers.send_failure(res, helpers.missing_data("user id"));
    else if (!helpers.user_id_is_valid(uid))
        send_1st_reg_auth_fail("Valid user id needed to initiate.","auth-invalidUserId");
    else if (!req.body.password)
        helpers.send_failure(res, helpers.missing_data("password"));
    else if (req.body.externalDb && !validExternalDbParams(req.body.externalDb) )
        send_1st_reg_auth_fail("Database parameters are not correct","auth-invalidDbParams");
    else if (req.body.unifiedDbName && !helpers.valid_unify_db_name(req.body.unifiedDbName) )
        send_1st_reg_auth_fail("Unfiied db name is invalid","auth-invalidUnifiedDbName");
    else {
        // first re-test ability to write files
        fs.writeFile(file_handler.systemPathTo("test_write.txt"), "Re-Testing write on server", function(err) {
            if(err) {
                helpers.send_internal_err_failure(res, "admin_handler", exports.version,"first_registration","failrure to write - "+err);
            } else {
                // check if users exist in db - if so, registration shouldn't be allowed - extra precaution
                // db_main.check_admin_db_with_new_params(req.body.externalDb, function (err, results)
                // actually do a set_dbenv in db_main
                freezr_environment = freezr_db.setTemporaryFreezrEnvDbParams(req.body.externalDb, req.body.unifiedDbName);

                freezr_db.init_admin_db(function (err, results) { // in case it has not been inited (and to make sure it exists upon)
                    if (err) {
                        if (req.body.externalDb) freezr_db.setTemporaryFreezrEnvDbParams(null);
                        helpers.send_internal_err_failure(res, "admin_handler", exports.version,"first_registration","Database is not available. Make sure you have MongoDb running.",err);
                    } else {
                        freezr_db.all_users("_date_Modified", true, 0, null, function (err, results) {
                            if (err) {
                                if (req.body.externalDb) freezr_db.setTemporaryFreezrEnvDbParams(null);
                                helpers.send_internal_err_failure(res, "admin_handler", exports.version,"first_registration","Database is not available.",err);
                            } else if (results && results.length>0) {
                                if (req.body.externalDb) {freezr_db.setTemporaryFreezrEnvDbParams(null);} else {console.log("no external db after err "+JSON.stringify(req.body.externalDb))}
                                console.log("error ? too many results - re-initing and setting ")
                                freezr_db.init_admin_db(function(err) {
                                    send_1st_reg_auth_fail("freezr is already set up with users. You cannot re-initiate it with new users.","auth_alreadySetup")
                                })
                            } else {
                                freezr_db.add_user(uid, req.body.password, null, null, true, "_self_", function (err, user_json) {
                                    // valid_unique_user_id, password, valid_email, full_name, isAdmin, creator, callback
                                    if (err) {
                                        helpers.send_internal_err_failure(res, "admin_handler", exports.version,"first_registration","failrure to add user to db - "+err);
                                    } else {
                                        var device_code = helpers.randomText(10);
                                        freezr_db.set_or_update_user_device_code(device_code, req.body.user_id,  false, function (err, results) {
                                            if (err) {
                                                helpers.send_internal_err_failure(res, "admin_handler", exports.version,"first_registration","failrure to get a device code - "+err);
                                            } else {
                                                freezr_environment.freezr_is_setup=true;
                                                freezr_environment.first_user = uid;
                                                freezr_environment.written=true;
                                                fs.writeFile(file_handler.systemPathTo("freezr_environment.js", false, freezr_environment), "exports.params=" + JSON.stringify(freezr_environment), function(err) {
                                                    if(err) {
                                                        helpers.send_internal_err_failure(res, "admin_handler", exports.version,"first_registration","SERIOUS failure to write init file - "+err);
                                                    } else {
                                                        file_handler.resetFreezrEnvironment();
                                                        console.log("first_registration done - setting cookie ");
                                                        var u = new User(user_json);
                                                        if (register_type=="setUp") {
                                                            req.session.logged_in = true;
                                                            req.session.logged_in_user_id = freezr_db.user_id_from_user_input(req.body.user_id);
                                                            req.session.logged_in_date = new Date();
                                                            req.session.logged_in_as_admin = true;
                                                            req.session.device_code = device_code;
                                                        }
                                                        helpers.send_success(res, {user: u.response_obj() });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }); 
    }
};

exports.make_sure_user_is_unique = function (user_id, email_address, callback) {
    async.waterfall([
        function (cb) {
            if (user_id) {
                freezr_db.user_by_user_id(user_id, cb);
            } else {
                cb(null, null, cb);
            }
        }, 

        function (user, arg2, cb) {
            if (user) {
                cb(helpers.auth_failure("admin_handler", exports.version, "make_sure_user_is_unique", "user id already exists" ));
            } else {
                cb(null, null, cb);
            }
        }, 

        function (user, arg2, cb) {
            if (user) {
                cb(helpers.auth_failure("admin_handler", exports.version, "make_sure_user_is_unique", "email already exists") );
            } else {
                cb(null, null, cb);
            }
        }
    ],
    function (err, exists) {
        if (err) {
            callback(err, false, callback)
        } else {
            callback(null, !exists, callback)
        }
    });    
}

exports.list_all_users = function (req, res) {
    freezr_db.all_users("_date_Modified", true, 0, null, function (err, results) {
        if (err) {
            helpers.send_internal_err_failure(res, "admin_handler", exports.version,"list_all_users","failure to get all user list - "+err);
        } else {
            var out = [];
            if (results) {
                var temp = new User();
                for (var i = 0; i < results.length; i++) {
                    out.push(new User(results[i]).response_obj());
                }
            }
            if (req.freezrInternalCallFwd) {
                req.freezrInternalCallFwd(null, {users: out})
            } else {
                helpers.send_success(res, {users: out });
            }
        }
    });
};




