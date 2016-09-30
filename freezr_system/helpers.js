// freezr.info - nodejs system files - helpers.js
exports.version = '0.0.1';


var path = require('path'), 
    fs = require('fs'), 
    async = require('async'),
    flags_obj = require("./flags_obj.js"),
    system_env = require('../freezr_system/system_env.js');


// SEND SUCCESS / FAILURE
    exports.send_success = function(res, data) {
        //onsole.log("onto send success")
        if (!data) data = {};
        data.error = null;
        //var output = { error: null, data: data };
        res.end(JSON.stringify(data) + "\n");
    }

    exports.send_failure = function(res, err, system_file, version, theFunction ) {
        // Note: SNBH = Should Not Be Here - ie unexpected error
        console.log("* * * ERROR *** : Helpers send failure in system_file "+system_file+" function: "+theFunction+"  error"+err);
        var code = (typeof err == 'string')? err :(err.code ? err.code : err.name);
        var message = (typeof err == 'string')? err :(err.message ? err.message : code);
        res.writeHead(200, { "Content-Type" : "application/json" });
        res.end(JSON.stringify({ error: "Action failed", code:err.code, message: err.message }) /*+ "\n"*/);
    }

// ERRORS
    exports.error = function (code, message) {
        var e = new Error(message);
        e.code = code;
        return e;
    };
    exports.auth_failure = function (system_file, version, theFunction, message ) {
        console.log ("* * * ERROR *** :  Auth Error in system_file "+system_file+" function: "+theFunction+" message:"+message);
        return exports.error("authentication",
                             "Authentication error: "+message);
    };
    exports.internal_error = function (system_file, version, theFunction, message ) {
        console.log ("* * * ERROR *** :  Internal Error in system_file "+system_file+" function: "+theFunction+" message:"+message);
        return exports.error("internal_error",
                             "Internal error: "+message);
    };    
    exports.warning = function (system_file, version, theFunction, message ) {
        //
        console.log ("* * * WARNING *** :  Possible malfunction in system_file "+system_file+" function: "+theFunction+" message:"+message);
    };
    exports.auth_warning = function (system_file, version, theFunction, message ) {
        //
        console.log ("* * * WARNING *** :  Possible malfunction in system_file "+system_file+" function: "+theFunction+" message:"+message);
    };

    exports.app_data_error = function(version, theFunction, app_name, message) {
        console.log ("App Data ERROR in function: "+theFunction+" app_name: "+app_name+" message:"+message);
        return exports.error("app_data_error", message);
    }
    exports.send_auth_failure = function (res, system_file, version, theFunction, message ) {
        var err = exports.auth_failure (system_file, version, theFunction, message )
        exports.send_failure(res, err, system_file, version, theFunction, message )
    };
    exports.send_internal_err_failure = function (res, system_file, version, theFunction, message ) {
        var err = exports.internal_error (system_file, version, theFunction, message )
        exports.send_failure(res, err, system_file, version, theFunction, message )
    };
    exports.send_internal_err_page= function (res, system_file, version, theFunction, message ) {
        var err = exports.internal_error (system_file, version, theFunction, message )
        res.redirect('/account/home?error=true&error_type=internal&file='+system_file+"&msg="+message)
    };
    exports.missing_data = function (what, system_file, version, theFunction) {
        console.log ("WARNING - Missing Data err in system_file "+system_file+" function: "+theFunction+" missing:"+what);
        return exports.error("missing_data",
                             "You must include " + what);
    }    
    exports.invalid_data = function (what, system_file, version, theFunction) {
        console.log ("WARNING - Invalid Data err in system_file "+system_file+" function: "+theFunction+" missing:"+what);
        return exports.error("invalid_data",
                             "Data is invalid: " + what);
    }
    exports.user_exists = function (type) {
        return exports.error("user exists",
                             "There is already a user with this "+type);
    };
    exports.data_object_exists = function (object_id) {
        return exports.error("data exists",
                             "There is already a data object with these unique attributes "+object_id);
    };
    exports.valid_filename = function (fn) {
        var re = /[^\.a-zA-Z0-9-_ ]/;
        // @"^[\w\-. ]+$" http://stackoverflow.com/questions/11794144/regular-expression-for-valid-filename
        return typeof fn == 'string' && fn.length > 0 && !(fn.match(re));
    };
    exports.valid_app_name = function(app_name) {
        if (!app_name) return false;
        if (!exports.valid_filename(app_name)) return false;
        if (exports.starts_with_one_of(app_name, ['.','-','\\'] )) return false;
        var app_segements = app_name.split('.');
        if (app_segements.length <3) return false;
        return true;
    }
    exports.valid_path_extension = function(aPath) {
        var parts = aPath.split(path.sep);
        if (!aPath) return true;
        for (var i=0; i<parts.length; i++) {
            if (!exports.valid_dir_name(parts[i]) ) return false
        }
    return true;
    }
    exports.valid_dir_name = function(dir) {
        var re = /[^\a-zA-Z_0-9-.]/;
        return typeof dir == 'string' && dir.length > 0 && !(dir.match(re));
    }
    exports.email_is_valid = function(email) {
        // can make a little more sophisticated...
        return (email.indexOf("@") > 0 && email.indexOf(".")>0)
    }
    exports.user_id_is_valid = function(uid) {
      return (uid.indexOf("@") < 0)
    }
    exports.invalid_email_address = function () {
        return exports.error("invalid_email_address",
                            "That's not a valid email address, sorry");
    };
    exports.invalid_user_id = function () {
        return exports.error("invalid_user_id",
                            "That's not a valid display name - cannot include spaces. sorry");
    };

