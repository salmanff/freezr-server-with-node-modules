// freezr.info - nodejs system files - db_main.js
exports.version = "0.0.1";

var async = require('async'),
    helpers = require('./helpers.js'),
    MongoClient = require('mongodb').MongoClient,
    file_handler = require('./file_handler.js');
var autoCloseTimeOut;
var freezr_environment = file_handler.existsSyncSystemAppFile(file_handler.systemPathTo("freezr_environment.js"))? require(file_handler.systemPathTo("freezr_environment.js")):null;
var custom_environment = file_handler.existsSyncSystemAppFile(file_handler.systemPathTo("custom_environment.js"))? require(file_handler.systemPathTo("custom_environment.js")):null;

var unifiedDb;

exports.dbConnectionString = function(appName) {
    if (!freezr_environment){
        var environment_defaults = require('./environment_defaults.js')
        freezr_environment = environment_defaults.autoConfigs();
    } 
    if (freezr_environment && freezr_environment.params && freezr_environment.params.dbParams && freezr_environment.params.dbParams.host && freezr_environment.params.dbParams.host=="localhost"  ) { 
        return 'localhost:27017/'+(freezr_environment.params.unifiedDbName? freezr_environment.params.unifiedDbName: appName);
    } else if (freezr_environment && freezr_environment.params && freezr_environment.params.dbParams) {
      return freezr_environment.params.dbParams.user + ":"+freezr_environment.params.dbParams.pass + "@"+freezr_environment.params.dbParams.host + ":"+freezr_environment.params.dbParams.port + "/"+ (freezr_environment.params.unifiedDbName? freezr_environment.params.unifiedDbName: appName) +(freezr_environment.params.dbParams.addAuth? '?authSource=admin':'');
    } 
    return null;
}

exports.resetFreezrEnvironment = function() {
    console.log("resettting environment")
    try {
        delete require.cache[require.resolve(file_handler.systemPathTo("./freezr_system/freezr_environment.js"))]
        freezr_environment = require(file_handler.systemPathTo("freezr_environment.js"));
        return true;
    } catch (e) {
        helpers.internal_error("db_main", exports.version, "resetFreezrEnvironment", "Serious Error resetting freezr environment. "+e )
        return false;
    }
}  

var nulify_admindb = function() {
    exports.users = null;
    exports.installed_app_list = null; // list of apps installed by users
    exports.user_devices = null; // set of device codes couples with user_names and whether it is an login_for_app_name login
    exports.user_installed_app_list = null; // contains data on "show_app_on_home_screen", "order_to_show" and "app_codes" 
    exports.permissions = null;
}

exports.setTemporaryFreezrEnvDbParams = function(params, unifiedDbName) {
    console.log("setTemporaryFreezrEnvDbParams "+JSON.stringify(params)+" unify: "+unifiedDbName);
    if (!params) {
        environment_defaults = require('./environment_defaults.js');
        freezr_environment = environment_defaults.autoConfigs();
        nulify_admindb();
        freezr_environment.params.unifiedDbName = (unifiedDbName? unifiedDbName: null);
    } else {
        if (!freezr_environment) freezr_environment = {params: {dbParams:{}}}
        freezr_environment.params.dbParams = params;
        freezr_environment.params.unifiedDbName = (unifiedDbName? unifiedDbName: null);
    }
    return freezr_environment.params;
} 

