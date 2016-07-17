
// Core freezr API
  var freezr = {
      'db':{},  // data base related functions
      'perms':{}, // grant and query permissions
      'html':{},  // functions to render pages
      'filePath': {},  // functions to generate a correct path to files
      'initPageScripts':null, // initPageScripts can be defined in the app's js file to run initial scripts upon page load.
      'utils':{},
      'menu':{},
      'app': {
        'isWebBased':true, 
        'loginCallback':null,
        'logoutCallback':null,
        'server':null
      }
  };
  var freezer_restricted = {
      'utils':{}
  };
  freezr.onFreezrMenuClose = function(hasChanged) {}; // this is called when freezr menu is closed.

// db Functions - data base related functions - to read or write 
freezr.db.write = function(data, callback, collection, options) {
  // write to the database
  // options can be: updateRecord, data_object_id (needed for updateRecord), restoreRecord, confirm_return_fields

  if (!data) {callback({"error":"No data sent."});}

  var contentType='application/json';
  var postData= JSON.stringify({'data':data, 'options':options});

  if (!collection) collection = "main";
  var url= "/v1/db/write/"+freezr_app_name+"/"+freezr_app_code+"/"+collection

  if (!callback) callback = function(aJson) {console.log(JSON.stringify(aJson)) };

  //onsole.log("posting to url "+url+" postdata "+JSON.stringify(postData))
  freezer_restricted.connect.send(url, postData, callback, "PUT", contentType);
};
freezr.db.update = function(data, callback, collection) {
  // simple record update, assuming data has a ._id object
  if (!data) {callback({"error":"No data sent."});}
  if (!data._id) {callback({"error":"No _id to update."});}
  freezr.db.write(data, callback, collection, {'updateRecord':true, "data_object_id":data._id})
};
freezr.db.upload = function(file, callback, data, options) {
  // upload a file and record it in the database
  // options can be: updateRecord, data_object_id
  // and file specific ones: targetFolder, fileName, fileOverWrite
  // for files uploaded, colelction is always "files"§

  var url= "/v1/db/upload/"+freezr_app_name+"/"+freezr_app_code;  
  var uploadData = new FormData();
    // file = document.getElementById('app_zipfile2').fileInput.files[0];
  if (file) {uploadData.append('file', file); console.log("Sending file1");}
  if (data) uploadData.append("data", JSON.stringify(data));
  if (options) uploadData.append("options", JSON.stringify(options));
  
  freezer_restricted.connect.send(url, uploadData, callback, "PUT", null);
};
freezr.db.getById = function(data_object_id, callback, collection_name, permission_name, options) {
  // get a specific object by object id
  // app_config needs to be set up for this
  if (!data_object_id) {callback({"error":"No id sent."});}
  var requestee_app = (!options || !options.requestee_app)? freezr_app_name: options.requestee_app;
  if (!collection_name) collection_name = "main";
  if(!permission_name) permission_name="me";
  var url = '/v1/db/getbyid/'+permission_name+"/"+collection_name+"/"+freezr_app_name+'/'+freezr_app_code+'/'+requestee_app+'/'+data_object_id;

  freezer_restricted.connect.read(url, options, callback);
}
freezr.db.query = function(callback, permission_name, options) {
  // 
  // options are:
    //  field_value (necessary for field_permissions and folder)
    // collection - default is to use the first in list for object_delegate
    // query_params is a list of 

  var requestee_app = (!options || !options.requestee_app)? freezr_app_name: options.requestee_app;
  if (!options) options = {};

  var url = '/v1/db/query/'+freezr_app_name+'/'+freezr_app_code+'/'+requestee_app+(permission_name?('/'+permission_name):"");

  freezer_restricted.connect.send(url, JSON.stringify(options), callback, 'POST', 'application/json');
}
freezr.db.updateFileList = function(callback, folder_name) {
  // This is for developers mainly. If files have been added to a folder manually, this function reads all the files and records them in the db
  //app.get('/v1/developer/fileListUpdate/:app_name/:source_app_code/:folder_name', userDataAccessRights, app_hdlr.updateFileDb);

  var url = '/v1/developer/fileListUpdate/'+freezr_app_name+'/'+freezr_app_code+ (folder_name?'/'+folder_name:"");
  //onsole.log("fileListUpdate Sending to "+url)
  freezer_restricted.connect.read(url, null, callback);
}
freezr.db.getConfig = function(callback) {
  // This is for developers mainly. I retrieves the app_config file and the list of collections which haev been used
  //app.get('/v1/developer/config/:app_name/:source_app_code',userDataAccessRights, app_handler.getConfig);
  // it returns: {'app_config':app_config, 'collection_names':collection_names}, where collection_names are the collection_names actually used, whether they appear in the app_config or not.

  var url = '/v1/developer/config/'+freezr_app_name+'/'+freezr_app_code;
  //onsole.log("fileListUpdate Sending to "+url)
  freezer_restricted.connect.read(url, null, callback);
}


