// freezr.info - nodejs system files - file_handler
exports.version = "0.0.1";

var path = require('path'), 
    fs = require('fs'), 
    async = require('async'), 
    helpers = require('./helpers.js'),
    flags_obj = require("./flags_obj.js");


var freezr_environment = null; // require(exports.systemPathTo("freezr_environment.js")) below
var custom_environment= null; 
/*  custom_environment can have the following
custom_environment.use
custom_environment.customFiles(app_name) - true if used ("custom_environment.use" needs to be set to true too) 
custom_environment.writeUserFile(folderPartPath, fileName, saveOptions, data_model, freezr_environment, callback)
custom_environment.sendUserFile(res, filePartPath, freezr_environment)
custom_environment.get_app_config
custom_environment.appFileExists(app_name, fileName, freezr_environment)	
custom_environment.extractZippedAppFiles(zipfile, app_name, originalname, freezr_environment, callback)
custom_environment.readUserFiles(user_id,app_name,folder_name, freezr_environment, callback)
custom_environment.userFileStats(user_id,app_name,folder_name, file_name, freezr_environment, callback);
custom_environment.readAppFileSyncParts(app_name, fileName, freezr_environment);
custom_environment.readFileSync(partialUrl, freezr_environment, callback);
*/

// General Utilities
    exports.fileExt = function(fileName) {
        var ext = path.extname(fileName);
        if (ext && ext.length>0) ext = ext.slice(1);
        return ext;
    }
	exports.sep = function() {return path.sep };
	exports.normUrl = function(aUrl) {return path.normalize(aUrl) };
	exports.removeStartAndEndSlashes = function(aUrl) {
		if (helpers.startsWith(aUrl,"/")) aUrl = aUrl.slice(1);
		if (aUrl.slice(aUrl.length-1) == "/") aUrl = aUrl.slice(0,aUrl.length-1);
		return aUrl;
	}
    exports.folder_is_in_list_or_its_subfolders = function(folder_name, checklist) {
        folder_name = exports.removeStartAndEndSlashes(folder_name);
        if (!folder_name || !checklist || checklist.length==0)  return false;
        var sharable_folder;
        for (var i= 0; i<checklist.length; i++) {
            sharable_folder = exports.removeStartAndEndSlashes(checklist[i])
            if (exports.startsWith(folder_name, sharable_folder)) {
                return true;
            }
        }
        return false;
    }
    exports.valid_path_extension = function(aPath) {
        var parts = aPath.split(path.sep);
        if (!aPath) return true;
        for (var i=0; i<parts.length; i++) {
            if (!helpers.valid_dir_name(parts[i]) ) return false
        }
    return true;
    }