exports.get_real_object_id = function (data_object_id) {
    var ObjectID = require('mongodb').ObjectID;
    var real_id=null;;
    try {
        real_id = new ObjectID(data_object_id);
    } catch(e) {
        console.log("error getting real_id possibly due to a mal-configured app_config file",e)
    }
    return real_id
}
var get_full_coll_name = function (app_name, collection_name) {
    // gets collection name if unified db is used
    if (freezr_environment.params.unifiedDbName) {
        return app_name+"__"+collection_name
    } else {
        return collection_name;
    }
}
exports.init_admin_db = function (callback) {
    console.log("Iniiating Admin DB - env is "+JSON.stringify(freezr_environment) );

    async.waterfall([        
        // 1. open database connection
        function (cb) {
            MongoClient.connect('mongodb://'+exports.dbConnectionString('info_freezer_admin'), cb);
        },

        // 2. create collections for users, installed_app_list, user_installed_app_list, user_devices, permissions.
        function (theclient, cb) {
          admin_db = theclient;
          admin_db.collection(get_full_coll_name('info_freezer_admin',"users"), cb);
        },

        function (users_coll, cb) {
           exports.users = users_coll;
            admin_db.collection(get_full_coll_name('info_freezer_admin',"installed_app_list"), cb);
        },

        function (installed_app_list_coll, cb) {
            exports.installed_app_list = installed_app_list_coll;
            admin_db.collection(get_full_coll_name('info_freezer_admin',"user_installed_app_list"), cb);
        },

        function (user_installed_app_list_coll, cb) {
            exports.user_installed_app_list = user_installed_app_list_coll;
            admin_db.collection(get_full_coll_name('info_freezer_admin',"user_devices"), cb);
        },

        function (userdevices_coll, cb) {
            exports.user_devices = userdevices_coll;
            admin_db.collection(get_full_coll_name('info_freezer_admin',"permissions"), cb);
        },

        function (permissions_coll, cb) {
            exports.permissions = permissions_coll;
            cb(null);
        }

    ], callback);
};
// See freezr_db.js for methods
exports.users = null;
exports.installed_app_list = null; // list of apps installed by users
exports.user_devices = null; // set of device codes couples with user_names and whether it is an login_for_app_name login
exports.user_installed_app_list = null; // contains data on "show_app_on_home_screen", "order_to_show" and "app_codes" 
exports.permissions = null;

var running_apps_db = {};

