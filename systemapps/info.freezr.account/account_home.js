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
}