// Permissions and file permissions
freezr.perms.getAllAppPermissions = function(callback) {
  // gets a list of permissions granted - this is mainly called on my freezr_core, but can also be accessed by apps
  var url = '/v1/permissions/getall/'+freezr_app_name+'/'+freezr_app_code;
  freezer_restricted.connect.read(url, null, callback);
}
freezr.perms.setFieldAccess = function(callback, permission_name, options) {
  // can give specific people access to fields with specific values - eg myHusband can be given to all "album" fields whose value is "ourVacationAlbum2014"
  // field name and value are needed for field_delegate type permissions but unnecessary for foler_delegate permissions
  // permission_name is the permission_name under which the field is being  

  var url = '/v1/permissions/setfieldaccess/'+freezr_app_name+'/'+freezr_app_code+'/'+permission_name;
  if (!options) {options  = 
      { //'action': 'grant' or 'deny' // default is grant
        //'field_name': 'albums', // field name of value
        //'field_value':'ourVacationAlbum2014' // gives access to 
        // can have one of:  'shared_with_group':'logged_in' or 'shared_with_user':a user id 
        // 'requestee_app': app_name (defaults to self)
       }
      }
  if (!options.action) {options.action = "grant";}

  freezer_restricted.connect.write(url, options, callback);
}
freezr.perms.setObjectAccess = function(callback, permission_name, data_object_id, options) {
  // gives specific people access to a specific object
  // permission_name is the permission_name under which the field is being  

  var url = '/v1/permissions/setobjectaccess/'+freezr_app_name+'/'+freezr_app_code+'/'+permission_name;
  if (!options) {options  = 
      { //'action': 'grant' or 'deny' // default is grant
        // can have one of:  'shared_with_group':'logged_in' or 'shared_with_user':a user id 
        // 'requestee_app': app_name (defaults to self)
        // collection: defaults to first in list
       }
      }
  if (!options.action) {options.action = "grant";}
  options.data_object_id = data_object_id;

  freezer_restricted.connect.write(url, options, callback);
}
freezr.perms.listOfFieldsIvegrantedAccessTo = function(callback, options) {
  // returns list of folders (or field names) the app has given access to on my behalf.
  // options: permission_name, collection, field_name, field_value, shared_with_group, shared_with_user, granted
  var url = '/v1/permissions/getfieldperms/ihavegranted/'+freezr_app_name+'/'+freezr_app_code+'/';
  freezer_restricted.connect.read(url, options, callback);
}
freezr.perms.allFieldsIHaveAccessTo = function(callback, options ) {
  // returns list of folders (or field names) user has been given access to (excluding subfolders) by other users
  // options: permission_name, collection, field_name, granted,  _creator, 
  // target_app???
  var url = '/v1/permissions/getfieldperms/ihaveccessto/'+freezr_app_name+'/'+freezr_app_code+'/';
  freezer_restricted.connect.read(url, options, callback);
}

// html functions  - functions to render pages
freezr.html.getFileToRenderWithData = function (html_page,data,targetElId, processdata, next){
  // retrieves an html snippet and renders it using the data in a target element
  var html_url;
  if (targetElId == "BODY") {
    html_url = html_page;
  } else {
    html_url = '/htmlsnippet/'+freezr_app_name+"/"+html_page;
  }
  //onsole.log("getting getFileToRenderWithData"+html_url);
  freezer_restricted.connect.read(html_url, null, function(theHtml){
        freezr.html.renderWithData(theHtml, data, targetElId, processdata, next);
      });
}
freezr.html.renderWithData = function(theHtml,theData,elId,processdata,next){
  // renders html snippet merged with data within an element
  //onsole.log("got html " + ((theHtml && theHtml.length>50)? theHtml.slice(0,50)+"..." : "NONE"));
  //onsole.log("got el "+elId);
  var theEl;
  if (elId == "BODY") {
    theEl = document.getElementsByTagName("BODY")[0];
  } else {
    theEl = document.getElementById(elId);
  }
  if (theEl) {
      if (theData && theData.error) console.log("Error getting data");
      if (!theData ) {theData = {'results':[]} ;}
      if (processdata) theData = processdata(theData);
      var renderedPage = Mustache.to_html( theHtml,theData );
      theEl.innerHTML = renderedPage;
    
    if (elId == "BODY") {
      freezer_restricted.menu.addFreezerDialogueElements();
      if (freezr.initPageScripts) freezr.initPageScripts();
      if (freezr_messages && freezr_messages.showOnStart) {freezer_restricted.menu.resetDialogueBox(); freezr.perms.getAllAppPermissions(freezer_restricted.menu.show_permissions)};
    }

    if (next) next();
  } else {
    console.log("ERROR - NO SUCH ELEMENT "+elId)
  }
}
freezr.html.filePathFromName = function(fileName, user_id, permission_name, requestee_app) {
  // returns the full file path based on the name of a file so it can be referred to in html. (fileName can include subfolders in user directory)
  if (!user_id) user_id = freezr_user_id;
  if (! fileName ) return null
  else return freezr.html.filePathFromId(user_id +"/"+fileName,requestee_app,permission_name) 
}
freezr.html.filePathFromId = function(fileId, permission_name, requestee_app) {
  // returns the full file path based on the file id so it can be referred to in html.
  if(!permission_name) permission_name="me";
  if(!requestee_app) requestee_app=freezr_app_name;
  if (freezr.utils.startsWith(fileId,"/")) fileId = fileId.slice(1);
  //onsole.log("geeting "+unescape(fileId));
  return "/v1/userfiles/"+permission_name+"/files/"+freezr_app_name+"/"+ freezr_app_code +"/"+requestee_app+"/"+fileId;
}


