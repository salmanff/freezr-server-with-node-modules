
freezr.initPageScripts = function() {
  msgDiv = document.getElementById("error_message");
  if (startup_errors && !startup_errors.allOkay) {
    console.log("here")
    if (!startup_errors.running.db) msgDiv.innerHTML += "freezr could not access the database"
    if (!startup_errors.running.fileSys) msgDiv.innerHTML += "freezr file system error"
    if (!startup_errors.running.fileWrite) msgDiv.innerHTML += "freezr could not write files to the system"
  }
}