// APP FILES
exports.appFileExists = function(app_name, fileName) {
	if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles(app_name) ) {
		return custom_environment.appFileExists(app_name, fileName, freezr_environment)
	} else {
	    return fs.existsSync(exports.fullPathToAppFiles(app_name,fileName));
	}
}
exports.existsSyncSystemAppFile = function(fullPath) {
    return fs.existsSync(fullPath);
}
exports.sendAppFile = function(res, partialUrl) {
	var path_parts = partialUrl.split("/");
	var app_name = path_parts[1];
	// onsole.log("Sending app file "+partialUrl); // +" for app "+app_name

	if (isSystemApp(app_name) || !custom_environment || !custom_environment.use || !custom_environment.customFiles || !custom_environment.customFiles(app_name) ) {
	    var filePath = (helpers.system_apps.indexOf(app_name)>=0)? exports.systemAppsPathTo(partialUrl):exports.userAppsPathTo(partialUrl);
	    if (!fs.existsSync( filePath)) {
	        if (!helpers.endsWith(partialUrl,"logo.png")) {
	            helpers.warning("file_handler.js", exports.version, "sendAppFile", "link to non-existent file "+filePath );
	        }
	        res.sendStatus(401);
	    } else {
	    	res.sendFile(filePath);
	    } 
	} else { // custom environment - needs to eb defined by developer
		custom_environment.sendAppFile(res, fileUrl, freezr_environment);
	}
}
exports.appsPathTo = function(partialUrl) {
    var path_parts = partialUrl.split("/");
	var app_name = path_parts[1];
    return isSystemApp(app_name)? exports.systemAppsPathTo(partialUrl) : exports.userAppsPathTo(partialUrl);
}
exports.systemAppsPathTo = function(partialUrl) {
	//
	return exports.systemPathTo(partialUrl.replace("app_files","systemapps") );
}
exports.userAppsPathTo = function(partialUrl) {
	// note also used to setupfulesys with userapps, userfiles directories
	// onsole.log("userAppsPathTo  "+partialUrl);
	partialUrl = partialUrl.replace("app_files","userapps");
	if (freezr_environment && freezr_environment.userAppsDir) {
		return path.normalize(freezr_environment.userAppsDir + path.sep + exports.removeStartAndEndSlashes(partialUrl) )
	} else {
		return exports.systemPathTo(partialUrl);
	}
}
exports.partPathToAppFiles = function(app_name, fileName) {
    // onsole.log("partPathToAppFiles app "+app_name+" file "+fileName)
    if (helpers.startsWith(fileName,"./")) return '/app_files'+fileName.slice(1);
    return '/app_files/'+app_name+ (fileName? '/'+fileName: '') ;
}
exports.fullPathToUserAppFiles = function(app_name, fileName) {
	// onsole.log("fullPathToUserAppFiles  "+app_name+" freezr_environment"+JSON.stringify(freezr_environment));
    return exports.appsPathTo(('app_files'+path.sep+app_name+ (fileName? path.sep+fileName: '')) );
}
exports.fullPathToAppFiles = function(app_name, fileName) {
	//onsole.log("fullPathToAppFiles  "+app_name+" freezr_environment"+JSON.stringify(freezr_environment));
	var partialUrl = ('app_files'+path.sep+app_name+ (fileName? path.sep+fileName: ''));
	if (isSystemApp(app_name)) return exports.systemAppsPathTo(partialUrl)
    return exports.userAppsPathTo(partialUrl);
}
exports.systemPathTo = function(partialUrl) {
	if (partialUrl) {
		return path.normalize(systemPath() + path.sep + exports.removeStartAndEndSlashes(partialUrl) ) ;
	} else {
		return systemPath();	
	}
}
var systemPath = function() {
	//
	return path.normalize(__dirname.replace(path.sep+"freezr_system","") )
}
isSystemApp = function(app_name) {
	//
	return (helpers.system_apps.indexOf(app_name)>=0)
}
var isSystemPath = function(aUrl) {
        var parts = aUrl.split("/");
        var app_name = (parts && parts.length>1)? parts[1]:"";
        return isSystemApp(app_name);
}
exports.extractZippedAppFiles = function(zipfile, app_name, originalname, callback){
    if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles(app_name) ) {
        return custom_environment.extractZippedAppFiles(zipfile, app_name, originalname, freezr_environment, callback)
    } else {
        var AdmZip = require('adm-zip');
        var zip = new AdmZip(zipfile); //"zipfilesOfAppsInstalled/"+app_name);
        var zipEntries = zip.getEntries(); // an array of ZipEntry records
        var gotDirectoryWithAppName = false;
        var app_path = exports.fullPathToAppFiles(app_name, null)
        
        zipEntries.forEach(function(zipEntry) {
            // This is for case of compressing with mac, which also includes the subfolder - todo: review quirks with windows
            if (zipEntry.isDirectory && zipEntry.entryName == app_name+"/") gotDirectoryWithAppName= true;
            if (zipEntry.isDirectory && zipEntry.entryName == originalname+"/") gotDirectoryWithAppName= true;
        });

        try { 
            if (gotDirectoryWithAppName) {
                zip.extractEntryTo(app_name+"/", app_path, false, true);
            } else {
                zip.extractAllTo(app_path, true);
            }
            callback(null)
        } catch ( e ) { 
            callback(helpers.invalid_data("error extracting from zip file "+JSON.stringify(e) , "file_handler", exports.version, "extractZippedAppFiles"));
        }
    }
}

