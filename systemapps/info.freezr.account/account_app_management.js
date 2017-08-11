// copied from register page - need to customize to change password

var doShowDevoptions = false;
var userHasIntiatedAcions = false;
freezr.initPageScripts = function() {
  document.addEventListener('click', function (evt) {
    if (evt.target.id && freezr.utils.startsWith(evt.target.id,"button_")) {
      var parts = evt.target.id.split('_');
      var args = evt.target.id.split('_');
      args.splice(0,2).join('_');
      if (buttons[parts[1]]) buttons[parts[1]](args);
    }
  });

  if (!freezr_user_is_admin) {document.getElementById("button_showDevOptions").style.display="none";}
  if (!freezr_user_is_admin) {document.getElementById("freezer_users_butt").style.display="none";}
  if (freezr_user_is_admin && window.location.search.indexOf("dev=true")>0) doShowDevoptions = true;
  showDevOptions();
}


var showDevOptions = function(){
  buttons.updateAppList();
  if (doShowDevoptions && freezr_user_is_admin) {
    document.getElementById("addFileTable").style.display="block";
    document.getElementById("button_showDevOptions").style.display="none";
    // Go through and add all other options
  }
}

freezr.onFreezrMenuClose = function(hasChanged) {
  //freezer_restricted.menu.resetDialogueBox(true);
  if (userHasIntiatedAcions) buttons.updateAppList();
    console.log("resetDialogueBox 3")
  setTimeout(function() {freezer_restricted.menu.resetDialogueBox(true);},300);
}
var buttons = {
  'showDevOptions': function(args) {
    doShowDevoptions = true;
    showDevOptions();
    history.pushState(null, null, '?dev=true');
  },
  'goto': function(args) {
    window.open("/apps/"+args[1],"_self");
  },
  'installApp': function(args) {
    userHasIntiatedAcions = true;
    window.open("/apps/"+args[0],"_self");
  },
  'reinstallApp': function(args) {
    userHasIntiatedAcions = true;
    window.open("/apps/"+args[0],"_self");
  },
  'removeApp': function(args) {
      userHasIntiatedAcions = true;
      freezer_restricted.connect.ask('/account/v1/appMgmtActions.json', {'action':'removeApp', 'app_name':args[0]}, remove_app_callback)
  },
  'deleteApp': function(args) {
      userHasIntiatedAcions = true;
      freezer_restricted.connect.ask('/account/v1/appMgmtActions.json', {'action':'deleteApp', 'app_name':args[0]}, delete_app_callback)
  },
  'uploadZipFileApp': function (args) {
    userHasIntiatedAcions = true;
    var fileInput = document.getElementById('app_zipfile2');
    var file = (fileInput && fileInput.files)? fileInput.files[0]: null;

    if (!fileInput || !file) {
      showError("Please Choose a file first.");      
    } else if (file.name.substr(-4) != ".zip") {
      document.getElementById('errorBox').innerHTML="file uploaded must be a zipped file.";
    } else {
      var uploadData = new FormData();
      uploadData.append('file', file);
      var url = "/v1/account/upload_app_zipfile.json";
      var theEl = document.getElementById(file.name);
      if (!theEl || confirm("This app exists. Do you want to replace it with the uplaoded files?")) {
        freezer_restricted.menu.resetDialogueBox(true);
          freezer_restricted.connect.send(url, uploadData, function(returndata) {
            var d = JSON.parse(returndata);
            if (d.err) {
              document.getElementById("freezer_dialogueInnerText").innerHTML = "<br/>"+JSON.stringify(d.err);
            } else{
              ShowAppUploadErrors(d,uploadSuccess);
            }
          }, "PUT", null);
      }      
    }
  },
  'updateApp': function(args) {
    userHasIntiatedAcions = true;
    freezer_restricted.menu.resetDialogueBox(true);
    document.getElementById("freezer_dialogue_closeButt").style.display="none";
    document.getElementById("freezer_dialogue_homeButt").style.display="none";
    document.getElementById("freezer_dialogueScreen").onclick=null;
    freezer_restricted.connect.ask('/account/v1/appMgmtActions.json', {'action':'updateApp', 'app_name':args[0]}, function(returndata) {
        var d = JSON.parse(returndata);
        document.getElementById("freezer_dialogue_closeButt").style.display="block";
        document.getElementById("freezer_dialogue_homeButt").style.display="block";
        if (d.err) {
          if (document.getElementById("freezer_dialogueInnerText")) document.getElementById("freezer_dialogueInnerText").innerHTML= "<br/>"+JSON.stringify(d.err);
        } else {
          ShowAppUploadErrors(d,showDevOptions)
        }
        buttons.updateAppList();
    })
  },
  'addAppInFolder': function() {
    userHasIntiatedAcions = true;
    var app_name = document.getElementById('appNameFromFolder').value;
    if (!app_name) {
        showError("Please enter an app name");
    } else {
      buttons.updateApp([app_name]);
    }
  },
  'updateAppList': function() {
      freezr.utils.getAllAppList (function (returndata) {
          var theData = freezr.utils.parse(returndata);
          var theEl = document.getElementById("app_list");
          if(!theData) { 
            theEl.innerHTML = "No Apps have been installed";
          } else if (theData.err || theData.error) {
            theEl.innerHTML = "ERROR RETRIEVING APP LIST";
          } else {
            freezr.utils.getHtml("app_mgmt_list.html", function(theHtml) {
              theEl.innerHTML = Mustache.to_html( theHtml,theData );
              var imglist = document.getElementsByClassName("logo_img");
              var imglistener = function(evt){
                    this.src="/app_files/info.freezr.public/static/freezer_logo_empty.png"
                    this.removeEventListener("error",imglistener);
                }
              for (var i=0; i<imglist.length; i++) {
                  imglist[i].addEventListener("error", imglistener )
              }
            })
          }
      });
  },
  'chooseFile':function() {
    // document.getElementById('buttons_uploadZipFileApp').style.display="block";
    document.getElementById('app_zipfile2').click();
    document.getElementById('button_uploadZipFileApp').style.display  ="block";
  },
  'closeMenu':function() {
    freezr.utils.freezrMenuClose();
    console.log("closed from closemeni")
    //setTimeout(function() {freezer_restricted.menu.resetDialogueBox(true);},300);

  }

}
var ShowAppUploadErrors = function (theData,callFwd) {
  freezr.utils.getHtml("uploaderrors.html", function(theHtml) {
    var theEl = document.getElementById("freezer_dialogueInnerText");
    theEl.innerHTML = Mustache.to_html( theHtml,theData );
    if (callFwd) callFwd();
  })
}

