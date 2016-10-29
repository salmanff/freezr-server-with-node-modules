
freezr.initPageScripts = function() {
  document.getElementById('register').onsubmit = function (evt) {
    evt.preventDefault();
    var user_id=document.getElementById('user_id').value;
    var password = document.getElementById('password').value;
    var password2 = document.getElementById('password2').value;

    if (!user_id || !password) {
      showError("You need a name and password to log in");
    } else if (!password2 || password != password2) {
      showError("Passwords have to match");
    } else {
      var theInfo = { register_type: "setUp",
                      isAdmin: "true",
                      user_id: user_id,
                      password: password 
                    };
      freezer_restricted.connect.write("/v1/admin/first_registration", theInfo, gotRegisterStatus, "jsonString");
    }
  }

}

var gotRegisterStatus = function(data) {
  if (data) data = freezr.utils.parse(data);
  console.log("gotRegisterStatus "+JSON.stringify(data));
  if (!data) {
    showError("Could not connect to server");
  } else if (data.error) {
    showError("Error. "+data.message);
  } else {
    window.location = "/admin/registration_success";
  }
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