// reading and deleting
exports.deleteAppFolderAndContents = function(app_name, callback){
    if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles(app_name) ) {
        return custom_environment.deleteAppFolderAndContents(app_name,freezr_environment, callback)
    } else {
        var path = exports.fullPathToAppFiles(app_name);
        deleteFolderAndContents(path, function(err) {
            // ignores err of removing directories - todo shouldflag
            if (err) console.log("error removing app "+app_name+ "err:"+err);
            callback(null)
        });        // from http://stackoverflow.com/questions/18052762/in-node-js-how-to-remove-the-directory-which-is-not-empty
    }
}
function deleteFolderAndContents(location, next) {
    // http://stackoverflow.com/questions/18052762/in-node-js-how-to-remove-the-directory-which-is-not-empty
    fs.readdir(location, function (err, files) {
        async.forEach(files, function (file, cb) {
            file = location + '/' + file
            fs.stat(file, function (err, stat) {
                if (err) {
                    return cb(err);
                }
                if (stat.isDirectory()) {
                    deleteFolderAndContents(file, cb);
                } else {
                    fs.unlink(file, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        return cb();
                    })
                }
            })
        }, function (err) {
            if (err) return next(err)
            fs.rmdir(location, function (err) {
                return next(err)
            })
        })
    })
}
exports.readUserFiles = function(user_id,app_name,folder_name, callback){
    if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles(app_name) ) {
        return custom_environment.readUserFiles(user_id,app_name,folder_name, freezr_environment, callback);
    } else {
        fs.readdir(exports.userAppsPathTo("userfiles"+exports.sep()+user_id+exports.sep()+app_name+(folder_name?exports.sep()+folder_name:"")), callback)
    }
}
exports.userFileStats = function(user_id,app_name,folder_name, file_name, callback){
    if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles(app_name) ) {
        return custom_environment.userFileStats(user_id,app_name,folder_name, file_name, freezr_environment, callback);
    } else {
        fs.stat   (exports.userAppsPathTo("userfiles"+exports.sep()+user_id+exports.sep()+app_name+(folder_name?exports.sep()+folder_name:"")+exports.sep()+file_name), callback);
    }
}
exports.readAppFile = function(partialUrl, callback){
    if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles(app_name) ) {
        return custom_environment.readAppFile(partialUrl, freezr_environment, callback);
    } else {
        fs.readFile(exports.appsPathTo(partialUrl), 'utf8', callback);
    }
}
exports.readAppFileSyncParts = function(app_name, fileName) {
    if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles(app_name) ) {
        return custom_environment.readAppFileSyncParts(app_name, fileName, freezr_environment);
    } else {
        return fs.readFileSync(exports.fullPathToAppFiles(app_name,fileName), 'utf8');
    }
}



// SET UP
exports.setupFileSys = function() {
    // returns false if it can't se up directories - and system fails
    const USER_DIRS = ["userfiles", "userapps", "backups"];

    if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles() ) {
		return custom_environment.setupFileSys(USER_DIRS, freezr_environment)
	} else {
		allSetUp = true;
		try {
		    USER_DIRS.forEach(function(userDir) {
		        var path = exports.userAppsPathTo(userDir);
		        if (!fs.existsSync(path) ) fs.mkdirSync(path);
		    });
		} catch (e) {
		    helpers.error("file_handler.js",exports.version,"setupFileSys", "Error setting up user directories: "+JSON.stringify(e));
		    allSetUp = false;
		}
		return allSetUp
	}   
} 
exports.resetFreezrEnvironment = function() {
    try {
		delete require.cache[require.resolve(exports.systemPathTo("freezr_environment.js"))]
	    freezr_environment = require(exports.systemPathTo("freezr_environment.js"));
	    return true;
    } catch (e) {
        helpers.internal_error("file_handler", exports.version, "resetFreezrEnvironment", "Serious Error resetting freezr environment. "+e )
        return false;
    }
}  
freezr_environment = fs.existsSync(exports.systemPathTo("freezr_environment.js"))? require(exports.systemPathTo("freezr_environment.js")):null;
custom_environment = fs.existsSync(exports.systemPathTo("custom_environment.js"))? require(exports.systemPathTo("custom_environment.js")):null;


