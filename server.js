// freezr.info - nodejs system files - main file: freezr.js 
var version = "0.0.1";

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
var config = require("./freezr_system/config.js");
    db_main = require('./freezr_system/db_main.js'),
    admin_handler = require('./freezr_system/admin_handler.js'),
    account_handler = require('./freezr_system/account_handler.js'),
    helpers = require('./freezr_system/helpers.js'),
    system_env = require('./freezr_system/system_env.js'),
    app_handler = require('./freezr_system/app_handler.js');

var ipaddress = system_env.ipaddress();
var port      = system_env.port();


app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(cookieParser());

if (config.params.session_cookie_secret == ".uninitiated") {
    // 
    config.params.session_cookie_secret = helpers.randomText(10);
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
            helpers.warning("freezr.js", version, "publicFileServe", "link to non-existent file "+fileUrl );
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

    if (!fs.existsSync( filePath)) {
        if (!helpers.endsWith(fileUrl,"logo.png")) {
            helpers.warning("freezr.js", version, "appFileAccessRights", "link to non-existent file "+filePath );
        }
        res.sendStatus(401);
    } else if(config.params.freezr_is_setup && ((req.session && req.session.logged_in) || (app_name == "info.freezr.public") )) {
        //onsole.log("appFileAccessRights send "+helpers.fullPath(fileUrl));
        res.sendFile(filePath);
    } else {
        helpers.auth_warning("freezr.js", version, "appFileAccessRights", "Unauthorized attempt to access file "+filePath );
        res.sendStatus(401);
    }
}
var appPageAccessRights = function(req, res, next) {
    if ((config.params.freezr_is_setup && req.session && req.session.logged_in) ){
        if (req.params.page || helpers.endsWith(req.originalUrl,"/") ) {
            next();
        } else {
            res.redirect(req.originalUrl+'/');
        }
    } else {
        helpers.auth_warning("freezr.js", version, "appPageAccessRights", "Unauthorized attempt to access page"+req.url+" without login ");
        res.redirect('/account/login')
    }
}
var userDataAccessRights = function(req, res, next) {
    // todo - this can be made more sophisticated with per app per user access via mongo
    //onsole.log("userDataAccessRights sess "+(req.session?"Y":"N")+"  loggin in? "+(req.session.logged_in?"Y":"N"));
    if (config.params.freezr_is_setup && req.session && req.session.logged_in && req.session.logged_in_userid == req.params.userid){
        next();
    } else {
        helpers.auth_warning("freezr.js", version, "userDataAccessRights", "Unauthorized attempt to access data "+req.url+" without login ");
        res.sendStatus(401);
    }
}
function requireAdminRights(req, res, next) {
    //onsole.log("require admin login ");
    if (config.params.freezr_is_setup && req.session && req.session.logged_in_as_admin) {
        next();
    } else {
        helpers.auth_warning("freezr.js", version, "requireAdminRights", "Unauthorized attempt to access admin area "+req.url+" - ");
        res.redirect("/account/login");
    }
}
function requireUserRights(req, res, next) {
    //onsole.log("require user rights login "+req.params.user_id+ " vs "+JSON.stringify(req.session));
    if (config.params.freezr_is_setup && req.session && (req.url == "/account/login" || helpers.startsWith(req.url,'/account/applogin') || req.session.logged_in_user_id )) {
        next();
    } else {
        helpers.auth_warning("freezr.js", version, "requireUserRights", "Unauthorized attempt to access data "+req.url+" without login ");
        res.redirect("/account/login");
    }
}
function ensureThisIsFirstSetUp (req, res, next) {
    if (!config.params.freezr_is_setup && req.body.register_type == "setUp") {
        next();
    } else {
        helpers.auth_warning("freezr.js", version, "ensureThisIsFirstSetUp", "Unauthorized attempt to set up system which has already been set up. ");
        res.redirect("/account/login");
    }
}
function requirePageLogin(req, res, next) {
    //onsole.log("require page login");
    if (req.session && req.session.logged_in) {
        next();
    } else {
        helpers.auth_warning("freezr.js", version, "ensureThisIsFirstSetUp", "Unauthorized attempt to set up system which has already been set up. ");
        res.redirect("/account/login");
    }
}
function uploadFile(req,res) {
    upload(req, res, function (err) {
        if (err) {
            helpers.send_failure(res, err, "freezr.js", exports.version, "uploadFile");
        }
        app_handler.putData(req,res);
    })
}
function uploadAppZipFile(req,res) {
    upload(req, res, function (err) {
        if (err) {
            helpers.send_failure(res, err, "freezr.js", exports.version, "uploadAppZipFile");
        }
        account_handler.add_uploaded_app_zip_file(req,res);
    })
}

// APP PAGES AND FILE
    // app pages and files
        app.use("/app_files/info.freezr.public", publicFileServe);
        //app.get('/app_files/info.freezr.public/:file', publicFileServe);
        //app.get("/app_files/info.freezr.public", publicFileServe);
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
        app.get ('/account/logout', account_handler.logout);
        app.get ('/account/login', account_handler.generate_login_page);
        app.get ('/account/login/:loginaction', account_handler.generate_login_page);
        app.get ('/account/applogin/login/:app_name', account_handler.generate_login_page);
        app.get ('/account/applogin/results', account_handler.generate_applogin_results);
        app.get ('/account/:sub_page', requireUserRights, account_handler.generateAccountPage);

        app.post('/v1/account/login', account_handler.login);
        app.post('/v1/account/applogin', account_handler.login);
        app.put ('/v1/account/changePassword.json', requireUserRights, account_handler.changePassword); 
        app.put ('/v1/account/add_app_manually.json', requireUserRights, account_handler.addAppManually); 
        app.put ('/v1/account/upload_app_zipfile.json', requireUserRights, uploadAppZipFile); 

        app.get('/account/v1/app_list.json', requireUserRights, account_handler.list_all_user_apps);
        app.post('/account/v1/appMgmtActions.json', requireUserRights, account_handler.appMgmtActions);

    // admin pages
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
        console.error("** FATAL ERROR Setting up file system. ");
        process.exit(-1);
    } else if (config.params.freezr_is_setup) {
        db_main.init_admin_db(false, function (err, results) {
            if (err) {
                console.error("** FATAL ERROR ON STARTUP (1): "+JSON.stringify(err));
                process.exit(-1);
            }
            console.log("Initialisation complete.");

            require('dns').lookup(require('os').hostname(), function (err, add, fam) {
                if (ipaddress=="localhost" && !LISTEN_TO_LOCALHOST_ON_LOCAL) ipaddress=add;
                console.log('Running on local ip address: '+ipaddress);
                app.listen(port, ipaddress);
            })

        });
    } else {
        console.log("Running Server to start user setup.");
        fs.writeFile("./freezr_system/config.js", "exports.params=" + JSON.stringify(config.params), function(err) {
            if(err) {
                console.error("** FATAL ERROR ON STARTUP (2): "+JSON.stringify(err));
                process.exit(-1);
            } else {
                app.listen(port, ipaddress);
            }
       }); 
    }




