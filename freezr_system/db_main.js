// freezr.info - nodejs system files - db_main.js
exports.version = "0.0.1";

var async = require('async'),
    helpers = require('./helpers.js'),
    system_env = require("../freezr_system/system_env.js"), 
    MongoClient = require('mongodb').MongoClient;

exports.dbConnectionString = function(appName) {
    return system_env.dbConnectionString(appName);
}
exports.get_real_object_id = function (data_object_id) {
    var ObjectID = require('mongodb').ObjectID;
    return new ObjectID(data_object_id);
}

exports.init_admin_db = function (first_registration, callback) {
    //onsole.log("Iniiating Admin DB - full connection string is "+exports.dbConnectionString('info_freezer_admin'));

    async.waterfall([
        
        // 1. open database connection
        function (cb) {
          MongoClient.connect('mongodb://'+exports.dbConnectionString('info_freezer_admin'), cb);
        },

        // 2. create collections for users, installed_app_list, user_installed_app_list, user_devices, permissions.
        function (theclient, cb) {
          admin_db = theclient;
          admin_db.collection("users", cb);
        },

        function (users_coll, cb) {
            exports.users = users_coll;
            admin_db.collection("installed_app_list", cb);
        },

        function (installed_app_list_coll, cb) {
            exports.installed_app_list = installed_app_list_coll;
            admin_db.collection("user_installed_app_list", cb);
        },

        function (user_installed_app_list_coll, cb) {
            exports.user_installed_app_list = user_installed_app_list_coll;
            admin_db.collection("user_devices", cb);
        },

        function (userdevices_coll, cb) {
            exports.user_devices = userdevices_coll;
            admin_db.collection("permissions", cb);
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
    if (!running_apps_db[app_name].collections[collection_name]) running_apps_db[app_name].collections[collection_name] = null;

    async.waterfall([
        // CHECK VALID APP NAME AND COLLECTION NAME?? or pre-checked?

        // 1. open database connection
        function (cb) {
            if (running_apps_db[app_name].db) {
                cb(null, null);
            } else {
                MongoClient.connect('mongodb://'+exports.dbConnectionString(app_name), cb);
           }
        },

        // 2. 
        function (theclient, cb) {
            if (!running_apps_db[app_name].db) running_apps_db[app_name].db = theclient;
            if (running_apps_db[app_name].collections[collection_name]) {
                cb(null,null);
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
                        helpers.warning ("db_main", exports.version, "app_db_collection_get", "first pass error closing collection - "+err2);
                    }
                    running_apps_db[app_name].db = null;
                    exports.app_db_collection_get(app_name, collection_name, false, callback);
                });
            } else if (running_apps_db[app_name].db) {
                callback(helpers.internal_error("db_main", exports.version, "app_db_collection_get", "second pass error getting collection (exists) - "+err ));
            } else {
                callback(helpers.internal_error("db_main", exports.version, "app_db_collection_get", "second pass error getting collection - "+err ));
            }
        } else {
            running_apps_db[app_name].last_access = new Date().getTime();
            exports.closeUnusedApps();
            callback(null, running_apps_db[app_name].collections[collection_name]);
        }
    });
};
exports.getAllCollectionNames = function(app_name, callback) {
    //onsole.log(" getAllCollectionNames - "+app_name+" hasOwnProperty "+running_apps_db.hasOwnProperty(app_name));
    if (!running_apps_db[app_name]) running_apps_db[app_name]={'db':null, 'collections':{}};
    async.waterfall([
        // 1. open database connection
        function (cb) {
            if (running_apps_db[app_name].db) {
                cb(null, null);
            } else {
                MongoClient.connect('mongodb://'+exports.dbConnectionString(app_name), cb);
           }
        },

        // 2. 
        function (theclient, cb) {
            if (!running_apps_db[app_name].db) running_apps_db[app_name].db = theclient;
            if (running_apps_db[app_name].db) {
                running_apps_db[app_name].db.collectionNames(cb);
            } else {
                cb(null);
            };
        }
    ], function (err, names) {
        if (err) {
            callback(null, null);
        } else if (names){
            callback(null, names);
        } else {
            callback(null, []);
        }
    });
}
exports.closeUnusedApps = function() {
    closeThreshold = 60000;
    for (var oneAppName in running_apps_db) {
        if (running_apps_db.hasOwnProperty(oneAppName) && running_apps_db[oneAppName]) {
            if (!running_apps_db[oneAppName].last_access || (new Date().getTime()) - running_apps_db[oneAppName].last_access  > closeThreshold) {
                running_apps_db[oneAppName].collections = null;
                if (running_apps_db[oneAppName].db) {
                    running_apps_db[oneAppName].db.close(function(err2) {
                        if (err2) {helpers.warning ("db_main", exports.version, "closeUnusedApps", "err closing "+oneAppName+" - "+err2);}
                        running_apps_db[oneAppName] = null;
                    });
                } else {
                    running_apps_db[oneAppName] = null;
                }
            }
        }  
    }
}