// USER FILES
exports.fullPathToUserFiles = function(targetFolder, fileName) {
	// target flder format and rights must have been valdiated.. ie starts with userfiles / user name / app name
	//onsole.log("fullPathToUserFiles  "+targetFolder+" file:"+fileName+" freezr_environment"+JSON.stringify(freezr_environment));
    var partialUrl = exports.removeStartAndEndSlashes(targetFolder) + (fileName? path.sep+fileName: '');
	return path.normalize(exports.userFilesRoot() + path.sep + partialUrl )
}
exports.userFilesRoot = function() {
	if (freezr_environment && freezr_environment.userFileDir) {
		return path.normalize(freezr_environment.userFileDir);  
	} else {
		return systemPath();				   
	}
}
exports.sendUserFile = function(res, filePartPath) {
	if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles(app_name) ) {
		custom_environment.sendUserFile(res, filePartPath, freezr_environment);
	} else {
	    res.sendFile( exports.fullPathToUserFiles(filePartPath, null) ) ;
	}
}
exports.writeUserFile = function (folderPartPath, fileName, saveOptions, data_model, req, callback) {   
	if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles(app_name) ) {
		custom_environment.writeUserFile(folderPartPath, fileName, saveOptions, data_model, req, freezr_environment, callback)
	} else {
	    localCheckExistsOrCreateUserFolder(folderPartPath, function() {
	        if (fs.existsSync(exports.fullPathToUserFiles(folderPartPath, fileName)  ) ) {
	            if ( saveOptions && saveOptions.fileOverWrite  ) {
	                // all okay
	            } else if (data_model && data_model.file && data_model.file.donot_auto_enumerate_duplicates) {
	                    cb(app_err("Config settings are set to donot_auto_enumerate_duplicates. To over-write a file, fileOverWrite must be set to true in options."));
	            } else {
	                fileName = auto_enumerate_filename(folderPartPath,fileName);
	                //fileParams.duplicated_file = true; - todo - send callback notifying of duplication
	            }
	        }
	        fs.writeFile(exports.fullPathToUserFiles(folderPartPath, fileName) , req.file.buffer, callback);
	    });
	}
}
var auto_enumerate_filename = function(folderpath,fileName) {
    var parts = fileName.split('.')
    var has_version_num = !isNaN(parts[parts.length-2]);
    var version_num = has_version_num? parseInt(parts[parts.length-2]): 1;
    if (!has_version_num) parts.splice(parts.length-1,0,version_num);
    parts[parts.length-2] = version_num++

    while (fs.existsSync( exports.fullPathToUserFiles(folderpath, parts.join('.')) ) ){
        parts[parts.length-2] = version_num++;
    }
    return parts.join(".");
}
exports.checkExistsOrCreateUserAppFolder = function (app_name, callback) {
    if (custom_environment && custom_environment.use && custom_environment.customFiles && custom_environment.customFiles(app_name) ) {
        custom_environment.checkExistsOrCreateUserFolder(app_name, freezr_environment, callback)
    } else {    
        var app_path = exports.fullPathToUserAppFiles(app_name, null);
        localCheckExistsOrCreateUserFolder(app_path, callback);
    }
}
localCheckExistsOrCreateUserFolder = function (aPath, callback) {
    // from https://gist.github.com/danherbert-epam/3960169
    var pathSep = path.sep;
    var dirs = aPath.split("/");
    var root = "";
    
    mkDir();

    function mkDir(){
        var dir = dirs.shift();
        if (dir === "") {// If directory starts with a /, the first path will be th root user folder.
            root = exports.userFilesRoot() + pathSep;
        }
        fs.exists(root + dir, function(exists){
            if (!exists){
                fs.mkdir(root + dir, function(err){
                    root += dir + pathSep;
                    if (dirs.length > 0) {
                        mkDir();
                    } else if (callback) {
                        callback();
                    }
                });
            } else {
                root += dir + pathSep;
                if (dirs.length > 0) {
                    mkDir();
                } else if (callback) {
                    callback();
                }
            }
        });
    }
};


