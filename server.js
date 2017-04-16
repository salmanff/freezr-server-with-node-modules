// freezr.info - nodejs system files - main file: server.js 
const VERSION = "0.0.12";

// INITALISATION / APP / EXPRESS
const LISTEN_TO_LOCALHOST_ON_LOCAL = true; // for local development - set to true to access local site at http://localhost:3000, and false to access it at your local ip address - eg http://192.168.192.1:3000

var fs = require('fs'),
    express = require('express'),
    bodyParser  = require('body-parser'), 
    multer  = require('multer'), 
    upload = multer().single('file'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    cookieSession = require('cookie-session'),
    session = require('express-session'),
    app = express();
var db_main = require('./freezr_system/db_main.js'),
    admin_handler = require('./freezr_system/admin_handler.js'),
    account_handler = require('./freezr_system/account_handler.js'),
    helpers = require('./freezr_system/helpers.js'),
    environment_defaults = require('./freezr_system/environment_defaults.js'),
    app_handler = require('./freezr_system/app_handler.js'),
    file_handler = require('./freezr_system/file_handler.js'),
    public_handler = require('./freezr_system/public_handler.js');

// stackoverflow.com/questions/26287968/meanjs-413-request-entity-too-large
app.use(bodyParser.json({limit:1024*1024*3, type:'application/json'})); 
app.use(bodyParser.urlencoded( { extended:true,limit:1024*1024*3,type:'application/x-www-form-urlencoding' } ) ); 
app.use(cookieParser());

var freezrStatus = {
    allOkay:true,
    running: {
        db:true,
        fileSys:true,
        fileWrite:true
    }
}

console.log("=========================  VERSION April XX  =======================")
var freezr_preferences;
var freezr_environment;

var oldConfig;
try {
    oldConfig = require("./freezr_system/config.js");
} catch (e) {
    oldConfig = null;
}

if (fs.existsSync(file_handler.systemPathTo("freezr_preferences.js"))) {
    freezr_preferences = require(file_handler.systemPathTo("freezr_preferences.js"))
} else {
    freezr_preferences = {
        params:{
            "session_cookie_secret":helpers.randomText(20),

            "connect_on_local_wifi_only":true,
            "do_admin_on_local_wifi_only":true
        }
    }
}

if (fs.existsSync(file_handler.systemPathTo("freezr_environment.js"))) {
    freezr_environment = require(file_handler.systemPathTo("freezr_environment.js"));
} else if (oldConfig && oldConfig.params && oldConfig.params.freezr_is_setup) {
    // (console) transitional - to delete
    freezr_environment = environment_defaults.autoConfigs();
    freezr_environment.params.freezr_is_setup = true;
    freezr_environment.first_user = oldConfig.params.first_user;
    fs.writeFile(file_handler.systemPathTo("freezr_environment.js"), "exports.params=" + JSON.stringify(freezr_environment.params), function(err) {
            if(err) {
                console.log("ERROR WRITING new freezr_environment ")
            } else {
                console.log("Wrote new freezr_environment succcessfully")
            }
       });
} else {
    console.log("freezr_environment file does NOT exist - FIRST REGISTRATION WILL BE TRIGGERED.");
    freezr_environment = environment_defaults.autoConfigs();
    freezr_environment.params.freezr_is_setup = false;
    freezr_environment.first_user = null;
    //onsole.log(freezr_environment)
}

app.use(cookieSession(
    {
    secret: freezr_preferences.params.session_cookie_secret,
    maxAge: 15552000000,
    store: new session.MemoryStore() // review - perhaps change this to mongo
    }
));

app.use(function(req, res, next) {
    //stackoverflow.com/questions/22535058/including-cookies-on-a-ajax-request-for-cross-domain-request-using-pure-javascri
    res.header("Access-Control-Allow-Credentials","true");
    res.header("Access-Control-Allow-Origin", null); 
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Origin, Accept");
    res.header("Access-Control-Allow-Methods","PUT, POST, GET, OPTIONS");
    next();
});


// ACCESS RIGHT FUNCTIONS 
var serveAppFile = function(req, res, next) {
    //onsole.log( (new Date())+" serveAppFile - "+req.originalUrl);
    var fileUrl = req.originalUrl;

    // clean up url
    if (helpers.startsWith(fileUrl,'/app_files/')) { fileUrl = fileUrl.replace('/app_files/','app_files/')}
    else if (helpers.startsWith(fileUrl,'/apps/')) { fileUrl = fileUrl.replace('/apps/','app_files/')} 

    if (fileUrl.indexOf('?')>1) { fileUrl = fileUrl.substr(0,fileUrl.indexOf('?'));} // solving slight problem when node.js adds a query param to some fetches
    
    if (req.session && req.session.logged_in) {
        file_handler.sendAppFile(res, fileUrl);
    } else {
        helpers.auth_warning("server.js", VERSION, "serveAppFile", "Unauthorized attempt to access file "+ fileUrl);
        res.sendStatus(401);
    }
}
var servePublicAppFile = function(req, res, next) {
    //onsole.log( (new Date())+" servePublicAppFile - "+req.originalUrl);
    var fileUrl = file_handler.normUrl(req.originalUrl.replace('/app_files/','app_files/') );

    if (helpers.startsWith(fileUrl,'/apps/')) { fileUrl = fileUrl.replace('/apps/','app_files/')}
    if (fileUrl.indexOf('?')>1) { fileUrl = fileUrl.substr(0,fileUrl.indexOf('?'));} // solving slight problem when node.js adds a query param to some fetches

    if (fileUrl.slice(1)=="favicon.ico") {
        res.sendFile(file_handler.systemPathTo("app_files/info.freezr.public/static/" + fileUrl));
    } else if (!fs.existsSync(fileUrl)) {
        file_handler.sendAppFile(res, fileUrl, freezr_environment);
    }
}
var appPageAccessRights = function(req, res, next) {
    if ((freezr_environment.params.freezr_is_setup && req.session && req.session.logged_in) ){
        if (req.params.page || helpers.endsWith(req.originalUrl,"/") ) {
            req.freezr_server_version = VERSION;
            req.freezr_environment = freezr_environment.params;
            next();
        } else {
            res.redirect(req.originalUrl+'/');
        }
    } else {
        if (freezr_environment && freezr_environment.params.freezr_is_setup) helpers.auth_warning("server.js", VERSION, "appPageAccessRights", "Unauthorized attempt to access page"+req.url+" without login ");
        res.redirect('/account/login')
    }
}
var userDataAccessRights = function(req, res, next) {
    //onsole.log("userDataAccessRights sess "+(req.session?"Y":"N")+"  loggin in? "+(req.session.logged_in?"Y":"N"));
    if (!freezrStatus.running.db) {
        console.log("db is not running. server must be restarted after db starts")
        res.sendStatus(401);
    } else if (freezr_environment.params.freezr_is_setup && req.session && req.session.logged_in && req.session.logged_in_userid == req.params.userid){
        req.freezr_environment = freezr_environment.params;
        next();
    } else {
        if (freezr_environment && freezr_environment.params.freezr_is_setup) helpers.auth_warning("server.js", VERSION, "userDataAccessRights", "Unauthorized attempt to access data "+req.url+" without login ");
        res.sendStatus(401);
    }
}
function requireAdminRights(req, res, next) {
    //onsole.log("require admin login ");
    if (!freezrStatus.allOkay) {
        if (helpers.startsWith(file_handler.normUrl(req.originalUrl),'/admin')) {
                 res.redirect("/admin/public/starterror");
        } else { res.sendStatus(401);}
    } if (req.session && req.session.logged_in_as_admin) {
        req.freezr_server_version = VERSION;
        req.freezr_environment = freezr_environment.params;
        next();
    } else {
        helpers.auth_warning("server.js", VERSION, "requireAdminRights", "Unauthorized attempt to access admin area "+req.url+" - ");
        res.redirect("/account/login");
    }
}
function requireUserRights(req, res, next) {
    //onsole.log("require user rights for "+req.originalUrl); //req.params.user_id+ " vs "+JSON.stringify(req.session));
    if (!freezr_environment.params.freezr_is_setup && fs.existsSync(file_handler.systemPathTo("freezr_environment.js"))) {
        freezr_environment = require(file_handler.systemPathTo("freezr_environment.js"));
        if (freezr_environment.params.freezr_is_setup) true; //onsole.log("Reloading freezr_environment.js - first page visited after set up")
    }
    if (!freezrStatus.allOkay && freezr_environment.params.freezr_is_setup) {
        res.redirect("/admin/public/starterror");
    } else if (req.session && (req.url == "/account/login" || helpers.startsWith(req.url,'/account/applogin') || req.session.logged_in_user_id )) {
        req.freezr_environment = freezr_environment.params;
        req.freezr_server_version = VERSION;
        next();
    } else {
        helpers.auth_warning("server.js", VERSION, "requireUserRights", "Unauthorized attempt to access data "+req.url+" without login ");
        res.redirect("/account/login");
    }
}
function ensureThisIsFirstSetUp (req, res, next) {
    if (!freezr_environment.params.freezr_is_setup && req.body.register_type == "setUp") {
        req.freezr_server_version = VERSION;
        req.freezr_environment = freezr_environment.params;
        req.freezrStatus = freezrStatus;
        next();
    } else {
        helpers.auth_warning("server.js", VERSION, "ensureThisIsFirstSetUp", "Unauthorized attempt to set up system which has already been set up. ");
        res.sendStatus(401);
    }
}

function uploadFile(req,res) {
    req.freezr_server_version = VERSION;
    req.freezr_environment = freezr_environment.params;
    upload(req, res, function (err) {
        if (err) {
            helpers.send_failure(res, err, "server.js", VERSION, "uploadFile");
        }
        app_handler.putData(req,res);
    })
}
function uploadAppZipFile(req,res) {
    req.freezr_server_version = VERSION;
    req.freezr_environment = freezr_environment.params;
    upload(req, res, function (err) {
        if (err) {
            helpers.send_failure(res, err, "server.js", VERSION, "uploadAppZipFile");
        }
        account_handler.add_uploaded_app_zip_file(req,res);
    })
}
function addVersionNumber(req, res, next) {
    req.freezr_server_version = VERSION;
    req.freezrStatus = freezrStatus;
    req.freezr_is_setup = freezr_environment.params.freezr_is_setup;
    next();
}

// APP PAGES AND FILE
    // app pages and files
        app.use("/app_files/info.freezr.public", servePublicAppFile);
        app.get('/app_files/:app_name/public/static/:file', servePublicAppFile);
        app.get('/app_files/:app_name/public/:file', servePublicAppFile);
        app.use("/app_files/:app_name/:file", serveAppFile);
        app.get('/apps/:app_name', appPageAccessRights, app_handler.generatePage); 
        app.get('/apps/:app_name/static/:file', serveAppFile);
        app.get('/apps/:app_name/:page', appPageAccessRights, app_handler.generatePage);
        app.get('/allmydata/:whattodo/:app_name', appPageAccessRights, app_handler.generateDataPage);
        app.get('/favicon.ico', servePublicAppFile)

    // app files and pages and user files
        app.get('/v1/db/getbyid/:permission_name/:collection_name/:requestor_app/:source_app_code/:requestee_app/:data_object_id', userDataAccessRights, app_handler.getDataObject); // here request type must be "one"
        app.get('/v1/userfiles/:permission_name/:collection_name/:requestor_app/:source_app_code/:requestee_app/:user_id/*', userDataAccessRights, app_handler.getDataObject); // collection_name is files

    // db
        app.put('/v1/db/upload/:app_name/:source_app_code',userDataAccessRights, uploadFile);
        app.put('/v1/db/write/:app_name/:source_app_code/:collection', userDataAccessRights, app_handler.putData);
        app.post('/v1/db/query/:requestor_app/:source_app_code/:requestee_app', userDataAccessRights, app_handler.db_query); 
        app.post('/v1/db/query/:requestor_app/:source_app_code/:requestee_app/:permission_name', userDataAccessRights, app_handler.db_query); 

    // public 
        app.get('/pcard/:user_id/:requestor_app/:permission_name/:app_name/:collection_name/:data_object_id', addVersionNumber, public_handler.generatePublicPage); 
        app.get('/pcard/:user_id/:app_name/:collection_name/:data_object_id', addVersionNumber, public_handler.generatePublicPage); 
        app.get('/ppage/:app_name/:page', addVersionNumber, public_handler.generatePublicPage); 
        app.get('/ppage/:app_name', addVersionNumber, public_handler.generatePublicPage); 
        app.get('/ppage', addVersionNumber, public_handler.generatePublicPage); 
        app.get('/apps/:app_name/public/static/:file', servePublicAppFile);
        app.get('/v1/pdbq', addVersionNumber, public_handler.dbp_query); 
        app.get('/v1/pdbq/:app_name', addVersionNumber, public_handler.dbp_query); 
        app.post('/v1/pdbq', addVersionNumber, public_handler.dbp_query); 

        app.get('/v1/pobject/:user_id/:app_name/:collection_name/:data_object_id', public_handler.generatePublicPage);  
        // todo: app.get('/v1/pfile/:user_id/:app_name/*', public_handler.getPublicDataObject); // collection_name is files 
        


    // permissions
        app.put('/v1/permissions/setobjectaccess/:requestor_app/:source_app_code/:permission_name', userDataAccessRights, app_handler.setObjectAccess);
        app.put('/v1/permissions/change/:requestee_app/:source_app_code', userDataAccessRights, account_handler.changeNamedPermissions); 
        app.get('/v1/permissions/getall/:requestee_app/:source_app_code', userDataAccessRights, account_handler.all_app_permissions);
        // todo & review / redo app.put('/v1/permissions/setfieldaccess/:requestor_app/:source_app_code/:permission_name', userDataAccessRights, app_handler.setFieldAccess);
        // todo & review / redoapp.get('/v1/permissions/getfieldperms/:requested_type/:requestor_app/:source_app_code', userDataAccessRights, app_handler.getFieldPermissions)

    // developer utilities
        app.get('/v1/developer/config/:app_name/:source_app_code',userDataAccessRights, app_handler.getConfig);
        app.get('/v1/developer/fileListUpdate/:app_name/:source_app_code', userDataAccessRights, app_handler.updateFileList);
        app.get('/v1/developer/fileListUpdate/:app_name/:source_app_code/:folder_name', userDataAccessRights, app_handler.updateFileList);

    // account pages
        app.get ('/account/logout', addVersionNumber, account_handler.logout_page);
        app.get ('/account/login', addVersionNumber, account_handler.generate_login_page);
        app.get ('/account/applogin/login/:app_name', addVersionNumber, account_handler.generate_login_page);
        app.get ('/account/applogin/results', account_handler.generate_applogin_results);
        app.get ('/account/:sub_page', requireUserRights, account_handler.generateAccountPage);

        app.get('/v1/account/ping', addVersionNumber, account_handler.ping);
        app.get('/v1/account/ping/:app_name', addVersionNumber, account_handler.ping);
        app.post('/v1/account/login', account_handler.login);
        app.post('/v1/account/applogin', account_handler.login);
        app.post('/v1/account/applogout', account_handler.logout);
        app.put ('/v1/account/changePassword.json', requireUserRights, account_handler.changePassword); 
        app.put ('/v1/account/upload_app_zipfile.json', requireUserRights, uploadAppZipFile); 

        app.get('/account/v1/app_list.json', requireUserRights, account_handler.list_all_user_apps);
        app.post('/account/v1/appMgmtActions.json', requireUserRights, account_handler.appMgmtActions);

    // admin pages
        app.get("/admin/registration_success", function (req, res) {
            try {
                delete require.cache[require.resolve(file_handler.systemPathTo('freezr_environment.js'))]
            } catch (e) {
                helpers.internal_error("server", exports.version,"registration_success","Could not renew cache and did not initiate db - err:"+e);
            }
            freezr_environment = require(file_handler.systemPathTo("freezr_environment.js"));
            freezrStatus.allOkay=true;
            if (!file_handler.setupFileSys(freezr_environment.params) ) {
                freezrStatus.allOkay=false;
                freezrStatus.running.fileSys = false;
                console.error("** ERROR accessing user file system after intial set up.");
            } 
            console.log("Redirecting to account/home from registration_success");
            res.redirect("/account/home");
            res.end();
        });
        app.get('/admin/public/:sub_page', addVersionNumber, admin_handler.generateAdminPage);
        app.get('/admin/:sub_page', requireAdminRights, admin_handler.generateAdminPage);
        app.put ('/v1/admin/user_register', requireAdminRights, admin_handler.register); 
        app.put ('/v1/admin/first_registration', ensureThisIsFirstSetUp, admin_handler.first_registration); 
        app.get('/v1/admin/user_list.json', requireAdminRights, admin_handler.list_all_users);
    
    // default redirects
        app.get("/", function (req, res) {
            // to if allows public people coming in, then move to public page
            //onsole.log("redirecting to account/home as default for "+req.originalUrl);
            res.redirect( (req.session && req.session.logged_in)? "/account/home":"/account/login");
            res.end();
        });
        app.get('*', function (req, res) {
            //onsole.log("redirecting to account/login as default or for non logged in "+req.originalUrl);
            res.redirect( (req.session && req.session.logged_in)? "/account/home":"/account/login");
            res.end();
        });


// RUN APP 

require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    freezr_environment.ipaddress = (helpers.startsWith(add,"192.168") && LISTEN_TO_LOCALHOST_ON_LOCAL)? "localhost" : add;
    freezr_environment.port = freezr_environment.params.port;   

    console.log('Running on local ip address: '+freezr_environment.ipaddress+" : "+freezr_environment.port);
    if (process && process.env && process.env.PORT) console.log("process port exists "+process.env.PORT)
    if (process && process.env && process.env.IP) console.log("process ip exists "+process.env.IP)

    CheckAndRecordFreezrStatus(function() {
        if (!fs.existsSync(file_handler.systemPathTo("freezr_preferences"))) {
            fs.writeFile(file_handler.systemPathTo("freezr_preferences.js"), "exports.params=" + JSON.stringify(freezr_preferences.params), function(err) {
                if(err) {
                    freezrStatus.allOkay=false;
                    freezrStatus.running.fileWrite = false;
                    console.error("** FATAL ERROR writing files in root directory (1).");
                }
                console.log("Going to listen at "+freezr_environment.port + " ip:" +freezr_environment.ipaddress)
                console.log(" - - - - - - - - -  - - - - - - - - - - - - - - - - - - - - - - - - -")
                app.listen(freezr_environment.port) //, freezr_environment.ipaddress);
            }); 
        } else {
            console.log("freezr_preferences.js exists - Going to listen at "+freezr_environment.port + " ip:" +freezr_environment.ipaddress)
            app.listen(freezr_environment.port)//, freezr_environment.ipaddress);
        }
    })


})

var CheckAndRecordFreezrStatus = function(callback) {
    freezrStatus = {
        allOkay:true,
        running: {
            db:true,
            fileSys:true,
            fileWrite:true
        }
    }
    fs.writeFile(file_handler.systemPathTo("test_write.txt"), "Testing write on server", function(err) {
            if(err) {
                freezrStatus.allOkay=false;
                freezrStatus.running.fileWrite = false;
                console.error("** FATAL ERROR writing files in root directory. (2)");
                // todo later: this can potentially be kept on external userfiles... need to create logic
            }
            if (freezr_environment.params.freezr_is_setup && !file_handler.setupFileSys(freezr_environment.params) ) {
                freezrStatus.allOkay=false;
                freezrStatus.running.fileSys = false;
                console.error("** ERROR initializing user file system. ");
            }  
            // add userfiles try and db try
            if (freezr_environment.params.freezr_is_setup) {
                db_main.init_admin_db(function (err, results) {
                    if (err) {
                        console.error("** FATAL ERROR ON STARTUP - DB not available: "+JSON.stringify(err));
                        freezrStatus.allOkay=false;
                        freezrStatus.running.db = false;
                    }  
                    callback();
                });
            } else {
                callback();
            }
            
       }); 
}