exports.app_db_collection_get = function (app_name, collection_name, firstpass, callback) {
    //onsole.log(" app_db_collection_get - "+app_name+"  -  " +collection_name+"- -");

    if (!running_apps_db[app_name]) running_apps_db[app_name]={'db':null, 'collections':{}};
    if (!running_apps_db[app_name].collections) running_apps_db[app_name].collections= {collection_name:null};
    if (!running_apps_db[app_name].collections[collection_name]) running_apps_db[app_name].collections[collection_name] = null;

    collection_name = get_full_coll_name(app_name,collection_name);

    async.waterfall([

        // 1. open database connection
        function (cb) {
            if (freezr_environment.params.unifiedDbName && unifiedDb) {
                cb(null, null);
            } else if (running_apps_db[app_name].db) {
                cb(null, null);
            } else {
                MongoClient.connect('mongodb://'+exports.dbConnectionString(app_name), cb);
           }
        },

        // 2. 
        function (theclient, cb) {
            if (freezr_environment.params.unifiedDbName && !unifiedDb) {unifiedDb=theclient}
            if (!unifiedDb && !running_apps_db[app_name].db) running_apps_db[app_name].db = theclient;
            if (running_apps_db[app_name].collections[collection_name]) {
                cb(null,null);
            } else if (unifiedDb) {
                unifiedDb.collection(collection_name, cb);
            } else {
                running_apps_db[app_name].db.collection(collection_name, cb);
            }
        },

        function (app_collection, cb) {
            if (!running_apps_db[app_name].collections[collection_name]) running_apps_db[app_name].collections[collection_name] = app_collection;
            cb(null);
        }
    ], 
    function (err) {
        if (err) {
            running_apps_db[app_name].collections[collection_name] = null;
            if (firstpass) {
                helpers.warning ("db_main", exports.version, "app_db_collection_get", "first pass error getting collection - "+err );
                running_apps_db[app_name].db.close(function(err2) {
                    if (err2) {
                        helpers.warning ("db_main", exports.version, "app_db_collection_get", "first pass error closing collection "+collection_name+" ("+app_name+") - " +err2);
                    }
                    running_apps_db[app_name].db = null;
                    exports.app_db_collection_get(app_name, collection_name, false, callback);
                });
            } else if (running_apps_db[app_name].db) {
                callback(helpers.internal_error("db_main", exports.version, "app_db_collection_get", "second pass error getting collection (exists) "+collection_name+" ("+app_name+") - "+err ));
            } else {
                callback(helpers.internal_error("db_main", exports.version, "app_db_collection_get", "second pass error getting collection "+collection_name+" ("+app_name+") - " +err ));
            }
        } else {
            running_apps_db[app_name].last_access = new Date().getTime();
            clearTimeout(autoCloseTimeOut);
            if (!freezr_environment.params.unifiedDbName) autoCloseTimeOut = setTimeout(exports.closeUnusedApps,30000);
            callback(null, running_apps_db[app_name].collections[collection_name]);
        }
    });
};
exports.getAllCollectionNames = function(app_name, callback) {
    //onsole.log(" getAllCollectionNames -"+app_name+"- hasOwnProperty "+running_apps_db.hasOwnProperty(app_name));
    if (!running_apps_db[app_name]) running_apps_db[app_name]={'db':null, 'collections':{}};

    async.waterfall([
        // 1. open database connection
        function (cb) {
            if (running_apps_db[app_name].db) {
                cb(null, null);
            } else if (freezr_environment.params.unifiedDbName && unifiedDb) {
                cb(null, null);
            } else {
                MongoClient.connect('mongodb://'+exports.dbConnectionString(app_name), cb);
           }
        },

        // 2. 
        function (theclient, cb) {
            // unifiedDb  if (theDb) theDb.listCollections().toArray(cb); (also use theDb below)
            if (freezr_environment.params.unifiedDbName && !unifiedDb) {unifiedDb=theclient}
            if (!unifiedDb && !running_apps_db[app_name].db) running_apps_db[app_name].db = theclient;
            if (unifiedDb) {
                unifiedDb.listCollections().toArray(cb);
            } else if (running_apps_db[app_name].db) {
                running_apps_db[app_name].db.listCollections().toArray(cb);
            } else {
                cb(null);
            };
        }
    ], function (err, nameObjList) {
        if (err) {
            callback(null, null);
        } else if (nameObjList  && nameObjList.length>0){
            var a_name, collection_names=[];
            if (nameObjList && nameObjList.length > 0) {
                nameObjList.forEach(function(name_obj) {
                    a_name = name_obj.name; 
                    if (a_name && a_name!="system") {
                        if (!freezr_environment.params.unifiedDbName) {
                            collection_names.push(a_name);
                        } else if (helpers.startsWith(a_name,app_name+"__")) {
                            collection_names.push(a_name.slice(app_name.length+2));
                        }
                    }
                });
            }
            callback(null, collection_names);
        } else {
            callback(null, []);
        }
    });
}

exports.closeUnusedApps = function() {
    //onsole.log("closeUnusedApps...")
    var unusedAppsExist = false;
    closeThreshold = 20000;
    for (var oneAppName in running_apps_db) {
        if (running_apps_db.hasOwnProperty(oneAppName) && running_apps_db[oneAppName]) {
            if (!running_apps_db[oneAppName].last_access || (new Date().getTime()) - running_apps_db[oneAppName].last_access  > closeThreshold) {
                running_apps_db[oneAppName].collections = null;
                if (running_apps_db[oneAppName].db) {
                    var DbToClose = running_apps_db[oneAppName].db;
                    delete running_apps_db[oneAppName];
                    DbToClose.close(function(err2) {
                        if (err2) {helpers.warning ("db_main", exports.version, "closeUnusedApps", "err closing "+oneAppName+" - "+err2); }
                    });
                } else {
                    running_apps_db[oneAppName] = null;
                }
            }
        }
        for (var twoAppName in running_apps_db) {
            if (running_apps_db.hasOwnProperty(twoAppName) ) {
                unusedAppsExist = true;
                console.log("unclosed dbs are "+twoAppName+" diff "+((running_apps_db[twoAppName] && running_apps_db[twoAppName].last_access)? (new Date().getTime() - running_apps_db[twoAppName].last_access ): "no last acces") )
            }  
        }
    }
    clearTimeout(autoCloseTimeOut);
    if (unusedAppsExist) autoCloseTimeOut = setTimeout(exports.closeUnusedApps,30000);
}