// APP CONFIG  (check_app_config needs to be made more sophisticated and be in its own handler)
exports.get_app_config = function(app_name) {
    var returnJson= {};
    var configPath = exports.fullPathToAppFiles(app_name,'app_config.js');
    try {
        delete require.cache[require.resolve(configPath)]
            // should be for developers only
            // http://stackoverflow.com/questions/1972242/auto-reload-of-files-in-node-js+&cd=3&hl=en&ct=clnk
        //returnJson = require('../app_files/'+app_name+'/app_config.js');
        returnJson = require(configPath);
    } catch (e) {
        helpers.warning("file_handler", exports.version, "get_app_config", "Could not get config for", app_name," err: ",e )
        returnJson.structure = null;
    }
    return returnJson.structure;
}
exports.check_app_config = function(app_config, app_name, app_version, flags){
    // onsole.log("check_app_config "+app_name+" :"+JSON.stringify(app_config));
    // todo - check permissions and structure of app config
    if (!flags) flags = new Flags({'app_name':app_name, 'didwhat':'reviewed'}  );
    if (!app_config) {
        flags.add('warnings','appconfig_missing')
    } else {
        if (app_config.meta) {
            if (app_config.meta.app_version && app_version && app_version != app_config.meta.app_version) {
                    flags.add('notes','config_inconsistent_version' )
                }
            if (app_config.meta.app_name && app_name!=app_config.meta.app_name) {
                    flags.add ('notes', 'config_inconsistent_app_name',{'app_name':app_config.meta.app_name});
                }
        }
        if (app_config.pages) {
            for (var page in app_config.pages) {
                if (app_config.pages.hasOwnProperty(page)) {
                    if ( exports.fileExt(app_config.pages[page].html_file) != "html" )  flags.add("warnings", "config_file_bad_ext", {'ext':'html','filename':app_config.pages[page].html_file});
                    if (app_config.pages[page].css_files) {
                        if (typeof app_config.pages[page].css_files == "string") app_config.pages[page].css_files = [app_config.pages[page].css_files];
                        app_config.pages[page].css_files.forEach( 
                            function(one_file) {
                                if ( exports.fileExt(one_file) != "css" ) flags.add("warnings", "config_file_bad_ext", {'ext':'css','filename':one_file});
                            }
                        )                        
                    } 
                    if (app_config.pages[page].script_files) {
                        if (typeof app_config.pages[page].script_files == "string") app_config.pages[page].script_files = [app_config.pages[page].script_files];
                        app_config.pages[page].script_files.forEach(
                            function (one_file) {
                                if ( exports.fileExt(one_file) != "js" ) {
                                    flags.add("warnings", "config_file_bad_ext", {'ext':'js','filename':one_file})
                                }
                        });
                    } 
                }
            }
        }
    }
    return flags;
}

