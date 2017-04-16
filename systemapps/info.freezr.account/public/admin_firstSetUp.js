
freezr.initPageScripts = function() {
  document.getElementById('register').onsubmit = function (evt) {
    evt.preventDefault();
    var user_id   = document.getElementById('user_id')?   document.getElementById('user_id').value:null;
    var password  = document.getElementById('password')?  document.getElementById('password').value:null;
    var password2 = document.getElementById('password2')? document.getElementById('password2').value:null;
    

    var db_user  = document.getElementById('db_user')?  document.getElementById('db_user').value : null;
    var db_pword = document.getElementById('db_pword')? document.getElementById('db_pword').value:null;
    var db_host  = document.getElementById('db_host')?  document.getElementById('db_host').value:null;
    var db_port  = document.getElementById('db_port')?  document.getElementById('db_port').value:null;
    var db_unifiedDbName  = document.getElementById('db_unifiedDbName')?  document.getElementById('db_unifiedDbName').value:null;
    var db_addAuth=document.getElementById('db_addAuth')? document.getElementById('db_addAuth').checked:null;

    var wantsExternalDb = (db_host || db_pword);
    var hasAllDbParams  = (db_port && db_host && db_pword && db_user);


    if (!user_id || !password) {
      showError("You need a name and password to log in");
    } else if (user_id.indexOf("_")>-1 || user_id.indexOf(" ")>-1 || user_id.indexOf("/")>-1) {
      showError("user id's cannot have '/' or '_' or spaces in them");
    } else if (!password2 || password != password2) {
      showError("Passwords have to match");
    } else  if (wantsExternalDb && !hasAllDbParams) {
      showError("You haven't enterred all the parameters for an external data base. If you want to use an external database, enter all the parameters (user, password,host, port). If not, please leave all of them empty.");
    } else {
      showError("");
      document.getElementById("register").style.display="none";
      document.getElementById("loader").style.display="block";
      var externalDb = wantsExternalDb? {port:db_port, host:db_host, pass:db_pword, user:db_user, addAuth:db_addAuth}:null;
      var theInfo = { register_type: "setUp",
                      isAdmin: "true",
                      user_id: user_id,
                      password: password,
                      externalDb: externalDb,
                      unifiedDbName:db_unifiedDbName
                    };
      freezer_restricted.connect.write("/v1/admin/first_registration", theInfo, gotRegisterStatus, "jsonString");
    }
  }

  document.getElementById("showAdvancedOptions").onclick = function() {
    document.getElementById("showAdvancedOptions").style.display="none";
    document.getElementById("advancedOptions").style.display="block";
  }

  if (!freezrServerStatus.allOkay) {
    var inner = "There was a serious issue with your freezr server environement.<br/>";
    if (!freezrServerStatus.running.fileWrite) {
      inner+= "The system cannot write on the server. This is required for the freezr server to run. Please fix this to be able to continue<br/>";
      document.getElementById("register").style.display = "none";
    }
    if (!freezrServerStatus.running.db) {
      inner+= "The database is not set up. ";
      inner+= freezrServerStatus.running.fileWrite? "If you are running the database on this same server, please make sure it is running, and then restart the freezr server (ie node) and finally refresh this page. <br/>If you want to use a database on an external server, please enter authentication details below under Advanced Options, so that you can continue.<br/>":"<br/>";
    }
    if (!freezrServerStatus.running.fileSys) {
      inner+= "freezr cannot access the file system to store user files or new apps.<br/>";
    }
    showError(inner);
  }
}

var gotRegisterStatus = function(data) {
  if (data) data = freezr.utils.parse(data);
  console.log("gotRegisterStatus "+JSON.stringify(data));
  if (!data) {
    showError("Could not connect to server");
  } else if (data.error) {
    showError("Error: "+data.message);
  } else {
    window.location = "/admin/registration_success";
  }
      document.getElementById("register").style.display="block";
      document.getElementById("loader").style.display="none";
}
var randomText = function(textlen) {
    // stackoverflow.com/questions/1349404/generate-a-string-of-5-random-characters-in-javascript
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < textlen; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}
var showError = function(errorText) {
  var errorBox=document.getElementById("errorBox");
  errorBox.innerHTML= errorText;
}