// UTILITIES
    exports.startsWith = function(longertext, checktext) {
        if (checktext.length > longertext.length) {return false} else {
        return (checktext == longertext.slice(0,checktext.length));}
    }
    exports.endsWith = function (longertext, checktext) {
        if (checktext.length > longertext.length) {return false} else {
        return (checktext == longertext.slice((longertext.length-checktext.length)));}
    }

    exports.starts_with_one_of = function(thetext, stringArray) {
        for (var i = 0; i<stringArray.length; i++) {
            if (exports.startsWith(thetext,stringArray[i])) return true;
        }
        return false;
    }
    exports.fileExt = function(filename) {
        var ext = path.extname(filename);
        if (ext && ext.length>0) ext = ext.slice(1);
        return ext;
    }
    exports.addToListAsUnique = function(aList,anItem) {
        if (!anItem) {
            return aList
        } else if (!aList) {
            return [anItem]
        } else if (aList.indexOf(anItem) < 0) {
            aList.push(anItem);
        } 
        return aList
    }
    exports.now_in_s = function () {
        return Math.round((new Date()).getTime() / 1000);
    }
    exports.randomText = function(textlen) {
        // http://stackoverflow.com/questions/1349404/generate-a-string-of-5-random-characters-in-javascript
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for( var i=0; i < textlen; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
    }

// MAIN LOAD PAGE
    exports.load_page_skeleton = function(res, opt) {
        fs.readFile(
            'html_skeleton.html',
            function (err, contents) {
                if (err) {
                    send_failure(res, 500, err);
                    return;
                }

                contents = contents.toString('utf8');


                if (!opt.app_name) {
                    // need these two to function
                    opt.app_name = "freezer.info.public";
                    opt.page_url = 'fileNotFound.html';
                }

                console.log("Options ARE "+JSON.stringify(opt))

                contents = contents.replace('{{PAGE_TITLE}}', opt.page_title? opt.page_title: "app - freezr");
                contents = contents.replace('{{PAGE_URL}}', exports.partPathToAppFiles(opt.app_name, opt.page_url) );
                contents = contents.replace('{{INITIAL_DATA}}', JSON.stringify(opt.initial_data) );
                contents = contents.replace('{{APP_CODE}}', opt.app_code? opt.app_code: '');
                contents = contents.replace('{{APP_NAME}}', opt.app_name);
                contents = contents.replace('{{APP_VERSION}}', (opt.app_version));
                contents = contents.replace('{{APP_DISPLAY_NAME}}', (opt.app_display_name? opt.app_display_name: opt.app_name));
                contents = contents.replace('{{USER_ID}}', opt.user_id? opt.user_id: '');
                contents = contents.replace('{{USER_IS_ADMIN}}', opt.user_is_admin? opt.user_is_admin : false);
                contents = contents.replace('{{FREEZR_SERVER_VERSION}}', (opt.freezr_server_version? opt.freezr_server_version: "N/A"));
                contents = contents.replace('{{SERVER_NAME}}', opt.server_name);


                var css_files = "", thePath;
                if (opt.css_files) {
                    if (typeof opt.css_files == "string") opt.css_files = [opt.css_files];
                    opt.css_files.forEach(function(a_file) {
                        thePath = exports.startsWith(a_file,"info.freezr.public")? exports.partPathToFreezrPublicFile(a_file):exports.partPathToAppFiles(opt.app_name, a_file) 
                        if (exports.fileExt(thePath) == 'css'){
                            css_files = css_files +  ' <link rel="stylesheet" href="'+thePath+'" type="text/css" />'
                        } else {
                            exports.warning("helpers.js",exports.version,"load_page_skeleton", "ERROR - NON CSS FILE BEING SUED FOR CSS.")
                        }

                    });
                }
                contents = contents.replace('{{CSS_FILES}}', css_files)

                var script_files = "";
                if (opt.script_files) {
                    opt.script_files.forEach(function(pathToFile) {
                            script_files = script_files +  '<script src="'+pathToFile+'" type="text/javascript"></script>';
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

// APP CONFIG
    exports.permitted_types = { 
        group_permission_options: ["user","logged_in"],
        perms_to_access_objects: ["folder_delegate","field_delegate","object_delegate"], // used in getDataObject

    }
    
    exports.get_app_config = function(app_name) {
        var returnJson= {};
        var configPath = exports.fullPath('/app_files/'+app_name+'/app_config.js',true);
        try {
            delete require.cache[require.resolve(configPath)]
                // should be for developers only
                // http://stackoverflow.com/questions/1972242/auto-reload-of-files-in-node-js+&cd=3&hl=en&ct=clnk
            //returnJson = require('../app_files/'+app_name+'/app_config.js');
            returnJson = require(configPath);
        } catch (e) {
            returnJson.structure = null;
        }
        return returnJson.structure;
    }
    exports.check_app_config = function(app_config, app_name, app_version, flags){
        //onsole.log("check_app_config "+app_name+" :"+JSON.stringify(app_config));
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




// FILES, PATHS AND DIRECTORIES
    const SYSTEM_APPS = ["info.freezr.account","info.freezr.admin","info.freezr.public"];
    const USER_DIRS = ["userfiles", "app_files", "backups"];
    exports.setupFileSys = function() {
        // reTurns false if it can't se up directories - and system fails
        allSetUp = true;
        try {
            USER_DIRS.forEach(function(userDir) {
                var path = exports.fullPath(userDir);
                if (!fs.existsSync(path) ) fs.mkdirSync(path);
            });
        } catch (e) {
            exports.error("helpers.js",exports.version,"setupFileSys", "Error setting up user directories: "+JSON.stringify(e));
            allSetUp = false;
        }
        return allSetUp
    }   
    exports.partPathToFreezrPublicFile = function(partPath) {
        return '/app_files/'+partPath;
    }
    exports.partPathToAppFiles = function(app_name, fileName) {
        if (exports.startsWith(fileName,"info.freezr.public")) return '/app_files/'+fileName;
        return '/app_files/'+app_name+ (fileName? '/'+fileName: '') ;
    }
    var isSystemPath = function(aUrl) {
        var parts = aUrl.split("/");
        var app_name = (parts && parts.length>1)? parts[1]:"";
        return (SYSTEM_APPS.indexOf(app_name)>=0);
    }
    exports.normUrl = function(aUrl) {return path.normalize(aUrl) };
    exports.sep = function() {return path.sep };
    exports.fullPath = function(aUrl, isAppFile) {
        var first_part =  (system_env.separateNonSystemDirs() && 
                           isAppFile 
                           && !isSystemPath(aUrl))  ? 
                                system_env.environment_dir() : system_env.system_dir();  
        return path.normalize(first_part + path.sep + exports.removeStartAndEndSlashes(aUrl) ) ;
    }
    exports.fullPathToAppFiles = function(app_name, fileName) {
        return exports.fullPath('app_files'+path.sep+app_name+ (fileName? path.sep+fileName: '') , true);
    }
    exports.checkUserDirExists = function (aPath,callback) {
        // from https://gist.github.com/danherbert-epam/3960169
        var pathSep = path.sep;
        var dirs = aPath.split(pathSep);
        var root = "";
        
        mkDir();

        function mkDir(){
            var dir = dirs.shift();
            if (dir === "") {// If directory starts with a /, the first path will be an empty string.
                root = pathSep;
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
    exports.removeStartAndEndSlashes = function(aUrl) {
        if (exports.startsWith(aUrl,"/")) aUrl = aUrl.slice(1);
        if (aUrl.slice(aUrl.length-1) == "/") aUrl = aUrl.slice(0,aUrl.length-1);
        return aUrl;

    }
    exports.auto_enumerate_filename = function(folderpath,filename) {
        var parts = filename.split('.')
        var has_version_num = !isNaN(parts[parts.length-2]);
        var version_num = has_version_num? parseInt(parts[parts.length-2]): 1;
        if (!has_version_num) parts.splice(parts.length-1,0,version_num);
        parts[parts.length-2] = version_num++

        while (fs.existsSync(path.normalize(folderpath +"/" +parts.join('.'))) ){
            parts[parts.length-2] = version_num++;
        }
        return parts.join(".");
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


// SENSORING FILES
    var illegal_words_list = ['http','eval','setattribute'];
    var allowed_app_directories = ['static'];
    exports.sensor_app_directory_files = function (app_name, flags, callback) {
        var app_path = exports.fullPathToAppFiles(app_name);
        var appfiles = fs.readdirSync(app_path);
        var file_ext = "", file_text="";
        if (!flags) flags = new Flags({'app_name':app_name});
        
        async.forEach(appfiles, function(filename, cb2) {
            var skip_file=false;
            async.waterfall([
                // 1. get file stats
                function (cb) {
                    skip_file = false;
                    fs.stat(app_path+path.sep+filename, cb)
                },  

                // 2. if directory skip... if not read file
                function (stats, cb) {
                    if (stats.isDirectory()) {
                        skip_file = true;
                        if (allowed_app_directories.indexOf(filename)<0) {flags.add('illegal','extra_directory_illegal', {'dir':filename} )}
                        cb(null, cb)
                    } else {
                        fs.readFile(app_path+path.sep+filename, cb)
                    }
                },  

                // sensor filetext
                function (data, cb) {
                    if (!skip_file) flags = sensor_file_text(data, filename, flags);
                    cb(null)
                }

                ],
                function (err) {
                    if (err) {
                        exports.warning("helpers.js",exports.version,"sensor_app_directory_files", "Got err (1): "+JSON.stringify(err));
                        flags.add('errors','err_file',{'function':'sensor_app_directory_files', 'text':JSON.stringify(err), 'filename':filename});
                        cb2(null);
                    } else {
                        cb2(null);
                    }
                });
        }, 
        function (err) {
            if (err) { 
                exports.warning("helpers.js",exports.version,"sensor_app_directory_files", "Gor err (2): "+JSON.stringify(err));
                flags.add('errors','err_unknown',{'function':'sensor_app_directory_files', 'text':JSON.stringify(err)})
                callback(null, flags, callback);
            } else {
                callback(null, flags, callback);
            }
        })

    }
    var sensor_file_text = function (aText, filename, flags) {
        // todo review and amerliorate sensor algorithm
        // Write now sensor only gives warnings... at some point it will also sensor
        //onsole.log("senoring "+filename+" with flags"+JSON.stringify(flags));
        if (!flags) flags = new Flags();
        
        var file_ext = exports.fileExt(filename);
        var found_illegal_words = [];

        if (file_ext == 'js') {
            found_illegal_words = get_illegalWords(aText);
            if (found_illegal_words.length>0) flags.add('illegal','file_illegal_words', {'words':found_illegal_words.join(','), 'filename':filename} );
        } else if (file_ext == 'css') {
            // todo... anthing?
        } else if (file_ext == 'html') {
            // to do - go through attributes and sensor

        } else {
            flags.add('warnings','file_illegal_extension',{'filename':filename});
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






