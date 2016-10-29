// freezr.info - nodejs system files - account_handler
exports.version = "0.0.1";

var helpers = require('./helpers.js'),
    freezr_db = require("./freezr_db.js"),
    user_obj = require("./user_obj.js"),
    async = require('async'),
    flags_obj = require("./flags_obj.js"),
    fs = require('fs');


exports.generate_login_page = function (req, res) {
    // '/account/login' or '/account/applogin/login/:app_name'

    console.log("generate_login_page accounts login with url "+JSON.stringify(req.url)+" params are "+JSON.stringify(req.params));
    if (req.session && req.session.logged_in_user_id && req.url=='/account/login')  {
        res.redirect("/account/home");
    } else {
        var options = {
            page_title: (req.params.app_name? "Freezr App Login for "+req.params.app_name : " Login (Freezr)"),
            css_files: 'info.freezr.public/freezr_style.css',
            initial_data: null, 
            server_name: req.protocol+"://"+req.get('host'),
            app_name: (req.params.app_name? req.params.app_name:"info.freezr.account"),
            other_variables: "var login_for_app_name="+(req.params.app_name? ("'"+req.params.app_name+"';"):"null")+";" + " var loginAction = "+(req.params.loginaction? ("'"+req.params.loginaction+"';"):"null")+";"
        } 
        if (!req.freezr_is_setup) {
            options.page_title = "Freezr Set Up";
            options.page_url= 'info.freezr.public/admin_firstSetUp.html';
            options.script_files = ['/app_files/info.freezr.public/admin_firstSetUp.js'];
            
            helpers.load_page_skeleton(res, options);

        } else {

            freezr_db.all_users("_date_Created", true, 0, null, function (err, results) {
                if (err) {
                    helpers.send_failure(res, err,"account_handler", exports.version,"generate_login_page");
                } else {
                    if (!req.session.device_code) {
                        req.session.device_code = helpers.randomText(10);
                        // todo later - Record device code below async-ly and keep track of all attempts to access 
                    }
                    if (results && results.length>0) {
                        options.page_url='info.freezr.public/account_'+(req.params.app_name?'app':'')+'login.html';
                        options.script_files = ['/app_files/info.freezr.public/account_login.js'];
                        helpers.load_page_skeleton(res, options);
                    } else {
                        helpers.send_failure(res, helpers.error("db failed","Could not find any users in the database. If this is your first time setting up the system, you will have to delete the database, and replace the contents of the configjs file with the contents of config uninitated.js, and try again. If this is not your first time - hmmm - this is a very serious error."),"account_handler", exports.version,"generate_login_page");
                    }
                }
            });
        }
    }
};
exports.generate_error_page = function (req, res) {
    // '/account/login' or '/account/applogin/login/:app_name'

    console.log("generate_error_page accounts login with url "+JSON.stringify(req.url)+" startup_errors = "+JSON.stringify(req.freezr_fatal_error)+"'")
    var options = {
        page_title: "Fatal Error  (Freezr)",
        server_name: req.protocol+"://"+req.get('host'),
        page_url: 'info.freezr.public/admin_fatalError.html',
        app_name: "info.freezr.account",
        script_files : ['/app_files/info.freezr.public/admin_fatalError.js'],
        other_variables: "var startup_errors = "+JSON.stringify(req.freezr_fatal_error)
    } 
    helpers.load_page_skeleton(res, options);
};
exports.generate_applogin_results = function (req, res) {
    // /account/applogin/results
    //onsole.log("accounts generate_applogin_results params are "+JSON.stringify(req.params));
    var options = {
        page_title: "Freezr App Login Results (Freezr)",
        css_files: 'info.freezr.public/freezr_style.css',
        initial_data: null,
        app_name: "info.freezr.account",
        other_variables: null,
        server_name : req.protocol+"://"+req.get('host'),
        page_url:'info.freezr.public/blankHtml.html',
        script_files: null
    } 
    helpers.load_page_skeleton(res, options);
};
var accountPage_Config = { // config parameters for accounts pages
    'home': {
        page_title: "Accounts Home (Freezr)",
        css_files: ['info.freezr.public/freezr_style.css', 'account_home.css'],
        page_url: 'account_home.html',
        app_name: "info.freezr.account",
        script_files: ['/app_files/info.freezr.account/account_home.js']
    }, 
    'changepassword': {
        page_title: "Change Password (freezr)",
        css_files: 'info.freezr.public/freezr_style.css',
        page_url: 'account_changepassword.html',
        script_files: ['/app_files/info.freezr.account/account_changepassword.js']
    }, 
    'app_management': {
        page_title: "Apps (freezr)",
        css_files: ['info.freezr.public/freezr_style.css', 'account_app_management.css'],
        page_url: 'account_app_management.html',
        initial_data: {'url':'/account/v1/app_list.json'},
        script_files: ['/app_files/info.freezr.account/account_app_management.js']
    },
    'autoclose': {
        page_title: "Autoclose tab (freezr)",
        page_url: 'account_autoclose.html',
        script_files: ['/app_files/info.freezr.account/account_autoclose.js']
    }
}
exports.generateAccountPage = function (req, res) {
    // /account/:sub_page
    console.log("generateAccountPage: "+req.url+" "+req.params.sub_page+JSON.stringify(req.params));
    if (!req.params.sub_page) {req.params.sub_page="home"} else {req.params.sub_page= req.params.sub_page.toLowerCase();}
 
    if (accountPage_Config[req.params.sub_page]) {
        var options = accountPage_Config[req.params.sub_page];
        options.app_name = "info.freezr.account";
        options.user_id =req.session.logged_in_user_id;
        options.user_is_admin =req.session.logged_in_as_admin;
        options.server_name = req.protocol+"://"+req.get('host');
        helpers.load_page_skeleton(res, options);
    } else {
        res.redirect("/account/home");
    }
};

