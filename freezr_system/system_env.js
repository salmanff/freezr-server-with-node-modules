// freezr.info - nodejs system files - system_env.js
// System environment variable - currently set up for own-servers and for Openshift
exports.version = "0.0.1";

const SYSTEM_APPS = ["info.freezr.account","info.freezr.admin","info.freezr.public"];
var path = require('path');

exports.ipaddress = function() {return process.env.PORT || process.env.OPENSHIFT_NODEJS_IP || 'localhost';}
exports.port      = function() {return process.env.IP   || process.env.OPENSHIFT_NODEJS_PORT || 3000;}

exports.environment_dir = function () {
	if (process.env.OPENSHIFT_DATA_DIR) return process.env.OPENSHIFT_DATA_DIR.slice(0,process.env.OPENSHIFT_DATA_DIR.length-1); 
	else return exports.system_dir();
}
exports.system_dir = function () {
	return path.normalize(__dirname.replace(path.sep+"freezr_system","") );
}


exports.separateNonSystemDirs = function() {
	if (process.env.OPENSHIFT_DATA_DIR) return true;
	else return false;
}

exports.dbConnectionString = function(appName) {
  // currently customized for openshift and local deployment (standAloneSystem) only...
  
  // from https://github.com/openshift/nodejs-ex/blob/master/server.js
  if (process.env.OPENSHIFT_MONGODB_DB_PASSWORD){ // v2 Openshift
    return process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
        process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
        process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
        process.env.OPENSHIFT_MONGODB_DB_PORT + '/'+
        appName +'?authSource=admin';

  } else if (process.env.DATABASE_SERVICE_NAME){ // openshift v3
      var mongoURL = null; 
      //    mongoURLLabel = "";
      
      var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
            mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
            mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
            //mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
            mongoPassword = process.env.MONGODB_PASSWORD, //[mongoServiceName + '_PASSWORD']
            mongoUser = process.env.MONGODB_USER; //[mongoServiceName + '_USER'];
      
      return mongoUser + ":" +
        mongoPassword + "@" +
        mongoHost + ':' +
        mongoPort + '/'+
        appName +'?authSource=admin';    
  } else {
      return 'localhost:27017/'+appName
  }
}