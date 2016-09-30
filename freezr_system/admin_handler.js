// freezr.info - nodejs system files - admin_handler.js
exports.version = "0.0.1";

var helpers = require('./helpers.js'),
    freezr_db = require("./freezr_db.js"),
    user_obj = require("./user_obj.js"),
    async = require('async'),
    fs = require('fs');

exports.generateAdminPage = function (req, res) {
    var initial_data = '', script_files=null; page_title= null;
    switch(req.params.sub_page) {
        case "list_users":
            page_title = "freezr.info - User list";
            initial_data = {'url':"/v1/admin/user_list.json"};
            break;
        case "register":
            script_files = ['/app_files/info.freezr.admin/admin_register.js'];
            page_title = "freezr.info - Register";
            break;
    }
    var options = {
        page_title: page_title? page_title: "Admin "+req.params.sub_page.replace('_',' ')+" (Freezr)",
        css_files: 'info.freezr.public/freezr_style.css',
        page_url: 'admin_'+req.params.sub_page+'.html',
        initial_data: initial_data,
        app_name: "info.freezr.admin",
        user_id:req.session.logged_in_user_id,
        user_is_admin:req.session.logged_in_as_admin,
        script_files: script_files,
        // Is this needed ( Dec 16)?
        other_variables: req.params.userid? ("var userid='"+req.params.userid+"';"):''
    } 
    helpers.load_page_skeleton(res, options);
};

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
exports.first_registration = function (req, res) {
    //onsole.log("first time register "+req.body.user_id+" ");
    var uid = freezr_db.user_id_from_user_input(req.body.user_id);
    var isAdmin = true;
    var register_type = "setUp";
    var config = require("../freezr_system/config.js");
    var db_main = require('../freezr_system/db_main.js');

    function send_1st_reg_auth_fail(message) {helpers.send_auth_failure(res, "admin_handler", exports.version,"first_registration",message); }

    if (config.params.freezr_is_setup)
        send_1st_reg_auth_fail("System is already initiated.");
    else if (!uid) 
        send_1st_reg_auth_fail("User id needed to initiate.");
    else if (!helpers.user_id_is_valid(uid))
        send_1st_reg_auth_fail("User id needed to initiate.");
    else if (!req.body.password)
        helpers.send_failure(res, helpers.missing_data("password"));
    else {
        config.params.freezr_is_setup = true;
        config.params.first_user = uid;

        fs.writeFile("./freezr_system/config.js", "exports.params=" + JSON.stringify(config.params), function(err) {
            if(err) {
                helpers.send_internal_err_failure(res, "admin_handler", exports.version,"first_registration","failrure to write - "+err);
            } else {
                try {
                    delete require.cache[require.resolve('../freezr_system/config.js')]
                } catch (e) {
                    send_internal_err_failure(res, "admin_handler", exports.version,"first_registration","Could not renew cache and did not initiate db - err:"+e);
                }

                db_main.init_admin_db(true, function (err, results) {
                    if (err) {
                        var theErr = helpers.internal_error("admin_handler", exports.version,"first_registration","Database is not available. Make sure you have MongoDb running. You may need to re-initiate the et up process by removing the database and changing the config.js file.");
                        helpers.send_failure(res, theErr, "admin_handler", exports.version, "init_admin_db" )
                    } else {
                        freezr_db.add_user(uid, req.body.password, null, null, true, "_self_", function (err, user_json) {
                            if (err) {
                                helpers.send_internal_err_failure(res, "admin_handler", exports.version,"first_registration","failrure to add user to db - "+err);
                            } else {
                                var device_code = helpers.randomText(10);
                                freezr_db.set_or_update_user_device_code(device_code, req.body.user_id,  false, function (err, results) {
                                    if (err) {
                                        helpers.send_internal_err_failure(res, "admin_handler", exports.version,"first_registration","failrure to get a device code - "+err);
                                    } else {

                                        console.log("first_registration set cookie "+JSON.stringify(req.session));

                                            var u = new User(user_json);
                                            if (register_type=="setUp") {
                                                req.session.logged_in = true;
                                                req.session.logged_in_user_id = freezr_db.user_id_from_user_input(req.body.user_id);
                                                req.session.logged_in_date = new Date();
                                                req.session.logged_in_as_admin = u.isAdmin;
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
            helpers.send_internal_err_failure(res, "admin_handler", exports.version,"list_all_users","failrure to get all user list - "+err);
        } else {
            var out = [];
            if (results) {
                var temp = new User();
                for (var i = 0; i < results.length; i++) {
                    out.push(new User(results[i]).response_obj());
                }
            }
            helpers.send_success(res, {users: out });
        }
    });
};