// USER MANAGEMENT
exports.login = function (req, res) {
    // /v1/account/login 
    // "/v1/account/applogin"
    //onsole.log("login req host:"+req.hostname+" url"+req.url+" baseUrl "+req.baseUrl+" BODY "+JSON.stringify(req.body));
    var user_id = (req.body && req.body.user_id)? freezr_db.user_id_from_user_input(req.body.user_id): null;
    var source_app_code = null;

    async.waterfall([
        function (cb) {
            if (!user_id)
                cb(helpers.auth_failure("account_handler.js",exports.version,"login","Missing user id"));
            else if (!helpers.user_id_is_valid(user_id) )
                cb(helpers.auth_failure("account_handler.js",exports.version,"login","invalid user id"));
            else if (!req.body.password)
                cb(helpers.auth_failure("account_handler.js",exports.version,"login","Missing password"));
            else if (req.url=="/v1/account/applogin"  && !req.body.login_for_app_name)
                cb(helpers.auth_failure("account_handler.js",exports.version,"login","Trying to do general login via an app login interface."));
            else
                cb(null);
        },

        // 1. get user_id
        function (cb) {
            freezr_db.user_by_user_id(user_id, cb);
        },

        // 2. check the password
        function (user_json, dummy_cb, cb) {
            var u = new User(user_json);

            if (u.check_passwordSync(req.body.password)) {
                req.session.logged_in = true;

                req.session.logged_in_user_id = freezr_db.user_id_from_user_input(req.body.user_id);
                req.session.logged_in_date = new Date();
                req.session.logged_in_as_admin = u.isAdmin;

                if (req.body.login_for_app_name) {
                    req.session.login_type = "app";
                } else {
                    req.session.login_type = "all";
                }

                cb(null);

            } else {
                cb(helpers.auth_failure("account_handler.js",exports.version,"login","Wrong password"));
            }
        },

        // 3. Set or update device code
        function (cb) {
            freezr_db.set_or_update_user_device_code(req.session.device_code, user_id,  req.body.login_for_app_name, cb)
        },

        // 4. get an app_code (used for app_specific login only)
        function(results, cb) {
            if (req.body.login_for_app_name) {
                freezr_db.get_user_app_code(user_id, req.body.login_for_app_name, cb)
            } else {
                cb(null, null)
            }

        }

    ],
    function (err, source_app_code) {
        if (!err) {
            helpers.send_success(res, { logged_in: true , "login_for_app_name":req.body.login_for_app_name, 'source_app_code':source_app_code, 'user_id':user_id});
        } else {
            helpers.send_failure(res, err,"account_handler", exports.version,"login");
        }
    });
};
exports.ping = function (req, res) {
    // /v1/account/ping/app_name
    if (!req.session.logged_in_user_id) {
        helpers.send_success(res, { logged_in: false});
    } else{
        helpers.send_success(res, { logged_in: true, 'logged_in_as_admin':req.session.logged_in_as_admin, 'user_id':req.session.logged_in_user_id, 'freezr_server_version':req.freezr_server_version});
    } 
};
exports.logout = function (req, res) {
    req.session.logged_in = false;
    req.session.logged_in_user_id = null;
    req.session.logged_in_date = null;
    req.session.logged_in_as_admin = false; 
    helpers.send_success(res, { 'logged_out': true });
}

