
/* 
This functionality page is somewhat incomplete. 
To add upload options:
	- backup all collections seuentially
	- set useNewIds to false : this is probably okay if redoing all data in a d-base but if records already exist, then it could run into problems as the record id may already be in use, by another user for example.
	- only add new: remove restoreRecord as asn option
	- add a rules for ignoring uploads: eg fj:deleted,true
	- only add new records

    'pages':{
        'allmydata_view': {
            "page_title":"View all my data for "+req.params.app_name,
            "html_file":"info.freezr.public/allmydata_view.html",
            "css_files": ["info.freezr.public/allmydata_view.css"],
            "script_files": ["info.freezr.public/allmydata_view.js","info.freezr.public/FileSaver.js"]
        }
*/

const retrieve_COUNT = 200;
const FILE_SIZE_MAX = 2000000;

var dl = {  // download file structure
			'meta': { 
				'user':null,
				'app_name':null,
				'date':new Date().getTime(),
				'source':"allmydata_backup",
				'all_collection_names': [],
				'app_config': null
				},
		  	'current_collection':{ // temporary fields - can be ignored
			  	'part':1,		  	
				'retrieved_all':false,
			},
			'collections': [
				{	'name':"",
			  		'first_retrieved_date':null,
			  		'last_retrieved_date':null,
			  		'data':[]
				}
			]
		}

freezr.initPageScripts = function() {
	document.getElementById('app_name').innerHTML= freezr_app_name;
	document.getElementById('freezr_user_id').innerHTML= freezr_user_id;
	document.getElementById("backToApp").onclick = function() {window.open("/apps/"+freezr_app_name,"_self");}
	document.getElementById("freezrHome").onclick = function() {window.open("/","_self");}

	document.getElementById("getAndSaveData").onclick = function () {getAndSaveData();}
	document.getElementById("uploadAndRestoreData").onclick = function () {uploadAndRestoreData();}

	dl.meta.app_name=freezr_app_name;
	dl.meta.user=freezr_user_id;

	freezr.db.getConfig(function(configReturn) {
		if (configReturn.error ) {
			showWarning("Error connecting to server - try later.");
			hideElments();
		} else {
			configReturn = freezr.utils.parse(configReturn);
			dl.meta.all_collection_names = configReturn.collection_names;
			dl.meta.app_config = configReturn.app_config;
			if (dl.meta.all_collection_names.length>0) {
				var coll_list = document.getElementById("collection_names");
				coll_list.innerHTML="";
				var collNum =0;
				dl.meta.all_collection_names.forEach(function (aColl) {
					coll_list.innerHTML+="<option value='"+(collNum++)+"'>"+aColl+"</option>";
				})
			} else {
				showWarning("No data collections in this app");
				document.getElementById('getAndSaveData').style.display = "none";
			}
		}
	});
}

