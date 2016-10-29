// freezr.info - nodejs system files - main file: freezr.js 
const VERSION = "0.0.1";

// INITALISATION / APP / EXPRESS
const LISTEN_TO_LOCALHOST_ON_LOCAL = true; // set to true to access local site at http://localhost:3000, and false to access it at your local ip address - eg http://192.168.192.1:3000

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
    system_env = require('./freezr_system/system_env.js'),
    app_handler = require('./freezr_system/app_handler.js');

var ipaddress = system_env.ipaddress();
var port      = system_env.port();

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
var config;
if (fs.existsSync(helpers.fullPath("userfiles/config.js"))) {
    config = require(helpers.fullPath("userfiles/config.js"))
} else {
    config = {
        params:{
            "db_config":{
                "host":"localhost",
                "password":null
            },
            "session_cookie_secret":helpers.randomText(10),

            "connect_on_local_wifi_only":true,
            "do_admin_on_local_wifi_only":true
        }
    }
}
var oldConfig;
try {
    oldConfig = require("./freezr_system/config.js");
} catch (e) {
    oldConfig = null;
}
var init;
if (fs.existsSync(helpers.fullPath("userfiles/init.js"))) {
    init = require(helpers.fullPath("userfiles/init.js"))
} else if (oldConfig && oldConfig.params && oldConfig.params.freezr_is_setup) {
    // transitional - to delete
    init = {
        params:{
            "freezr_is_setup":true,
            "first_user": oldConfig.params.first_user
        }
    }
        
} else {
    init = {
        params:{
            "freezr_is_setup":false,
            "first_user": null
        }
    }
}