// MAIN LOAD PAGE
    const FREEZR_CORE_CSS = '<link rel="stylesheet" href="/app_files/info.freezr.public/freezr_core.css" type="text/css" />'
    const FREEZR_CORE_JS = '<script src="/app_files/info.freezr.public/freezr_core.js" type="text/javascript"></script>'
    exports.load_data_html_and_page = function(res,options){
    	if (!options.initial_data && !options.queryresults) {
            //onsole.log("load_data_html_and_page reading now "+"app_files/"+options.app_name+"/"+options.page_url)
            //fs.readFile( exports.appsPathTo("app_files/"+options.app_name+"/"+options.page_url), 'utf8', (err, html_content) => {
            fs.readFile( exports.appsPathTo(exports.removeStartAndEndSlashes(exports.partPathToAppFiles(options.app_name, options.page_url))), 'utf8', (err, html_content) => {
                if (err) {
                    helpers.warning("file_handler", exports.version, "load_data_html_and_page", "got err reading: "+exports.appsPathTo(exports.partPathToAppFiles(options.app_name, options.page_url) ) )
                    res.redirect('/account/home?error=true&error_type=internal&msg=couldnotreadfile-'+options.app_name+"/"+options.page_url)
                } else {
                    options.page_html= html_content;
                    exports.load_page_html(res,options)
                }
            });
        } else if (options.queryresults){
            var Mustache = require('mustache');
            var thePath = exports.appsPathTo("app_files/"+options.app_name+"/"+options.page_url);
            var html_body = fs.readFileSync(thePath, 'utf8');
            options.page_html =  Mustache.render(html_body, options.queryresults); 
            exports.load_page_html(res,options)
        } else {
            throw {error:"to do"}
            req.freezrInternalCallFwd = function(err, results) {
            }
        }
    }
    exports.load_page_html = function(res, opt) {
        //onsole.log("load page html",opt)
        fs.readFile(
            opt.isPublic?'html_skeleton_public.html':'html_skeleton.html',
            function (err, contents) {
                if (err) {
                    helpers.warning("file_handler", exports.version, "load_page_html", "got err reading skeleton "+(opt.isPublic?'html_skeleton_public.html':'html_skeleton.html'))
                    send_failure(res, 500, err);
                    return;
                }

                contents = contents.toString('utf8');


                if (!opt.app_name) {
                    // need these two to function
                    opt.app_name = "info.freezr.public";
                    opt.page_url = 'fileNotFound.html';
                }

                contents = contents.replace('{{PAGE_TITLE}}', opt.page_title? opt.page_title: "app - freezr");
                contents = contents.replace('{{PAGE_URL}}', exports.partPathToAppFiles(opt.app_name, opt.page_url) );
                contents = contents.replace('{{APP_CODE}}', opt.app_code? opt.app_code: '');
                contents = contents.replace('{{APP_NAME}}', opt.app_name);
                contents = contents.replace('{{APP_VERSION}}', (opt.app_version));
                contents = contents.replace('{{APP_DISPLAY_NAME}}', (opt.app_display_name? opt.app_display_name: opt.app_name));
                contents = contents.replace('{{USER_ID}}', opt.user_id? opt.user_id: '');
                contents = contents.replace('{{USER_IS_ADMIN}}', opt.user_is_admin? opt.user_is_admin : false);
                contents = contents.replace('{{FREEZR_SERVER_VERSION}}', (opt.freezr_server_version? opt.freezr_server_version: "N/A"));
                contents = contents.replace('{{SERVER_NAME}}', opt.server_name);
                contents = contents.replace('{{FREEZR_CORE_CSS}}', FREEZR_CORE_CSS);
                contents = contents.replace('{{FREEZR_CORE_JS}}', FREEZR_CORE_JS);
                var nonce = helpers.randomText(10)
                contents = contents.replace('{{FREEEZR-SCRIPT-NONCE}}', nonce);
                contents = contents.replace('{{FREEEZR-SCRIPT-NONCE}}', nonce); // 2nd instance

                contents = contents.replace('{{HTML-BODY}}', opt.page_html? opt.page_html: "Page Not found");


                var css_files = "", thePath;
                if (opt.css_files) {
                    if (typeof opt.css_files == "string") opt.css_files = [opt.css_files];
                    opt.css_files.forEach(function(a_file) {
                        thePath = exports.partPathToAppFiles(opt.app_name, a_file);
                        if (exports.fileExt(thePath) == 'css'){
                            css_files = css_files +  ' <link rel="stylesheet" href="'+thePath+'" type="text/css" />'
                        } else {
                            helpers.warning("file_handler.js",exports.version,"load_page_skeleton", "ERROR - NON CSS FILE BEING SUED FOR CSS.")
                        }

                    });
                }
                contents = contents.replace('{{CSS_FILES}}', css_files)

                var script_files = "";
                if (opt.script_files) {
                    opt.script_files.forEach(function(pathToFile) {
                    	thePath = exports.partPathToAppFiles(opt.app_name, pathToFile);
                    	script_files = script_files +  '<script src="'+thePath+'" type="text/javascript"></script>';
                    });
                    
                }
                contents = contents.replace('{{SCRIPT_FILES}}', script_files);

                // other_variables used by system only
                contents = contents.replace('{{OTHER_VARIABLES}}', opt.other_variables? opt.other_variables: 'null');

                // to do - to make messages better
                contents = contents.replace('{{MESSAGES}}', JSON.stringify(opt.messages));

                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(contents);
            }
        );
    }