var getAndSaveData = function () {
	console.log("GET AND SAVE DATA");
	hideElments();
	showWarning("Retrieving data for BackUp.")
	dl.collections[0].name = dl.meta.all_collection_names[document.getElementById("collection_names").value];
	document.getElementById("backup_status").innerHTML="<br/> Read these status updates from bottom to top.";
	addStatus("Getting collection: "+dl.collections[0].name);
	dl.collections[0].first_retrieved_date = new Date().getTime();
	dl.collections[0].last_retrieved_date = new Date().getTime();
	dl.current_collection.part=1;
	dl.current_collection.retrieved_all=false;
	dl.collections[0].data=[];
	retrieve_data();
}
var retrieve_data = function() {
	var queryOptions = {
		collection:dl.collections[0].name,
		count:retrieve_COUNT,
		query_params: {'_date_Modified':{'$lt':dl.collections[0].last_retrieved_date}} 
	}
	console.log("options "+JSON.stringify(queryOptions))
	freezr.db.query(gotData, null, queryOptions)	
}
var gotData = function(returnJson) {
	returnJson = freezr.utils.parse(returnJson);
	if (!returnJson) {
		showWarning("Error - could not retrieve data")
	} else if (!returnJson.results || returnJson.results.length==0) {
		if (dl.collections[0].data.length==0) {showWarning(null); showWarning("No data found in that collection");addStatus("refresh page to try again")} else {endRetrieve();}
	} else {
		dl.current_collection.retrieved_all = (returnJson.results.length<retrieve_COUNT);
		console.log("got return data of len "+returnJson.results);
		/*
		var showdate;
		returnJson.results.forEach(function (aLog) { 
			showdate = new Date (aLog._date_Modified);
			console.log("got "+aLog.url+" date "+showdate.toLocaleDateString()+" "+showdate.toLocaleTimeString());
		} ) 
		*/
		dl.collections[0].data = dl.collections[0].data.concat(returnJson.results);
		dl.collections[0].last_retrieved_date = dl.collections[0].data[dl.collections[0].data.length-1]._date_Modified;
		addStatus("got "+returnJson.results.length+" records for a total of "+dl.collections[0].data.length)
		var showdate = new Date(dl.collections[0].data[dl.collections[0].data.length-1]._date_Modified)
		console.log("got "+returnJson.results.length+" restuls for tot of : "+dl.collections[0].data.length+" - size is"+JSON.stringify(dl.collections[0].data).length+" Last date "+showdate.toLocaleDateString()+" "+showdate.toLocaleTimeString());
		
		if (dl.current_collection.retrieved_all || JSON.stringify(dl.collections[0].data).length >FILE_SIZE_MAX) {
			var fileName = saveData();
			var lastDate = new Date(dl.collections[0].last_retrieved_date);
			var firstDate = new Date(dl.collections[0].first_retrieved_date);
			addStatus("Created file: '"+fileName+"' for data from "+lastDate.toLocaleDateString()+" "+lastDate.toLocaleTimeString()+ " to "+firstDate.toLocaleDateString()+" "+firstDate.toLocaleTimeString()+ ".");
			dl.collections[0].first_retrieved_date = dl.collections[0].last_retrieved_date;
			dl.current_collection.part++
			dl.collections[0].data=[];
		} 
		if (!dl.current_collection.retrieved_all) {
			retrieve_data();
		} else {
			endRetrieve();
		}
	}
}
var endRetrieve = function() {
	showWarning("Back Up complete. ");
	addStatus("Retrieved all data. Refresh page to do another backup.");
}
// Save Data
var saveData = function() {
	// codepen.io/davidelrizzo/pen/cxsGb
	var text = JSON.stringify(dl);
	var filename = "freezr data backup "+freezr_app_name+" coll "+dl.collections[0].name+" user "+freezr_user_id+" "+dl.meta.date+" part "+dl.current_collection.part+".json";
	var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
	saveAs(blob, filename);
	return filename;
} 

var uploader = {
	current_file_num:null,
	current_collection_num:null,
	current_record:null,
	records_uploaded:0,
	records_updated:0,
	records_erred:0,
	file_content:null,
	override_difference: {
		app_name:false,
		user_name:false
	},
	options: {
		useNewIds:true
	}
};
		

