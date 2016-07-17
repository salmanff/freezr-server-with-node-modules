// freezr Accunts page

freezr.initPageScripts = function() {
  document.addEventListener('click', function (evt) {
    console.log('clicked'+evt.target.id);
    if (evt.target.id && freezr.utils.startsWith(evt.target.id,"goto_")) {
      var parts = evt.target.id.split('_');
      window.location = "/apps/"+parts[2];
    }
  });

  if (!freezr_user_is_admin) {document.getElementById("freezer_users_butt").style.display="none";} 

  updateAppList();
}

updateAppList = function() {
      freezer_restricted.connect.read('/account/v1/app_list.json', null, function (returndata) {
          var d = JSON.parse(returndata);
          if (d.err) {
            freezr.html.renderWithData("<br/>"+JSON.stringify(d.err),null,"app_list",null)
          } else {
            if(!d) d = null;
            if (d && d.user_apps && d.user_apps.length==0) {window.open("/account/app_management","_self")}
            freezr.html.getFileToRenderWithData("app_list.html",d,"app_list");
          }
      });
  }