var uploadSuccess = function() {
  buttons.updateAppList();
  //document.getElementById("freezer_dialogue_extra_title").innerHTML="Finalize Installation and Launch'."
  //document.getElementById("freezer_dialogue_extra_title").onclick=function() {buttons.goto}
}
var remove_app_callback = function(data) {
  data = freezer_restricted.utils.parse(data);
  window.scrollTo(0, 0);
  if (!data) {
      showError("Could not connect to server");
  } else if (data.error) {
    showError("Error:"+data.message);
  } else {
    showError("The app was removed from your home page. Scroll down to 'removed apps' section below to re-install or to delete completely.");
    buttons.updateAppList();
  }
}
var delete_app_callback = function(data) {
  data = freezer_restricted.utils.parse(data);
  window.scrollTo(0, 0);
  if (!data) {
      showError("Could not connect to server");
  } else if (data.error) {
    showError("Error:"+data.message);
  } else if (data && data.other_data_exists) {
    showError("Your data was deleted. But the app cannot be removed until other users have also deleted ther data.");
  } else {
    showError("The app was deleted.");
    buttons.updateAppList();
  }
}

var gotChangeStatus = function(data) {
  data = freezer_restricted.utils.parse(data);
  if (!data) {
      showError("Could not connect to server");
  } else if (data.error) {
    showError("Error:"+data.message);
  } else {
    showError("success in making app");
    window.location = "/account/apps";
  }
}

var timer = null;
var showError = function(errorText) {
  timer = null;
  var errorBox=document.getElementById("errorBox");
  errorBox.innerHTML= errorText? errorText: " &nbsp ";
  if (errorText) {
    timer = setTimeout(function () {showError();
  },5000)}
}