var uploadAndRestoreData = function() {
	var files = document.getElementById("fileUploader").files;
	if (!files || files.length == 0) {
		showWarning("Please choose a file to import");
	} else {
		hideElments();
		uploader.current_file_num = -1;
		processNextFile();
	}
}
var processNextFile = function() {
	var files = document.getElementById("fileUploader").files;
	var file = files[++uploader.current_file_num];

	if (file) {
		console.log("reading file name"+file.name)
		addStatus("Uploading records from file: "+file.name);
		
		uploader.current_collection_num=0;
		uploader.current_record=-1;


		var reader = new FileReader()	
		reader.readAsText(file, "UTF-8");
		reader.onload = function (evt) {
			uploader.file_content= JSON.parse(evt.target.result);
			var doUpload = true;
			if (freezr_app_name !=uploader.file_content.meta.app_name && !uploader.override_difference.app_name) {
				if (confirm("Data from the file '"+file.name+"' came from the the app "+uploader.file_content.meta.app_name+" but you are uploading it to the app "+freezr_app_name+". Are you sure you want to proceed?")) {
					uploader.override_difference.app_name=true;
				} else {
					doUpload= false
				}
			}
			if (doUpload && freezr_user_id !=uploader.file_content.meta.user && !uploader.override_difference.user) {
				if (confirm("Data from the file '"+file.name+"' was from the user "+uploader.file_content.meta.user+" but you are uploading it as user "+freezr_user_id+". Are you sure you want to proceed?")) {
					uploader.override_difference.user=true;
				} else {
					doUpload= false
				}
			}
			console.log("got content for coll "+uploader.file_content.collections[0].name+" of len "+uploader.file_content.collections[0].data.length);
			if (doUpload) {
				processNextRecord();
			} else {
				showWarning("Restore operation interrupted.")
			}
	    }
	    reader.onerror = function (evt) {
	    	addStatus("Could not read file: "+file.name);
	        showWarning("error reading file");
	    }
	} else if (uploader.current_file_num>0) {
		showWarning("Upload FInished")
	} else {
		showWarning("No files to upload");
	}
}
var processNextRecord = function() {
	// process all records in file... then
	var noMoreCollections = false
	while (!noMoreCollections && ++uploader.current_record >= uploader.file_content.collections[uploader.current_collection_num].data.length) {
		if (++uploader.current_collection_num >= uploader.file_content.collections.length) noMoreCollections=true;
		uploader.current_record=0;
		console.log("in while loop coll num "+uploader.current_collection_num+" rec:"+uploader.current_record+" no more coll:"+noMoreCollections) 
	}
	if (noMoreCollections){
		processNextFile();
	} else {
		var thisRecord = uploader.file_content.collections[uploader.current_collection_num].data[uploader.current_record];
		var uploadOptions = {
			updateRecord: (uploader.options.useNewIds? false: true), 
			data_object_id: (uploader.options.useNewIds? null:thisRecord._id+""),
			restoreRecord:true
		}
		delete thisRecord._id;

		//onsole.log("uploading "+thisRecord.url+" with options "+JSON.stringify(uploadOptions) )

		freezr.db.write (thisRecord, function (returnData) {
			returnData = freezr.utils.parse(returnData);
			if (returnData.error) {
				document.getElementById("err_nums").innerHTML= "Errors uploading in total of "+(++uploader.records_erred)+" records."
				console.log("err uploading "+JSON.stringify(thisRecord) )
			} else {
				if (returnData.confirmed_fields._updatedRecord) uploader.records_updated+=1;
				document.getElementById("upload_nums").innerHTML= "Total of "+(++uploader.records_uploaded)+" have been uploaded"+(uploader.records_updated?(", of which "+uploader.records_updated+" were updates of existing records."):".")
			}
			processNextRecord();
		}, uploader.file_content.collections[uploader.current_collection_num].name, uploadOptions );
	}
}

// View Elements
var hideElments = function(){
	document.getElementById("uploadForm").style.display="none";
	document.getElementById("uploadAndRestoreData").style.display="none";
	document.getElementById("download_area").style.display="none";
	document.getElementById("getAndSaveData").style.display="none";
}
var addStatus = function(aText) {
	document.getElementById("backup_status").innerHTML=aText+"<br/>"+document.getElementById("backup_status").innerHTML;	
}

// Generics
var showWarning = function(msg) {
	// null msg clears the message
	if (!msg) {
		document.getElementById("warnings").innerHTML="";
	} else {
		var newText = document.getElementById("warnings").innerHTML;
		if (newText && newText!=" ") newText+="<br/>";
		newText += msg;
		document.getElementById("warnings").innerHTML= newText;
	} 
}
