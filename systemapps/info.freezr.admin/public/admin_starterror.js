
console.log("Running scripts xxx")
freezr.initPageScripts = function() {
  msgDiv = document.getElementById("error_message");
  if (startup_errors) {
    console.log("here...")
    msgDiv.innerHTML = "";
    if (!startup_errors.running.db) msgDiv.innerHTML += "freezr could not access the database. Please make sure a database is running."
    if (!startup_errors.running.fileSys) msgDiv.innerHTML += "freezr file system error"
    if (!startup_errors.running.fileWrite) msgDiv.innerHTML += "freezr could not write files to the system"
  } else {
  	console.log("None??")
  }

}