exports.logout_page = function (req, res) {
    // /account/logout
    req.session.logged_in = false;
    req.session.logged_in_user_id = null;
    req.session.logged_in_date = null;
    req.session.logged_in_as_admin = false; 

    res.redirect("/account/login");
}

exports.changePassword = function (req, res) {
    // /v1/account/changePassword.json
    //onsole.log("Changing password  "+JSON.stringify(req.body));

    var user_id = req.body.user_id;
    async.waterfall([
        function (cb) {
            if (!user_id)
                cb(helpers.auth_failure("account_handler.js",exports.version,"changePassword","Missing user id"));
            else if (!req.body.oldPassword)
                cb(helpers.auth_failure("account_handler.js",exports.version,"changePassword","Missing old password"));
            else if (!req.body.newPassword)
                cb(helpers.auth_failure("account_handler.js",exports.version,"changePassword","Missing new password"));
            else
                cb(null);
        },

        // 1. get user record
        function (cb) {
            freezr_db.user_by_user_id(user_id, cb);
        },

        // 2. check the password
        function (user_json, dummy_cb, cb) {
            var u = new User(user_json);
            if (u.check_passwordSync(req.body.oldPassword)) {
                cb(null);
            } else {
                cb(helpers.auth_failure("account_handler.js",exports.version,"changePassword","Wrong password"));
            }
        },

        // 3. change pw for the user.
        function (cb) {
            freezr_db.changeUserPassword(
                req.body.user_id,
                req.body.newPassword,
                cb);
        }
    ],
    function (err, user_json) {
        if (err) {
            helpers.send_failure(res, err,"account_handler", exports.version,"changePassword");
        } else {
            var u = new User(user_json);
            helpers.send_success(res, {user: u.response_obj() });
        }
    });
};