// UTILITY Functions
  freezr.utils.parse = function(dataString) {
    if (typeof dataString == "string") {dataString=JSON.parse(dataString);}
    return dataString
  }
  freezr.utils.startsWith = function(longertext, checktext) {
      if (!checktext || !longertext) {return false} else 
      if (checktext.length > longertext.length) {return false} else {
      return (checktext == longertext.slice(0,checktext.length));}
  }
  freezr.utils.longDateFormat = function(aDateNum) {
    if (!aDateNum || aDateNum+''=='0') {
      return 'n/a';
    } else {
      try {
        aDate = new Date(aDateNum);
        var retVal = aDate.toLocaleDateString() + ' '+ aDate.toLocaleTimeString(); 
        return  retVal.substr(0,retVal.length-3);
      } catch (err) {
        return 'n/a - error';
      }
    }
  }
  freezr.utils.testCallBack = function(returnJson) {
    returnJson = freezer_restricted.utils.parse(returnJson);
    //onsole.log("return json is "+JSON.stringify(returnJson));
  }
  freezr.utils.logout = function() {
    if (freezr.app.logoutCallback) freezr.app.logoutCallback();
    if (freezr.app.isWebBased) {
      window.location.href =  '/';
    } else if (!freezr.app.logoutCallback){
      alert("Your data has been removed. Please close the application.");
    }
  }
  freezr.utils.closeMenuOnEscape = function (evt){
    if (evt.keyCode == 27 && document.getElementById("freezer_dialogueOuter").style.display == "block") {freezer_restricted.menu.close()};
  }

/*  ==================================================================

The following functions should NOT be called by apps.
That's why they are called "restricted"
They are for internal purposes only

==================================================================    */ 


freezer_restricted.utils = freezr.utils;
freezer_restricted.connect= {};
freezer_restricted.menu = {};
freezer_restricted.permissions= {};



