// freezr.info - nodejs system files - system_env.js
// System environment variable - currently set up for own-servers and for Openshift
exports.version = "0.0.1";

const SYSTEM_APPS = ["info.freezr.account","info.freezr.admin","info.freezr.public"];
var path = require('path');

exports.ipaddress = function() {return process.env.OPENSHIFT_NODEJS_IP || 'localhost';}
exports.port      = function() {return process.env.OPENSHIFT_NODEJS_PORT || 3000;}

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
  if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
    return process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
    process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
    process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
    process.env.OPENSHIFT_MONGODB_DB_PORT + '/'+
    appName +'?authSource=admin';
  } else {
      return 'localhost:27017/'+appName
  }
}