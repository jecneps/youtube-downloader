const electron = require("electron")
const {app, BrowserWindow, Menu, shell, dialog} = electron;
const ytdl = require("ytdl-core")
const fs = require("fs")
const ytlist = require("youtube-playlist")
const sanitize = require("sanitize-filename")
const ffm = require("ffmetadata")
const ffmpeg = require("fluent-ffmpeg")
const Path = require("path")

const SPLASH_PATH = `file://${__dirname}/splash_page.html`




var activeStreams = 0
let activeFiles;
let ipc;
var mainWindow;


const menu = [
    {
	label: "Open",
	click: function() {
	    selectFiles((files) => {
		console.log(files)
		activeFiles = new Array()
		files.forEach(function(file) {
		    pathToFileObj(file, activeFiles)
		})
		ipc.setRoute("/bulkEdit")
	    })
	},
    },
    {
	label: "About",
    },
    {
	label: "debug",
	click: function() {
	    mainWindow.webContents.openDevTools()
	},
    }
]

//######################################################
//######################################################
function bug(s) {
    console.log("\n" + s + "\n")
}

// asyncronously turn into File obj and put in array
function pathToFileObj(path, trgArray) {
    var meta = ffm.read(path, function(err, data) {
	trgArray.push(new File(Path.dirname(path) + "/",
			       Path.basename(path),
			       data))
    })
}

class File {
    constructor(dir, name, meta) {
	this.dir = dir
	this.name = name
	this.meta = meta
	this.isBulk = dir == null && name == null
    }
}


//#######################################################
//#######################################################


function handleError(err) {
    ipc.error("error", err)
    dialog.showErrorBox("Oops", err)
}


//#######################################################

function single(url, format, dir) {
    var options = format == "mp3" ? {filter: "audioonly"} : {}
    
    ytdl.getBasicInfo(url, (err, info) => {
	var title = sanitize(info.player_response.videoDetails.title)
	var name = title + "." + format
	var path = dir + "/" + name
	
	// to keep track of when finished
	activeStreams ++

	// ytdl gets a webm file. Same even with audio only (it just strips the video)
	var reader = ytdl(url, options)
	var writer = fs.createWriteStream(path)

	// ffmpeg formats and then pipes out
	ffmpeg(reader).format(format).pipe(writer)
	
	writer.on("finish", () => {
	    // add file to list for editing
	    activeFiles.push(new File(dir + "/", name, {}))
	    // decrement open counter
	    activeStreams --
	    if (activeStreams == 0) {
		ipc.loadState(false)	
	    }
	    
	})

    })
    
}

function playlist(url, format, dir) {
    ytlist(url, "url").then(res => {
	console.log(`whole playlist = ${res.data.playlist}`)
	res.data.playlist.forEach(function(videourl) {
	    console.log(videourl)
	    single(videourl, format, dir)
	})
    })
}

function download(url, format, dir) {
    activeFiles = new Array()
    ytdl.getBasicInfo(url, (err, info) => {
	console.log(typeof err)
	if (err != null && !String(err).includes("playlist")) {
	    console.log(`info = ${info}`)
	    console.log(`err ${err}`)
	    handleError(err)
	    return
	}
	if (info === undefined) {
	    playlist(url, format, dir)
	}
	else {
	    single(url, format, dir)
	}
    })
}
//###################################################
// when downloading, you're expected to select a directory to download to
function selectDownloadLocation(callback) {
    const options = {
	properties: ["openDirectory"]
    }
    dialog.showOpenDialog(null, options, (filepaths) => {
	callback(filepaths[0])
    })
}

function selectFiles(callback) {
    const options = {
	properties: ["openFile", "multiSelections"]
    }
    dialog.showOpenDialog(null, options, (filepaths) => {
	callback(filepaths)
    })
}

//####################################################

function isValidMeta(data) {
    return data != undefined && data != ""
}