// CONNECT - BASE FUNCTIONS TO CONNECT TO SERVER
  freezer_restricted.connect.ask = function(url, data, callback, type) {
      var postData=null, contentType="";

      if (!type || type=="jsonString") {
        postData= JSON.stringify(data);
        contentType = 'application/json'; // "application/x-www-form-urlencoded"; //
      } else {
        postData = data;
      }
      // todo - add posting pictures

  	freezer_restricted.connect.send(url, postData, callback, "POST", contentType);
  };
  freezer_restricted.connect.write = function(url, data, callback, type) {
      var postData=null, contentType="";

      if (!type || type=="jsonString") {
        postData= JSON.stringify(data);
        contentType = 'application/json'; 
      } else {
        postData=data;
      }
  	freezer_restricted.connect.send(url, postData, callback, "PUT", contentType);
  };
  freezer_restricted.connect.read = function(url, data, callback) {
  	if (data) {
  	    var query = [];
  	    for (var key in data) {
  	        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
  	    }
  	    url = url  + '?' + query.join('&');
      }

      freezer_restricted.connect.send(url, null, callback, 'GET', null)
  };
  freezer_restricted.connect.send = function (url, postData, callback, method, contentType) {
    //onsole.log("getting send req for url "+url)
  	var req = null, badBrowser = false;
  	try {
        req = new XMLHttpRequest();
      } catch (e) {
     		badBrowser = true;
      }
      if (!freezr.app.isWebBased && freezr_server_address) {
        url = freezr_server_address+url;
        // stackoverflow.com/questions/22535058/including-cookies-on-a-ajax-request-for-cross-domain-request-using-pure-javascri
        req.withCredentials = true;
        req.crossDomain = true;
        //req.processData = false;
        //req.contentType = false;
      }  

      if (badBrowser) { 
      	callback({"error":true, "message":"You are using a non-standard browser. Please upgrade."});
      } else if (!freezer_restricted.connect.authorizedUrl(url, method)) {
        callback({"error":true, "message":"You are not allowed to send data to third party sites like "+url});
      } else { 
        console.log("sending url "+url)
        req.open(method, url, true);
        req.onreadystatechange = function() {
          if (req && req.readyState == 4) {
              var jsonResponse = req.responseText;
              //onsole.log("AT freeezr level status "+this.status+" resp"+req.responseText)
              jsonResponse = jsonResponse? jsonResponse : {"error":"No Data sent from servers", "errorCode":"noServer"};
              if (this.status == 200 || this.status == 0) {
    				    callback(jsonResponse); 
        			} else if (this.status == 400) {
        				callback({'error':((jsonResponse.type)? jsonResponse.type: 'Connection error 400'),'message':'Error 400 connecting to the server'});
        			} else {
                if (this.status == 401 && !freezr.app.isWebBased) {freezr.app.offlineCredentialsExpired = true; console.log("setting freezr.app.offlineCredentialsExpired to true")}
        				callback({'error':"unknown error from freezr server","status":this.status});
        			}         
            } 
        };
        if (contentType) req.setRequestHeader('Content-type', contentType);
        req.send(postData)
      }
  }
  freezer_restricted.connect.authorizedUrl = function (aUrl, method) {
  	if ((freezer_restricted.utils.startsWith(aUrl,"http") && freezr.app.isWebBased) || (!freezer_restricted.utils.startsWith(aUrl,freezr_server_address) && !freezr.app.isWebBased) ){
  		//todo - to make authorized sites
  		var warningText = (method=="POST")? "The web page is trying to send data to ":"The web page is trying to access ";
  		warningText = warningText + "a web site on the wild wild web: "+aUrl+" Are you sure you want to do this?"
  		return (confirm(warningText))
  	} else {
  		return true;
  	}
  } 

// PERMISSIONS - BASE FUNCTIONS GRANTING PERMISSIONS
  freezer_restricted.permissions.change = function(buttonId, permission_name, permission_object) {
    //onsole.log("CHANGE id"+buttonId+" permission_name"+permission_name+" "+ JSON.stringify(permission_object));
    //  {"description":"Player Recent Scores","app_name":null,"collection":"scores","search_fields":null,"sort_fields":{"_date_created":1},"count":1,"return_fields":["score","_creator","_date_created"],"allowed_groups":"logged_in"}
    var theButt = document.getElementById(buttonId);
    if (theButt.className == "freezer_butt") {
      theButt.className = "freezer_butt_pressed";
      var action = theButt.innerHTML;
      theButt.innerHTML = ". . .";
      var url = '/v1/permissions/change/'+freezr_app_name+'/'+freezr_app_code;
      var sentData = {'changeList':[{'action':action, 'permission_name':permission_name, 'permission_object':permission_object, 'buttonId':buttonId}]};
      freezer_restricted.connect.write(url, sentData, freezer_restricted.permissions.changePermissionCallBack);
    }
  }
  freezer_restricted.permissions.changePermissionCallBack = function(returnJson) {
    //onsole.log('permission Callback '+JSON.stringify(returnJson));
    returnJson = freezer_restricted.utils.parse(returnJson);
    var theButt = (returnJson && returnJson.buttonId)? document.getElementById(returnJson.buttonId) : null;
    if (theButt) {
      //onsole.log("got the butt - now "+returnJson.action)
      if (returnJson.action == "Accept") { theButt.innerHTML = "Now Accepted"}
      if (returnJson.action == "Deny") {theButt.innerHTML = "Now Denied";}
    }
  }