app.use(cookieSession(
    {
    secret: config.params.session_cookie_secret,
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
var publicFileServe = function(req, res, next) {
    //onsole.log("accessing publicFileServe file - "+req.originalUrl);
    var fileUrl = helpers.normUrl(req.originalUrl.replace('/app_files/','app_files/') );


    if (fileUrl.slice(1)=="favicon.ico") {
        res.sendFile(helpers.normUrl(__dirname + "/app_files/info.freezr.public/static/" + fileUrl));
    } else if (!fs.existsSync(fileUrl)) {
            helpers.warning("freezr.js", VERSION, "publicFileServe", "link to non-existent file "+fileUrl );
            res.sendStatus(401);
    } else {
        res.sendFile(helpers.normUrl(__dirname + "/" + fileUrl) );
    }
}
var appFileAccessRights = function(req, res, next) {

    var fileUrl = req.originalUrl;

    // clean up url
    if (helpers.startsWith(fileUrl,'/app_files/')) { fileUrl = fileUrl.replace('/app_files/','app_files/')}
    else if (helpers.startsWith(fileUrl,'/apps/')) { fileUrl = fileUrl.replace('/apps/','app_files/')} 
    else if (helpers.startsWith(fileUrl,'/htmlsnippet/')) { 
            fileUrl = fileUrl.replace('/htmlsnippet/','app_files/')
        };

    if (fileUrl.indexOf('?')>1) { fileUrl = fileUrl.substr(0,fileUrl.indexOf('?'));} // solving slight problem when node.js adds a query param to some fetches

    var path_parts = fileUrl.split("/");
    var app_name = path_parts[1];

    var filePath = helpers.fullPath(fileUrl,true);
    filePath = filePath.replace("freezr_system\\app","app")

    //onsole.log("file path is "+filePath)

    if (!freezrStatus.allOkay || !fs.existsSync( filePath)) {
        if (!helpers.endsWith(fileUrl,"logo.png")) {
            helpers.warning("freezr.js", VERSION, "appFileAccessRights", "link to non-existent file "+filePath );
        }
        res.sendStatus(401);
    } else if((init.params.freezr_is_setup && (req.session && req.session.logged_in) || (app_name == "info.freezr.public") )) {
        //onsole.log("appFileAccessRights send "+helpers.fullPath(fileUrl));
        res.sendFile(filePath);
    } else {
        helpers.auth_warning("freezr.js", VERSION, "appFileAccessRights", "Unauthorized attempt to access file "+filePath );
        res.sendStatus(401);
    }
}
var appPageAccessRights = function(req, res, next) {
    if (!freezrStatus.allOkay) {
        res.redirect("/admin/starterror");
    } else if ((init.params.freezr_is_setup && req.session && req.session.logged_in) ){
        if (req.params.page || helpers.endsWith(req.originalUrl,"/") ) {
            req.freezr_server_version = VERSION;
            next();
        } else {
            res.redirect(req.originalUrl+'/');
        }
    } else {
        helpers.auth_warning("freezr.js", VERSION, "appPageAccessRights", "Unauthorized attempt to access page"+req.url+" without login ");
        res.redirect('/account/login')
    }
}
var userDataAccessRights = function(req, res, next) {
    // todo - this can be made more sophisticated with per app per user access via mongo
    //onsole.log("userDataAccessRights sess "+(req.session?"Y":"N")+"  loggin in? "+(req.session.logged_in?"Y":"N"));
    if (!freezrStatus.allOkay) {
        res.sendStatus(401);
    } else if (init.params.freezr_is_setup && req.session && req.session.logged_in && req.session.logged_in_userid == req.params.userid){
        next();
    } else {
        helpers.auth_warning("freezr.js", VERSION, "userDataAccessRights", "Unauthorized attempt to access data "+req.url+" without login ");
        res.sendStatus(401);
    }
}
function requireAdminRights(req, res, next) {
    //onsole.log("require admin login ");
    if (!freezrStatus.allOkay) {
        if (helpers.startsWith(helpers.normUrl(req.originalUrl),'/admin')) {
                 res.redirect("/admin/starterror");
        } else { res.sendStatus(401);}
    } if (init.params.freezr_is_setup && req.session && req.session.logged_in_as_admin) {
        req.freezr_server_version = VERSION;
        next();
    } else {
        helpers.auth_warning("freezr.js", VERSION, "requireAdminRights", "Unauthorized attempt to access admin area "+req.url+" - ");
        res.redirect("/account/login");
    }
}
function requireUserRights(req, res, next) {
    //onsole.log("require user rights login "+req.params.user_id+ " vs "+JSON.stringify(req.session));
    if (!init.params.freezr_is_setup && fs.existsSync(helpers.fullPath("userfiles/init.js"))) {
        console.log("Resetting init.js - first page visited after set up")
        init = require(helpers.fullPath("userfiles/init.js"));
    }
    if (!freezrStatus.allOkay) {
        res.redirect("/admin/starterror");
    } else if (init.params.freezr_is_setup && req.session && (req.url == "/account/login" || helpers.startsWith(req.url,'/account/applogin') || req.session.logged_in_user_id )) {
        req.freezr_server_version = VERSION;
        next();
    } else {
        helpers.auth_warning("freezr.js", VERSION, "requireUserRights", "Unauthorized attempt to access data "+req.url+" without login ");
        res.redirect("/account/login");
    }
}
function ensureThisIsFirstSetUp (req, res, next) {
    if (!freezrStatus.allOkay) {
        res.sendStatus(401);
    } else if (!init.params.freezr_is_setup && req.body.register_type == "setUp") {
        next();
    } else {
        helpers.auth_warning("freezr.js", VERSION, "ensureThisIsFirstSetUp", "Unauthorized attempt to set up system which has already been set up. ");
        res.sendStatus(401);
    }
}

function uploadFile(req,res) {
    upload(req, res, function (err) {
        if (err) {
            helpers.send_failure(res, err, "freezr.js", VERSION, "uploadFile");
        }
        app_handler.putData(req,res);
    })
}
function uploadAppZipFile(req,res) {
    upload(req, res, function (err) {
        if (err) {
            helpers.send_failure(res, err, "freezr.js", VERSION, "uploadAppZipFile");
        }
        account_handler.add_uploaded_app_zip_file(req,res);
    })
}
function addVersionNumber(req, res, next) {
    req.freezr_server_version = VERSION;
    next();
}
function addRegistrationStatus(req, res, next) {
    req.freezr_server_version = VERSION;
    req.freezr_is_setup = init.params.freezr_is_setup;
    next();
}
function addFatalErrorCause(req, res, next) {
    req.freezr_server_version = VERSION;
    req.freezr_fatal_error = freezrStatus;
    next();
}

// APP PAGES AND FILE
    // app pages and files
        app.use("/app_files/info.freezr.public", publicFileServe);
        app.use("/app_files", appFileAccessRights);
        app.get('/apps/:app_name', appPageAccessRights, app_handler.generatePage); 
        app.get('/apps/:app_name/static/:file', appFileAccessRights);
        app.get('/apps/:app_name/:page', appPageAccessRights, app_handler.generatePage);
        app.get('/allmydata/:whattodo/:app_name', appPageAccessRights, app_handler.generateDataPage);
        app.get('/htmlsnippet/:app_name/:file', appFileAccessRights);
        app.get('/favicon.ico', publicFileServe)

    // app files and pages and user files
        app.get('/v1/db/getbyid/:permission_name/:collection_name/:requestor_app/:source_app_code/:requestee_app/:data_object_id', app_handler.getDataObject); // here request type must be "one"
        app.get('/v1/userfiles/:permission_name/:collection_name/:requestor_app/:source_app_code/:requestee_app/:user_id/*', app_handler.getDataObject); // collection_name is files

    // db
        app.put('/v1/db/upload/:app_name/:source_app_code',userDataAccessRights, uploadFile);
        app.put('/v1/db/write/:app_name/:source_app_code/:collection', userDataAccessRights, app_handler.putData);
        app.post('/v1/db/query/:requestor_app/:source_app_code/:requestee_app', userDataAccessRights, app_handler.db_query); 
        app.post('/v1/db/query/:requestor_app/:source_app_code/:requestee_app/:permission_name', userDataAccessRights, app_handler.db_query); 

    // permissions
        app.put('/v1/permissions/setfieldaccess/:requestor_app/:source_app_code/:permission_name', userDataAccessRights, app_handler.setFieldAccess);
        app.put('/v1/permissions/setobjectaccess/:requestor_app/:source_app_code/:permission_name', userDataAccessRights, app_handler.setObjectAccess);
        app.get('/v1/permissions/getfieldperms/:requested_type/:requestor_app/:source_app_code', userDataAccessRights, app_handler.getFieldPermissions)
        app.put('/v1/permissions/change/:requestee_app/:source_app_code', userDataAccessRights, account_handler.changeNamedPermissions); 
        app.get('/v1/permissions/getall/:requestee_app/:source_app_code', userDataAccessRights, account_handler.all_app_permissions);

    // developer utilities
        app.get('/v1/developer/config/:app_name/:source_app_code',userDataAccessRights, app_handler.getConfig);
        app.get('/v1/developer/fileListUpdate/:app_name/:source_app_code', userDataAccessRights, app_handler.updateFileList);
        app.get('/v1/developer/fileListUpdate/:app_name/:source_app_code/:folder_name', userDataAccessRights, app_handler.updateFileList);

    // account pages
        app.get ('/account/logout', addVersionNumber, account_handler.logout_page);
        app.get ('/account/login', addRegistrationStatus, account_handler.generate_login_page);
        app.get ('/account/applogin/login/:app_name', addVersionNumber, account_handler.generate_login_page);
        app.get ('/account/applogin/results', account_handler.generate_applogin_results);
        app.get ('/account/:sub_page', requireUserRights, account_handler.generateAccountPage);

        app.get('/v1/account/ping', addVersionNumber, account_handler.ping);
        app.post('/v1/account/login', account_handler.login);
        app.post('/v1/account/applogin', account_handler.login);
        app.post('/v1/account/applogout', account_handler.logout);
        app.put ('/v1/account/changePassword.json', requireUserRights, account_handler.changePassword); 
        app.put ('/v1/account/add_app_manually.json', requireUserRights, account_handler.addAppManually); 
        app.put ('/v1/account/upload_app_zipfile.json', requireUserRights, uploadAppZipFile); 

        app.get('/account/v1/app_list.json', requireUserRights, account_handler.list_all_user_apps);
        app.post('/account/v1/appMgmtActions.json', requireUserRights, account_handler.appMgmtActions);

    // admin pages
        app.get("/admin/registration_success", function (req, res) {
            try {
                delete require.cache[require.resolve(helpers.fullPath('userfiles/init.js'))]
            } catch (e) {
                helpers.internal_error("server", exports.version,"registration_success","Could not renew cache and did not initiate db - err:"+e);
            }
            init = require(helpers.fullPath("userfiles/init.js"));
            res.redirect("/account/home");
            res.end();
        });
        app.get('/admin/starterror', addFatalErrorCause, account_handler.generate_error_page);
        app.get('/admin/:sub_page', requireAdminRights, admin_handler.generateAdminPage);
        app.put ('/v1/admin/user_register', requireAdminRights, admin_handler.register); 
        app.put ('/v1/admin/first_registration', ensureThisIsFirstSetUp, admin_handler.first_registration); 
        app.get('/v1/admin/user_list.json', requireAdminRights, admin_handler.list_all_users);
    
    // default redirects
        app.get("/", function (req, res) {
            res.redirect("/account/home");
            res.end();
        });
        app.get('*', function (req, res) {
            res.redirect("/account/home");
            res.end();
        });



console.log("runnning ipaddress"+ipaddress+" port "+port);
// RUN APP 
    if (!helpers.setupFileSys() ) {
        freezrStatus.allOkay=false;
        freezrStatus.running.fileSys = false;
        console.error("** FATAL ERROR Setting up file system. ");
        app.listen(port, ipaddress);
    } else if (init.params.freezr_is_setup) {
        db_main.init_admin_db(false, function (err, results) {
            if (err) {
                console.error("** FATAL ERROR ON STARTUP - DB not available: "+JSON.stringify(err));
                freezrStatus.allOkay=false;
                freezrStatus.running.db = false;
                app.listen(port, ipaddress);
            }  else {            
                require('dns').lookup(require('os').hostname(), function (err, add, fam) {
                    if (ipaddress=="localhost" && !LISTEN_TO_LOCALHOST_ON_LOCAL) ipaddress=add;
                    console.log('Running on local ip address: '+ipaddress);
                    app.listen(port, ipaddress);
                })
            }

        });
    } else {
        fs.writeFile(helpers.fullPath("userfiles/config.js"), "exports.params=" + JSON.stringify(config.params), function(err) {
            if(err) {
                freezrStatus.allOkay=false;
                freezrStatus.running.fileWrite = false;
                console.error("** FATAL ERROR ON STARTUP -writing files: "+JSON.stringify(err));
                app.listen(port, ipaddress);
                //process.exit(-1);
            } else {
                app.listen(port, ipaddress);
            }
       }); 
        
    }