function updateMeta(oldMeta, newMeta) {
    if (isValidMeta(newMeta.artist)) { oldMeta.artist = newMeta.artist }
    if (isValidMeta(newMeta.album)) { oldMeta.album = newMeta.album }
    if (isValidMeta(newMeta.title)) { oldMeta.title = newMeta.title }
}


// File * meta obj -> ()
// treats file as same one in active files
function addMetaData(file, meta) {
    bug(`file=${JSON.stringify(file)}, meta:${JSON.stringify(meta)}`)
    ffm.read(file.dir + file.name, function(err, data) {
	bug(`err: ${err}`)
	bug(`data before:${JSON.stringify(data)}`)
	updateMeta(data, meta)
	bug(`data after switch:${JSON.stringify(data)}`)
	
	ffm.write(file.dir + file.name, data, function(err) {
	    file.meta = data
	    if (isValidMeta(data.title)) {
		bug("in write, data.title was valid")
		// REWRITE TITLE IF IT HAS
		
		fs.renameSync(file.dir + file.name, file.dir + data.title + ".mp3")
		// edit file in local storage
		file.name = data.title + ".mp3"
		bug(`file after rewriting name:${JSON.stringify(file)}`)
		// this only happens on single edit, so updte immediately
		
	    }
	    bug("update comparios")
	    bug(`file that might have changed:${JSON.stringify(file)}`)
	    bug(`current activeFiles:${JSON.stringify(activeFiles)}`)
	    ipc.updateActiveFiles(activeFiles)
	    bug(`err = ${err} on file=${JSON.stringify(file)}`)
	})
    })
}



    

//####################################################
// IPC
//####################################################

class IPC {
    constructor(window) {
	this.ipc = require("electron").ipcMain
	console.log(`constructor window=${window}`)
	this.window = window
    }

    on(channel, fun) {
	this.ipc.on(channel, fun)
    }

    setRoute(route) {
	this.window.webContents.send("set-route", {route: route})
    }

    updateActiveFiles(files) {
	this.window.webContents.send("update-files", {files: files})
    }

    loadState(isLoading) {
	console.log(`loadState this=${this}`)
	this.window.webContents.send("loading-event", {isLoading: isLoading})
    }

    error(err) {
	this.window.webContents.send("error", {error: err})
    }
}

function downloadRequest(event, args) {
    selectDownloadLocation((dir) => {
	// Tell Ui to load
	ipc.loadState(true)
	download(args.url, args.format, dir)
    })
}

function editMetaRequest(event, args) {
    bug(`activeFiles:${JSON.stringify(activeFiles)}`)
    bug(`args: ${JSON.stringify(args)}`)
    bug(`recieved meta edit req, file:${JSON.stringify(args.file)}`)
    if (args.file.isBulk) {
	console.log("is not")
	activeFiles.forEach((file) => {
	    console.log(`From active files: ${JSON.stringify(file)}`)
	    addMetaData(file, args.file.meta)
	})
    }
    else {
	console.log("is single")
	var file = activeFiles.find((f) => f.dir == args.file.dir && f.name == args.file.name)
	addMetaData(file, args.file.meta)
    }
}

function deleteFileRequest(event, args) {
    fs.unlink(args.path, (err) => {
	console.log(err)
    })
    activeFiles = activeFiles.filter((file) => filename != args.path)
}

function clearState(event, args) {
    activeFiles = null
    activeStreams = 0
}



//####################################################





function setup() {
    // create main window
    app.on("ready", function() {
	
	mainWindow = new BrowserWindow({
	    webPreferences: {
		// allows us to use webpack and requires on the render side
		nodeIntegration: true
	    }
	})
	mainWindow.loadURL(SPLASH_PATH)
	mainWindow.maximize()

	ipc = new IPC(mainWindow)
	ipc.on("downloadRequest", downloadRequest)
	ipc.on("editMetaRequest", editMetaRequest)
	ipc.on("deleteRequest", deleteFileRequest)
	ipc.on("clearState", clearState)
	ipc.on("updateFilesRequest", (event, args) => ipc.updateActiveFiles(activeFiles))
    })

    // set menu stuff
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu))  
}

setup()