// MENU - BASE FUNCTIONS SHOWING THEM WHEN THE FREEZR ICON (top right of each app) IS PRESSEDFreeezer Dialogie HTML
  freezer_restricted.menu.hasChanged = false;
  freezer_restricted.menu.addFreezerDialogueElements = function(){

    //onsole.log("addFreezerDialogueElements")
    var freezerMenuButt = document.createElement('img');
    freezerMenuButt.src = freezr.app.isWebBased? "/app_files/info.freezr.public/static/freezer_log_top.png": "./freezrPublic/static/freezer_log_top.png";
    freezerMenuButt.id = "freezerMenuButt"
    freezerMenuButt.onclick = freezer_restricted.menu.freezrMenuOpen;
    freezerMenuButt.className = "freezerMenuButt_" + ((!freezr.app.isWebBased && /iPhone|iPod|iPad/.test(navigator.userAgent) )? "Head":"Norm");
    document.getElementsByTagName("BODY")[0].appendChild(freezerMenuButt);

    var elDialogueOuter = document.createElement('div');
    elDialogueOuter.id = 'freezer_dialogueOuter';
    document.getElementsByTagName("BODY")[0].appendChild(elDialogueOuter);
    var elDialogueScreen = document.createElement('div');
    elDialogueScreen.id = 'freezer_dialogueScreen';
    elDialogueOuter.appendChild(elDialogueScreen);
    var elDialogueInner = document.createElement('div');
    elDialogueInner.id = 'freezer_dialogueInner';
    elDialogueOuter.appendChild(elDialogueInner);
    var elDialogueCloseButt = document.createElement('div');
    elDialogueCloseButt.className="freezer_butt";
    elDialogueCloseButt.id="freezer_dialogue_closeButt";
    elDialogueCloseButt.innerHTML=" Close ";
    elDialogueCloseButt.onclick = freezer_restricted.menu.close;
    elDialogueInner.appendChild(elDialogueCloseButt);
    if (freezr.app.isWebBased) {
      var elDialogueHomeButt = document.createElement('div');
      elDialogueHomeButt.className="freezer_butt";
      elDialogueHomeButt.id="freezer_dialogue_homeButt";
      elDialogueHomeButt.innerHTML="freezr home";
      elDialogueHomeButt.onclick = function (evt) {window.open("/account/home","_self");};
      elDialogueInner.appendChild(elDialogueHomeButt);

      var elDialogueDataViewButt = document.createElement('div');
      elDialogueDataViewButt.className="freezer_butt";
      elDialogueDataViewButt.id="freezer_dialogue_viewDataButt";
      elDialogueDataViewButt.innerHTML="App data";
      elDialogueDataViewButt.onclick = function (evt) {window.open(("/allmydata/view/"+freezr_app_name),"_self");};
      elDialogueInner.appendChild(elDialogueDataViewButt);
    } 
    var elDialogueInnerText = document.createElement('div');
    elDialogueInnerText.id = 'freezer_dialogueInnerText';
    elDialogueInner.appendChild(elDialogueInnerText);
    elDialogueInner.style["-webkit-transform"] = "translate3d("+(Math.max(window.innerWidth,window.innerHeight))+"px, -"+(Math.max(window.innerWidth,window.innerHeight))+"px, 0)";
  }
  freezer_restricted.menu.close = function (evt) {
      document.getElementById("freezer_dialogueInner").style["-webkit-transform"] = "translate3d("+(Math.max(window.innerWidth,window.innerHeight))+"px, -"+(Math.max(window.innerWidth,window.innerHeight))+"px, 0)";
      setTimeout(function(){
          document.getElementById('freezer_dialogueOuter').style.display="none";
      },400 )

      document.getElementsByTagName("BODY")[0].style.overflow="auto";
      freezr.onFreezrMenuClose(freezer_restricted.menu.hasChanged);
      freezer_restricted.menu.hasChanged = false;
  };
  freezer_restricted.menu.freezrMenuOpen = function() {
    var innerEl = document.getElementById('freezer_dialogueInner');
    

    if (freezr.app.isWebBased && !freezr_app_code) { // app pages
      freezer_restricted.menu.resetDialogueBox(true);
      document.getElementById('freezer_dialogueOuter').style.display="block";
      freezer_restricted.menu.addLoginInfoToDialogue('freezer_dialogueInnerText');

      //window.open("/account/home","_self");
    } else if (freezr_app_code  && (freezr.app.isWebBased || !freezr.app.offlineCredentialsExpired) ){
        freezer_restricted.menu.resetDialogueBox();
        freezr.perms.getAllAppPermissions(freezer_restricted.menu.show_permissions);
        freezer_restricted.menu.hasChanged = true;
    } else { // no app code, or offlineCredentialsExpired so its a stnad alone app
        freezer_restricted.menu.resetDialogueBox();
        freezer_restricted.menu.add_standAlonApp_login_dialogue('freezer_dialogueInnerText');
    } 

  }
  freezer_restricted.menu.resetDialogueBox = function(isAdminPage) {
    document.getElementById('freezer_dialogueInnerText').innerHTML= '<br/><div align="center">.<img src="'+(freezr.app.isWebBased? "/app_files/info.freezr.public/static/ajaxloaderBig.gif": "./freezrPublic/static/ajaxloaderBig.gif")+'"/></div>';
    var dialogueEl = document.getElementById('freezer_dialogueOuter');
    dialogueEl.style.display="block";
    var bodyEl = document.getElementsByTagName("BODY")[0]
    bodyEl.style.overflow="hidden";
    dialogueEl.style.top = Math.round(bodyEl.scrollTop)+"px";
    if (isAdminPage && document.getElementById("freezer_dialogue_viewDataButt")) document.getElementById("freezer_dialogue_viewDataButt").style.display= "none";
    document.getElementById('freezer_dialogueInner').style["-webkit-transform"] = "translate3d(0, 0, 0)";
  }
  freezer_restricted.menu.addLoginInfoToDialogue = function(aDivName) {
    var innerElText = document.getElementById(aDivName);
    innerElText.innerHTML = "<i>Logged in as"+(freezr_user_is_admin? " admin ":" ")+"user: "+freezr_user_id+(freezr_server_address? (" on server: "+freezr_server_address): "")+"</i><br/>";
    if (!freezr.app.isWebBased && freezr_app_code){  
        innerElText.innerHTML+= '<div align="center"><div class="freezer_butt" style="float:none; max-width:100px;" id="freezr_server_logout_butt">log out</div></div><br/>'
        setTimeout(function() { document.getElementById("freezr_server_logout_butt").onclick= function() {freezr.utils.logout(); } },10);
    }
  }
  freezer_restricted.menu.add_standAlonApp_login_dialogue = function(divToInsertInId) {
    var divToInsertIn = document.getElementById(divToInsertInId);
    if (document.getElementById("freezer_dialogue_viewDataButt")) document.getElementById("freezer_dialogue_viewDataButt").style.left=(parseInt(window.innerWidth/2)-30)+"px";
    
    var cont = "";
    cont+= '<div class="freezer_dialogue_topTitle">Log in to freezr</div>'
    cont+= '<div><span>Freezr server address: </span> <textarea class="server_input" id="freezr_server_name_input" rows="1"; columns="100" >'+(freezr_server_address? freezr_server_address:'http://')+'</textarea></div>'
    cont+= '<div><span style="padding-right:69px;">User Name: </span> <textarea class="server_input" id="freezr_login_username" rows="1"; columns="100" >'+(freezr_user_id? freezr_user_id:'')+'</textarea></div>'
    cont+= '<div><span style="padding-right:79px;">Password: </span><textarea class="server_input" id="freezr_login_pw" rows="1"; columns="100" ></textarea></div>'
    cont+= '<div align="center"><div class="freezer_butt" id="freezr_server_login_butt">log in to freezr</div></div>'
    divToInsertIn.innerHTML = cont;
    document.getElementById('freezr_server_login_butt').onclick = function(){
      freezr_server_address = document.getElementById('freezr_server_name_input').value;
      if (freezr_server_address.slice(freezr_server_address.length-1)=="/")  freezr_server_address = freezr_server_address.slice(0,freezr_server_address.length-1);
      freezr_user_id = document.getElementById('freezr_login_username').value;;
      var password = document.getElementById('freezr_login_pw').value;;
        //onsole.log("logging in "+freezr_user_id+"-"+password+". server "+freezr_server_address)
      if (freezr_user_id && freezr_user_id.length>0 && password && password.length>0 && freezr_server_address && freezr_server_address.length > 0 ) {

        var theInfo = { "user_id": freezr_user_id, "password": password, 'login_for_app_name':freezr_app_name};
        if (!freezr_app_name) {
            alert("developer error: variable freezr_app_name needs to be defined");
        } else {
          freezer_restricted.menu.resetDialogueBox();
          freezer_restricted.connect.ask("/v1/account/applogin", theInfo, function(resp) {
            resp = freezr.utils.parse(resp);
            //console.log("got login "+JSON.stringify(resp));
            freezer_restricted.menu.close()
            if (resp.error) {
              freezr.app.loginCallback? freezr.app.loginCallback(resp): console.log("Error " + JSON.stringify(resp));
            } else if (resp.login_for_app_name == freezr_app_name) {
              freezr_app_code = resp.source_app_code;
              freezr.app.offlineCredentialsExpired = false;
              freezr.app.loginCallback? freezr.app.loginCallback(resp): console.log("Set freezr.app.loginCallback to handle log in response: " + JSON.stringify(resp));
            } else {
                alert('developper error - loggedin_app_name '+resp.login_for_app_name+' is not correct.');
            }
          });
        }
      } 
    }
    document.getElementById('freezr_server_name_input').onkeypress= function (evt) {
    if (evt.keyCode == 13) {evt.preventDefault(); document.getElementById("freezr_login_username").focus();};
    }
    document.getElementById('freezr_login_username').onkeypress= function (evt) {
    if (evt.keyCode == 13) {evt.preventDefault(); document.getElementById("freezr_login_pw").focus();};
    }
    document.getElementById('freezr_login_pw').onkeypress= function (evt) {
    if (evt.keyCode == 13) {evt.preventDefault(); document.getElementById("freezr_server_login_butt").focus();};
    }
  }




  freezer_restricted.menu.show_permissions = function(returnPermissions) {
    if (document.getElementById("freezer_dialogue_viewDataButt")) document.getElementById("freezer_dialogue_viewDataButt").style.left=(parseInt(window.innerWidth/2)-30)+"px";
    returnPermissions = freezer_restricted.utils.parse(returnPermissions);

    var innerElText = document.getElementById('freezer_dialogueInnerText');

    //onsole.log("console.log ALL permissions are "+JSON.stringify(returnPermissions) );

    document.getElementById('freezer_dialogueOuter').style.display="block";
    freezer_restricted.menu.addLoginInfoToDialogue('freezer_dialogueInnerText');

    if (!returnPermissions || returnPermissions.error) {
      innerElText.innerHTML += "<br/><br/>Error connecting to freezr to get permissions";
    } else {

      innerElText.innerHTML += '<div class="freezer_dialogue_topTitle">App Permissions to Access Data</div>';
      var num=0, titleDiv;

      var groupedPermissions = {
              field_delegates:[],
              folder_delegates:[],
              object_delegates:[],
              outside_scripts:[],
              thisApptoThisAppAsked: [],
              thisApptoThisAppGranted: [],
              thisApptoThisAppDenied: [],
              thisApptoThisAppOutDated: [],
              thisAppToOtherApps: [],
              otherAppsGranted: [],
              otherAppsDenied: [],
              otherAppsAsked: []
      };

      for (var i=0; i<returnPermissions.length; i++) {
        aPerm = returnPermissions[i];
        if (aPerm.type == "folder_delegate") {
          groupedPermissions.folder_delegates.push(aPerm);
        } else if (aPerm.type == "field_delegate") {
          groupedPermissions.field_delegates.push(aPerm);
        } else if (aPerm.type == "outside_scripts") {
          groupedPermissions.outside_scripts.push(aPerm);
        } else if (aPerm.type == "object_delegate") {
          groupedPermissions.object_delegates.push(aPerm);
        } else if (aPerm.type == "db_query" && aPerm.requestor_app == freezr_app_name) {
          if (aPerm.requestee_app != freezr_app_name) {
            groupedPermissions.thisAppToOtherApps.push(aPerm);
          } else if (aPerm.granted && !aPerm.outDated) {
            groupedPermissions.thisApptoThisAppGranted.push(aPerm);
          } else if (aPerm.denied) {
            groupedPermissions.thisApptoThisAppDenied.push(aPerm);
          } else if (aPerm.outDated) {
            groupedPermissions.thisApptoThisAppOutDated.push(aPerm);
          } else {
            groupedPermissions.thisApptoThisAppAsked.push(aPerm);
          }
        } else if (aPerm.type == "db_query" && aPerm.requestee_app == freezr_app_name) {
          if (aPerm.granted && !aPerm.outDated) {
            groupedPermissions.otherAppsGranted.push(aPerm);
          } else if (aPerm.denied) {
            groupedPermissions.otherAppsDenied.push(aPerm);
          } else {
            groupedPermissions.otherAppsAsked.push(aPerm);
          }


        } else {
          console.log("ERROR - why this . uknown permission "+JSON.stringify(aPerm));
        }
      }

      var makePermissionElementFrom = function(type, permission_object, num, buttText) {
        var permEl = document.createElement('div');
        permEl.className = "freezer_BoxTitle"
        permEl.innerHTML = (permission_object.description?  (permission_object.description+ " ("+permission_object.permission_name+")"): permission_object.permission_name);
        var acceptButt = document.createElement('div');
        acceptButt.className = buttText? "freezer_butt": "freezer_butt_pressed";
        acceptButt.id = "freezer_butt_"+num;
        
        acceptButt.innerHTML= buttText;
        if (buttText) {
          acceptButt.onclick = function (evt) {freezer_restricted.permissions.change(this.id, permission_object.permission_name, permission_object);};
        }
        var detailText = document.createElement('div');
        detailText.className="freezer_butt_Text"
        if (type == "db_query") {
          detailText.innerHTML = (buttText=="Accept"? "The app wants to share ":"The app gives access to ") + ": "+(permission_object.return_fields? (permission_object.return_fields.join(", ")) : "ERROR") + " with "+permission_object.allowed_groups+"<br/>";
        } else if (type == "folder_delegate") {
          detailText.innerHTML = (buttText=="Accept"? "The app wants to be able to share " : "The app is able to share ") + " all files in these folders : "+ (permission_object.sharable_folders? permission_object.sharable_folders.join(", "):"ERROR" ) +" with "+permission_object.sharable_groups+"<br/>";
        } else if (type == "field_delegate") {
          detailText.innerHTML = (buttText=="Accept"? "The app wants to be able to share ":"The app is able to share ")+ " all data records from the collection : "+(permission_object.collection? permission_object.collection:"ERROR")+" according to these fields:"+ (permission_object.sharable_fields? permission_object.sharable_fields.join(", "):"ERROR" ) +" with "+permission_object.sharable_groups+"<br/>";
        } else if (type == "object_delegate") {
          detailText.innerHTML = (buttText=="Accept"? "The app wants to be able to share ":"The app is able to share ")+ " individual data records with "+permission_object.sharable_groups+"<br/>";
        } else if (type == "outside_scripts") {
          detailText.innerHTML = (buttText=="Accept"? "The app wants to be able to use this scripts from the web: ":"The app is able to use this script from the web: ")+permission_object.script_url+"<br/>This script can take ALL YOUR DATA and evaporate it into the cloud.";
        }
        var boxOuter = document.createElement('div');
        boxOuter.appendChild(acceptButt);
        boxOuter.appendChild(detailText);
        permEl.appendChild(boxOuter);
        return permEl;
      }


      function writePermissions(type, recordList, buttText, titleText, altText) {
          titleDiv = document.createElement('div');
          titleDiv.className = "freezer_dialogueTitle freezr_dialogueBordered";
          titleDiv.id = "freezer_dialogueTitle"+(num++);
          if (recordList && recordList.length >0) {
            titleDiv.innerHTML = titleText;
            innerElText.appendChild(titleDiv);
            for (var i=0; i<recordList.length; i++) {
              if (type == "field_delegate" || type == "folder_delegate" || type == "object_delegate"|| type == "outside_scripts") {buttText = recordList[i].granted?"Deny":"Accept";}
              innerElText.appendChild(makePermissionElementFrom(type, recordList[i], num++, buttText));
            }
          } else if (altText) {
            titleDiv.innerHTML = altText+"<br/><br/>";
            innerElText.appendChild(titleDiv);
          }
      }


      if (groupedPermissions.thisAppToOtherApps.length + groupedPermissions.outside_scripts.length + groupedPermissions.thisApptoThisAppGranted.length + groupedPermissions.thisApptoThisAppAsked.length +groupedPermissions.thisApptoThisAppDenied.length + groupedPermissions.thisApptoThisAppOutDated.length+ groupedPermissions.folder_delegates.length+ groupedPermissions.field_delegates.length == 0) {
        writePermissions(null, [], "", null, 'This app is not asking for any sharing permissions.');
      } 
      writePermissions("object_delegate", groupedPermissions.object_delegates, null, 'This app is asking for permission to be able to automatically share individual records or FILES with others.');
      writePermissions("folder_delegate", groupedPermissions.folder_delegates, "Accept", 'This app is asking for permission to be able to automatically share your files with others.');
      writePermissions("field_delegate",groupedPermissions.field_delegates, "Accept", 'This app is asking for permission to be able to automatically share some of your date with others.');

      writePermissions("outside_scripts",groupedPermissions.outside_scripts, "Accept", 'This app is asking for permission to be able to access programming scripts from the web. This can be VERY DANGEROUS. DO NOT ACCEPT THIS unless you totally trust the app provider and the source of the script. <br/> <b> PROCEED WITH CAUTION.</b> ');

      writePermissions("db_query", groupedPermissions.thisApptoThisAppAsked, "Accept", 'This app is asking for permission to share your data with other users of this app:');
      writePermissions("db_query",groupedPermissions.thisApptoThisAppOutDated, "Accept", 'You had previously granted similar permissions but the app has changed the criteria so you have to re-accept them:');
      writePermissions("db_query",groupedPermissions.thisApptoThisAppGranted, "Deny", 'You have already granted permission for this app to share the following data with other users of this app:');
      writePermissions("db_query",groupedPermissions.thisApptoThisAppDenied, "Accept", 'You have denied this app from sharing the following data with other users of this app:');

      writePermissions("db_query", groupedPermissions.thisAppToOtherApps, null, "This app is asking for permissions to get your data stored in other apps. You have to go to those apps' pages to grant these permissions:");

      writePermissions("db_query", groupedPermissions.otherAppsAsked, "Accept", 'Other apps are asking for permission for you to see your data from this app:');
      writePermissions("db_query", groupedPermissions.otherAppsGranted, "Deny", 'You have already granted permission to other apps to see your data fro this app as follows:');
      writePermissions("db_query", groupedPermissions.otherAppsDenied, "Accept", 'You have denied other apps from seeing your data from this app as follows:');

    }
  }


freezr.utils.addFreezerDialogueElements = freezer_restricted.menu.addFreezerDialogueElements;
freezr.html.freezrMenuOpen = freezer_restricted.menu.freezrMenuOpen;
freezr.html.freezrMenuClose = freezer_restricted.menu.close;

