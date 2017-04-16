// freezr.info - nodejs system files 
// Default System environment variable - currently set up for own-servers and for Openshift
// It can be customized for other environments
exports.version = "0.0.11";

 
exports.autoConfigs = function() {
  var autoConfigs = {
    port        : autoPort(), 
    dbParams    : autoDbParams(), //{oneDb , addAuth}
    userFileDir : autoUserFilesDir(), // {url:}
    userAppsDir : autoUserAppsDir(), // {url:}
    useCustomDir: false            // 
  }
  return {params: autoConfigs}
}

var autoPort = function() {
  if ( process && process.env && process.env.OPENSHIFT_NODEJS_PORT) {
      return process.env.OPENSHIFT_NODEJS_PORT; // openshift v3
  } else if (process && process.env && process.env.PORT && process.env.OPENSHIFT_MONGODB_DB_USERNAME) {
      return process.env.PORT;                  // openshift v2
  }  else if (process && process.env && process.env.PORT) { // aws
      return process.env.PORT;          
  }                                            // add other platforms here
  else return 3000;
}

var autoSeparateUserDirs = function() {
  if (process && process.env && process.env.OPENSHIFT_DATA_DIR) {
    return true;                                   // openshift
  }                                                // add other platforms here    
  else return false;
}
var autoUserFilesDir = function() {
  if (process && process.env && process.env.OPENSHIFT_DATA_DIR) {    // openshift
    return process.env.OPENSHIFT_DATA_DIR.slice(0,process.env.OPENSHIFT_DATA_DIR.length-1); 
  } else return null;
}
var autoUserAppsDir = function() {
  if (process && process.env && process.env.OPENSHIFT_DATA_DIR) {    // openshift
    return process.env.OPENSHIFT_DATA_DIR.slice(0,process.env.OPENSHIFT_DATA_DIR.length-1); 
  } else return null;
}

var autoDbParams = function() {
  // from https://github.com/openshift/nodejs-ex/blob/master/server.js
  if (   process && process.env
      && process.env.OPENSHIFT_MONGODB_DB_PASSWORD 
      && process.env.OPENSHIFT_MONGODB_DB_USERNAME 
      && process.env.OPENSHIFT_MONGODB_DB_PASSWORD 
      && process.env.OPENSHIFT_MONGODB_DB_HOST 
      && process.env.OPENSHIFT_MONGODB_DB_PORT) 
    { return { // v2 Openshift
        user : process.env.OPENSHIFT_MONGODB_DB_USERNAME,
        pass : process.env.OPENSHIFT_MONGODB_DB_PASSWORD, 
        host : process.env.OPENSHIFT_MONGODB_DB_HOST, 
        port : process.env.OPENSHIFT_MONGODB_DB_PORT,
        addAuth : true,
        oneDb: false
    }
  } else if (  process && process.env
            && process.env.DATABASE_SERVICE_NAME 
            && process.env.MONGODB_USER 
            && process.env.MONGODB_PASSWORD) { // openshift v3
        var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase();
        return { // v2 Openshift
            user : process.env.MONGODB_USER, //[mongoServiceName + '_USER'],
            pass : process.env.MONGODB_PASSWORD, //[mongoServiceName + '_PASSWORD']?? 
            host : process.env[mongoServiceName + '_SERVICE_HOST'],
            //dbase: process.env[mongoServiceName + '_DATABASE'], 
            port : process.env[mongoServiceName + '_SERVICE_PORT'],
            addAuth : true,
            oneDb: false // true
        }
  } else {
      return{ // default local
            user : null,
            pass : null, 
            host : 'localhost',
            port : '27017',
            addAuth : false,
            oneDb: false
        }
  }  
}