// APP MANAGEMENT
exports.addAppManually = function (req, res) {
    // /v1/account/add_app_manually.json
    //onsole.log("ADDING MANUALLY "+req.body.appDomainName+" - "+req.body.appDisplayName);
    var user_id = req.body.user_id;
    async.waterfall([
        // 1. check basic data exists
        function (cb) {
            if (!user_id) 
                cb(helpers.missing_data("user_id"));
            else if (!req.body.appDomainName)
                cb(helpers.missing_data("appDomainName"));
            else if (!req.body.appDisplayName)
                cb(helpers.missing_data("appDisplayName"));
            else
                cb(null);
        },

        // 2. check if app already exists
        function (cb) {
            freezr_db.app_exists_in_db(req.body.appDomainName, cb);
        },

        // 3. stop if app already exists
        function (existing_apps, cb) {
            if (existing_apps && existing_apps>0) {
                cb(helpers.data_object_exists("apps"));
            } else {
                cb(null);
            }
        },

        // 4. Add App
        function (cb) {
            freezr_db.add_app(
                req.body.appDomainName,
                req.body.appDisplayName,
                user_id,
                cb);
        }
    ],
    function (err, user_json) {
        if (err) {
            helpers.send_failure(res, err,"account_handler", exports.version,"addAppManually");
        } else {
            var u = new User(user_json);
            helpers.send_success(res, {app_name: req.body.appDomainName });
        }
    });
};
exports.list_all_user_apps = function (req, res) {
    // /account/v1/app_list.json
    var user_id = req.session.logged_in_user_id;
    var removed_apps = [], user_apps = [], new_apps = [];
    var user_app_names = [], removed_app_names = [];
    async.waterfall([
        // 1. check basic data exists
        function (cb) {
            if (!user_id) 
                cb(helpers.missing_data("user_id"));
            else
                cb(null);
        },

        // 2. get all user apps, and add the names to the appropriate lists
        function(cb) {
            freezr_db.all_user_apps(user_id, null, true, 0, null, cb);
        },
        function(results, cb) {
            if (results && results.length>0) {
                for (var i =0; i<results.length; i++) {
                    if (results[i].removed) {
                        removed_app_names.push(results[i].app_name)
                    } else {
                        user_app_names.push(results[i].app_name);
                    }
                }
            }
            cb(null);
        },

        // 3. get all apps, and match the records to the right list
        function(cb) {
            freezr_db.all_apps(null, true, 0, null, cb);
        },
        function(results, cb) {
            if (results && results.length>0) {
                for (var i =0; i<results.length; i++) {
                    if (results[i].app_name == results[i].display_name) {results[i].display_name = results[i].display_name.replace(/\./g, '. ')}
                    if (removed_app_names.indexOf(results[i].app_name)>=0) {
                        removed_apps.push(results[i])
                    } else if (user_app_names.indexOf(results[i].app_name)>=0) {
                        user_apps.push(results[i])
                    } else {
                        new_apps.push(results[i]);
                    }
                }
            }
            cb(null);
        }
    ],
    function (err, user_json) {
        if (err) {
            helpers.send_failure(res, err,"account_handler", exports.version,"list_all_user_apps");
        } else {
            var u = new User(user_json);
            helpers.send_success(res, {removed_apps:removed_apps, user_apps:user_apps, new_apps:new_apps});
        }
    });
};
exports.appMgmtActions  = function (req,res) /* deleteApp updateApp */ {
    // /account/v1/appMgmtActions.json
    //onsole.log("At app actions "+JSON.stringify(req.body));
    var action = (req.body && req.body.action)? req.body.action: null;
    var app_name = (req.body && req.body.app_name)? req.body.app_name: null;
    var user_id = req.session.logged_in_user_id;
    
    if (action == 'removeApp') {
        if (user_id) {
            freezr_db.remove_user_app(user_id, app_name, function(feedback) { helpers.send_success(res, feedback)});
        } else {
            helpers.send_auth_failure(res, "account_handler", exports.version,"appMgmtActions","Could not remove app without user.");
        }
    } else if (action == 'deleteApp') {
        if (user_id) {
            // remove all data
            freezr_db.try_to_delete_app(user_id, app_name, function(err, feedback) { 
                if (err) {
                    helpers.send_internal_err_failure(res, "freezr_db", freezr_db.version, "try_to_delete_app", "Internal error trying to delete app. App was not deleted." ) 
                } else {
                    helpers.send_success(res, feedback)
                }
            });
        } else {
            helpers.send_auth_failure(res, "account_handler", exports.version,"appMgmtActions","Could not remove app without admin privelages.");
        }
    } else if (action == 'updateApp') {
        var flags = new Flags({'app_name':app_name});
        var app_config, app_path, app_display_name=null;

        async.waterfall([
            // updateApp 1. make sure data and file names exist
            function (cb) {
                if (!req.session.logged_in_user_id) 
                    cb(helpers.missing_data("user_id"));
                else if (!req.session.logged_in_as_admin)
                    helpers.auth_failure("account_handler", exports.version,"appMgmtActions","Could not update app without admin privelages.");
                else if (!app_name)
                    cb(helpers.invalid_data("missing app name", "account_handler", exports.version,"appMgmtActions"));
                else if (!helpers.valid_app_name(app_name))   
                    cb(helpers.invalid_data("app name: "+app_name, "account_handler", exports.version,"appMgmtActions"));
                else
                    cb(null);
            },

            // updateApp 2. Make sure app directory exists
            function (cb) {
                app_path = helpers.fullPathToAppFiles(app_name);
                if (fs.existsSync(app_path)) {
                    cb(null);
                } else {
                    cb(helpers.invalid_data("missing app: "+app_name, "account_handler", exports.version,"appMgmtActions"));
                }
            },

            // updateApp 3. Get and check app_config (populate app_display_name)
            function (cb) {
                if (fs.existsSync(app_path+"/app_config.js")) {
                    app_config = helpers.get_app_config(app_name);
                    if (app_config) {
                        flags = helpers.check_app_config(app_config, app_name, null, flags);
                        if (app_config.meta.app_display_name) app_display_name = app_config.meta.app_display_name;
                    } else {
                        flags.add('warnings','config_file_errors - no app_config')
                    }
                } else {
                    flags.add('notes','appconfig_missing');
                }
                if (!app_display_name) app_display_name = app_name;
                cb(null);
            }, 

            // 4. Go through files and Sensor the code
            function (cb) {
                helpers.sensor_app_directory_files(app_name, flags, cb);
            },

            // 5. see if app is already in db
            function (newflags, dummy, cb) { 
                if (newflags && Object.keys(newflags).length > 0) flags = newflags;
                freezr_db.get_app_info_from_db(app_name, cb);
            },

            // 6. If app already exists, flag it as an update
            function (app_info, cb) {
                if (app_info) {
                    flags.add('notes',"app_updated_msg");
                    flags.meta.didwhat = "updated";
                    if (app_info.display_name != app_display_name) {
                        // todo - should update display name
                        cb(null, null)
                    } else {
                        cb(null, null)
                    }
                } else {  //add to directory");
                    flags.meta.didwhat = "installed";
                    freezr_db.add_app(
                        app_name,
                        app_display_name,
                        req.session.logged_in_user_id,
                        cb);
                }
            },

            // 7. update permission records
            function(dummy, cb) {
                if (app_config) freezr_db.update_permission_records_from_app_config(app_config, app_name, user_id, flags, cb);
                else cb(null, flags)
            },
            function(newf2, cb) {
                flags= newf2;
                cb(null);
            }
        ],
        function (err) {
            flags.meta.app_name = app_name;
            if (err) {
                flags.add('errors','err_unknown',{'function':'appMgmtActions update', 'text':JSON.stringify(err)});
            } 
            helpers.send_success(res, flags.sentencify() );
        });

    } else {
        helpers.send_failure(res, err,"account_handler", exports.version,"appMgmtActions");

    }
}
exports.add_uploaded_app_zip_file = function (req, res) {
    // app.put ('/v1/account/upload_app_zipfile.json', requireUserRights, uploadAppZipFile); 
    //onsole.log("add_uploaded_app_zip_file body"+JSON.stringify(req.body));

    var AdmZip = require('adm-zip');
    var app_name, app_path, app_version=null; app_display_name=null;
    var flags = new Flags({});
 
    async.waterfall([
    // 1. make sure data and file names exist
        function (cb) {
            if (!req.session.logged_in_user_id) 
                cb(helpers.missing_data("user_id"));
            /*
            else if (!req.session.logged_in_as_admin)
                helpers.auth_failure("account_handler", exports.version,"add_uploaded_app_zip_file","Could not add apps without admin privelages.");
            */
            else if (!req.file)
                cb(helpers.missing_data("file","account_handler", exports.version, "add_uploaded_app_zip_file"));
            else if (!req.file.originalname)
                cb(helpers.missing_data("file name","account_handler", exports.version, "add_uploaded_app_zip_file"));
            else if (req.file.originalname.length<5 || req.file.originalname.substr(-4) != ".zip")
                cb(helpers.invalid_data("file name not zip: "+req.file.originalname, "account_handler", exports.version, "add_uploaded_app_zip_file"));
            else
                cb(null);
        },

    // 2. Make sure it is a zip file and extract the app_name
        function (cb) {
            var parts = req.file.originalname.split('.');
            if (helpers.endsWith(parts[(parts.length-2)],"-master")) parts[(parts.length-2)] = parts[(parts.length-2)].slice(0,-7);

            if (helpers.startsWith((parts[(parts.length-2)]),"_v_")) {
                app_version = parts[parts.length-2].slice(3);
                parts.splice(parts.length-2,2);
            } else {
                parts.splice(parts.length-1,1);
            }
            app_name = parts.join('.');
            app_name = app_name.split(' ')[0];
            flags = new Flags({'app_name':app_name,'didwhat':'installed'});

            cb(null);
        },

    // 3. Make sure app directory exists
        function (cb) {
            app_path = helpers.fullPathToAppFiles(app_name);
            if (fs.existsSync(app_path)) {
                cb(null);
            } else {
                fs.mkdir(app_path, cb);
            }
        },

    // 4. Extract Zip File Contents
        function (cb) {
            var zip = new AdmZip(req.file.buffer); //"zipfilesOfAppsInstalled/"+app_name);
            var zipEntries = zip.getEntries(); // an array of ZipEntry records
            var gotDirectoryWithAppName = false;
            
            zipEntries.forEach(function(zipEntry) {
                // This is for case of compressing with mac, which also includes the subfolder - todo: review quirks with windows
                if (zipEntry.isDirectory && zipEntry.entryName == app_name+"/") gotDirectoryWithAppName= true;
                if (zipEntry.isDirectory && zipEntry.entryName == req.file.originalname+"/") gotDirectoryWithAppName= true;
            });

            try { 
                if (gotDirectoryWithAppName) {
                    zip.extractEntryTo(app_name+"/", app_path, false, true);
                } else {
                    zip.extractAllTo(app_path, true);
                }
                cb(null)
            } catch ( e ) { 
                cb(helpers.invalid_data("error extracting from zip file "+JSON.stringify(e) , "account_handler", exports.version, "add_uploaded_app_zip_file"));
            }
        },

        // 5. Get and check app_config (populate app_version and app_display_name)
        function (cb) {
            if (fs.existsSync(app_path+"/app_config.js")) {
                var app_config = helpers.get_app_config(app_name);
                flags = helpers.check_app_config(app_config, app_name, app_version, flags);
                if (app_config) {
                    if (app_config.meta.app_display_name) app_display_name = app_config.meta.app_display_name;
                    if (!app_version && app_config.meta.app_version) app_version = app_config.meta.app_version;
                }
            } else {
                flags.add('notes','appconfig_missing');
            }
            if (!app_display_name) app_display_name = app_name;
            if (!app_version) app_version = 1;
            cb(null);
        }, 

        // 6. Go through files and Sensor the code
        function (cb) {
            helpers.sensor_app_directory_files(app_name, flags, cb);
        },

        // 7. See if app exists
        function (newflags, dummy, cb) {
            if (newflags && Object.keys(newflags).length > 0) flags = newflags;

            if (helpers.valid_app_name(app_name)) {    
                freezr_db.get_app_info_from_db(app_name, cb);
            } else {
                cb(helpers.invalid_data("app name: "+app_name, "account_handler", exports.version, "add_uploaded_app_zip_file"));
            }
        },

        // 8. If app already exists, flag it as an update
        function (app_info, cb) {
            if (app_info) {
                flags.add('notes',"app_updated_msg");
                flags.meta.didwhat = "updated (from uploaded files)";
                if (app_info.display_name != app_display_name) {
                    cb(null)
                } else {
                    cb(null)
                }
            } else {
                flags.meta.didwhat = "uploaded";

                freezr_db.add_app(
                    app_name,
                    app_display_name,
                    req.session.logged_in_user_id,
                    cb);
            }
        }
    ],
    function (err, user_json) {
        flags.meta.app_name = app_name;
        if (err) {
            // todo: perhaps delete the zip file
            flags.add('errors','err_unknown',{'function':'add_uploaded_app_zip_file', 'text':JSON.stringify(err)});
        }
        helpers.send_success(res, flags.sentencify() );
    });
}