/// SENSORING FILES
    var illegal_words_list = ['http','eval','setattribute'];
    var allowed_app_directories = ['static','public',('public'+path.sep+'static')];
    exports.sensor_app_directory_files = function (app_name, flags, callback) {
    	// onsole.log("sensor_app_directory_files for "+app_name )
        // todo needs to dill through sub-directories iteratively (add custom directories...)
        var app_path = exports.fullPathToUserAppFiles(app_name, null);
        var appfiles = fs.readdirSync(app_path); 
        if (fs.existsSync(app_path+path.sep+'public')) {
            var publicfiles = fs.readdirSync(app_path+path.sep+'public');
            publicfiles.forEach(function(publicfile) {
                appfiles.push("public"+path.sep+publicfile)
            } )
        }
        var file_ext = "", file_text="";
        if (!flags) flags = new Flags({'app_name':app_name});
        
        async.forEach(appfiles, function(fileName, cb2) {
            var skip_file=false;
            async.waterfall([
                // 1. get file stats
                function (cb3) {
                    skip_file = false;
                    fs.stat(app_path+path.sep+fileName, cb3)
                },  

                // 2. if directory skip... if not read file
                function (stats, cb3) {
                    if (stats.isDirectory()) {
                        skip_file = true;
                        if (allowed_app_directories.indexOf(fileName)<0) {flags.add('illegal','extra_directory_illegal', {'dir':fileName} )}
                        cb3(null, cb3)
                    } else {
                        fs.readFile(app_path+path.sep+fileName, cb3)
                    }
                },  

                // sensor filetext
                function (data, cb3) {
                    if (!skip_file) flags = sensor_file_text(data, fileName, flags);
                    cb3(null)
                }

                ],
                function (err) {
                    if (err) {
                        helpers.warning("file_handler.js",exports.version,"sensor_app_directory_files", "Got err (1): "+JSON.stringify(err));
                        flags.add('errors','err_file',{'function':'sensor_app_directory_files', 'text':JSON.stringify(err), 'fileName':fileName});
                        cb2(null);
                    } else {
                        cb2(null);
                    }
                });
        }, 
        function (err) {
            if (err) { 
                helpers.warning("file_handler.js",exports.version,"sensor_app_directory_files", "Gor err (2): "+JSON.stringify(err));
                flags.add('errors','err_unknown',{'function':'sensor_app_directory_files', 'text':JSON.stringify(err)})
                callback(null, flags, callback);
            } else {
                callback(null, flags, callback);
            }
        })
    }
    var sensor_file_text = function (aText, fileName, flags) {
        // todo review and amerliorate sensor algorithm
        // Write now sensor only gives warnings... at some point it will also sensor
        //onsole.log("senoring "+fileName+" with flags"+JSON.stringify(flags));
        if (!flags) flags = new Flags();
        
        var file_ext = exports.fileExt(fileName);
        var found_illegal_words = [];

        if (file_ext == 'js') {
            found_illegal_words = get_illegalWords(aText);
            if (found_illegal_words.length>0) flags.add('illegal','file_illegal_words', {'words':found_illegal_words.join(','), 'fileName':fileName} );
        } else if (file_ext == 'css') {
            // todo... anthing?
        } else if (file_ext == 'html') {
            // to do - go through attributes and sensor

        } else {
            flags.add('warnings','file_illegal_extension',{'fileName':fileName});
        }
        return flags;

    }
    var wordcount = function (text, fragment) {
        // http://stackoverflow.com/questions/18679576/counting-words-in-string
        if (fragment && fragment.length >0 && text && text.length>0) {
         return text.split(fragment).length;
        } else {
            return 0;
        }
    }
    var get_illegalWords = function (aText) {
        aText = aText.toString();
        found_illegal_words = [];
        illegal_words_list.forEach(function (bad_word) {
            if (aText.indexOf(bad_word)>-1) {
                found_illegal_words.push(bad_word);
            }
        });
        return found_illegal_words;
    }