// PERMISSSIONS
exports.changeNamedPermissions = function(req, res) {
    //app.put ('/v1/permissions/change/:requestee_app/:source_app_code', userDataAccessRights, account_handler.changePermissions); 
    console.log("changePermissions "+JSON.stringify(req.body));
    
    if (req.body.changeList && req.body.changeList.length==1 && req.body.changeList[0].permission_name && req.body.changeList[0].action && req.body.changeList[0].permission_object) {
        var permission_name = req.body.changeList[0].permission_name;
        var action = req.body.changeList[0].action;
        var permission_object = req.body.changeList[0].permission_object;

        var requestee_app = req.params.requestee_app;
        var requestor_app  = (permission_object && permission_object.requestor_app)? permission_object.requestor_app: requestee_app;
        
        var app_config=helpers.get_app_config(requestor_app);
        var app_config_permissions = (app_config && app_config.permissions && Object.keys(app_config.permissions).length > 0)? JSON.parse(JSON.stringify( app_config.permissions)) : null;
        var schemad_permission = freezr_db.permission_object_from_app_config_params(app_config_permissions[permission_name], permission_name, requestee_app, requestor_app);

        if (schemad_permission && schemad_permission.type == "folder_delegate") permission_object.collection="files";
            
        async.waterfall([
            // 1. Check all data needed exists 
            function (cb) {
                if (permission_name && (action && permission_object && requestor_app && requestee_app && (permission_object.collection || (schemad_permission && schemad_permission.type == "object_delegate" && permission_object.collections) )  || (schemad_permission && schemad_permission.type == "outside_scripts" && schemad_permission.script_url && helpers.startsWith(schemad_permission.script_url,"http") )  ) ) {
                    cb(null)
                } else {
                    cb(helpers.missing_data("permission related data"));
                } 
            },

            // 2. Check user App Code 
            function (cb) {
                freezr_db.check_app_code(req.session.logged_in_user_id, requestee_app, req.params.source_app_code, cb); 
            },

            // 3. get current permission record
            function (cb) {
                freezr_db.permission_by_creator_and_permissionName(req.session.logged_in_user_id, requestor_app, requestee_app, permission_name, cb);
                    //onsole.log("getting existing perm: req.session.logged_in_user_id:"+req.session.logged_in_user_id+", requestor_app:"+requestor_app+", requestee_app:"+requestee_app+", permission_name:"+permission_name)
            },

            // 4. Make sure of validity and update permission record
            function (results, cb) {
                if (results.length == 0) {
                    helpers.warning ("account_handler", exports.version, "changeNamedPermissions","SNBH - permissions should be recorded already via app_config set up");
                    freezr_db.create_query_permission_record(req.session.logged_in_user_id, requestor_app, requestee_app, permission_name, permission_object, action, cb);
                } else {
                    if (results.length > 1) {
                        freezr_db.deletePermission(results[1]._id, null);
                        helpers.internal_error ("account_handler", exports.version, "changeNamedPermissions","SNBH - more than 1 result");
                    }
            
                    if (schemad_permission && (action == "Accept" || action=="Deny" || action == null) ) {
                        freezr_db.updatePermission(results[0], action, schemad_permission, cb);
                    } else if (action == "Remove" && results[0].outDated) {
                        helpers.warning ("account_handler", exports.version, "changeNamedPermissions","ERM now REMOVED AS OUTDATED");
                        freezr_db.deletePermission(results[0]._id, cb);
                    } else {
                        cb(helpers.invalid_data("action must be 'Accept' or 'Deny' only - SNBH","account_handler", exports.version, "changeNamedPermissions"));
                    }
                }
            }
        ], 

        function (err, results) {
            if (err) {
                helpers.send_failure(res, err,"account_handler", exports.version,"changeNamedPermissions");
            } else {  
                helpers.send_success(res, {success: 'wrote record successfully', 'permission_name':permission_name  , 'buttonId':req.body.changeList[0].buttonId, 'action':action});
            }
        });

    } else {
        helpers.send_failure(res, helpers.invalid_data,("One request at a time can be accepted."),"account_handler", exports.version,"changeNamedPermissions"); // todo
    }
}
exports.all_app_permissions = function(req, res) {
    // app.get('/v1/permissions/getall/:requestee_app/:source_app_code', userDataAccessRights, account_handler.all_app_permissions);
    // Need to check requested permissions in app config against granted permissions
    // check by name and also make sure that it has not changed...

        var requestee_app = req.params.requestee_app;
        var returnPermissions = [], user_permissions_to_add=[], user_permissions_to_delete=[], user_permissions_changed=[];

        async.waterfall([
            // check app code
            function (cb) {
                freezr_db.check_app_code(req.session.logged_in_user_id, requestee_app, req.params.source_app_code, cb); 
            },

            // get all_userAppPermissions - 
            function (cb) {
                freezr_db.all_userAppPermissions(req.session.logged_in_user_id, requestee_app, cb);
            },

            function (all_userAppPermissions, cb) {
                // mini-hack for development only - in case app hasnt been registered or is updated offline, go to the app config to get the needs and check that they are all there and aer uptodate
                // Can remove this for non-developers
                var app_config=helpers.get_app_config(requestee_app);
                var app_config_permissions = (app_config && app_config.permissions && Object.keys(app_config.permissions).length > 0)? JSON.parse(JSON.stringify( app_config.permissions)) : null;
                var permission_name="", schemad_permission;

                for (var i=0; i<all_userAppPermissions.length; i++) {
                    aPermission = all_userAppPermissions[i];
                    permission_name = all_userAppPermissions[i].permission_name;

                    //onsole.log("app_config_permissions "+JSON.stringify(app_config_permissions));
                    
                    if (aPermission.requestor_app !=requestee_app) {
                        // Other apps have requested permission - just add them
                        // Need to check changes here.
                        returnPermissions.push(aPermission);
                    } else if (app_config_permissions && app_config_permissions[permission_name]) {
                        schemad_permission = freezr_db.permission_object_from_app_config_params(app_config_permissions[permission_name], permission_name, requestee_app)
                        if (freezr_db.permissionsAreSame(aPermission,schemad_permission)) {
                            returnPermissions.push(aPermission);
                        } else if (aPermission.granted){ // permissions generated but not the same
                            aPermission.granted = false;
                            aPermission.outDated = true;
                            returnPermissions.push(schemad_permission);
                            user_permissions_changed.push(schemad_permission);
                        } else if (aPermission.denied) { // aready denied so send the schemad_permission in case ser accepts
                            schemad_permission.denied = true;
                            returnPermissions.push(schemad_permission);
                        } else { // aready marked as changed so send the schemad_permission in case ser accepts
                            schemad_permission.denied = true;
                            returnPermissions.push(schemad_permission);
                        }
                        delete app_config_permissions[permission_name]; // delete from schemas so add unused ones later
                    } else {
                        // permission was granted but is no longer in app_config - this should not happen very often
                        user_permissions_to_delete.push(aPermission);
                        helpers.warning("account_handler", exports.version, "all_app_permissions", "permission was granted but is no longer in app_config - this should not happen very often "+JSON.stringify(aPermission));
                    }
                }
                // now add all the schemad queries which were not in the db 
                if (app_config_permissions) {            // AND ADD app_config_permissions has objects in it 
                    var newPermission={};
                    for (var key in app_config_permissions) {
                        if (app_config_permissions.hasOwnProperty(key)) {
                            newPermission = freezr_db.permission_object_from_app_config_params(app_config_permissions[key], key, requestee_app);
                            returnPermissions.push(newPermission);
                            user_permissions_to_add.push(newPermission);
                        }
                    }
                }
                cb(null)
            /* 
                TO DO Go through forEach of user_permissions_to_add user_permissions_to_delete user_permissions_changed and update the database... not necessary, but better, specially for deleting
            */
            }
        ], 
        function (err) {
            if (err) {
                helpers.send_failure(res, err,"account_handler", exports.version,"all_app_permissions"); // todo
            } else {  
                //onsole.log("all returnPermissions "+JSON.stringify(returnPermissions))
                helpers.send_success(res, returnPermissions);
            }
        });
}




