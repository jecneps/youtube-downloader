const electron = require("electron")
const {app, BrowserWindow, Menu, ipcMain, shell, dialog} = electron;
const ytdl = require("ytdl-core")
const fs = require("fs")
const ytlist = require("youtube-playlist")
const sanitize = require("sanitize-filename")
const ffm = require("ffmetadata")
const ffmpeg = require("fluent-ffmpeg")

var activeStreams = 0
var activeFiles;

let mainWindow;
let p = `file://${__dirname}/splash_page.html`
app.on("ready", function() {
    mainWindow = new BrowserWindow({
	webPreferences: {
	    nodeIntegration: true
	}
    })
    mainWindow.loadURL(p)
    mainWindow.maximize()
})


function handleError(err) {
    mainWindow.webContents.send("error", true)
    dialog.showErrorBox("Oops", err)
}


//#######################################################

function single(url, format, dir) {
    var options = format == "mp3" ? {filter: "audioonly"} : {}
    
    ytdl.getBasicInfo(url, (err, info) => {
	var title = info.player_response.videoDetails.title
	var path = dir + "/" + sanitize(title) + "." + format
	
	// to keep track of when finished
	activeStreams ++

	// ytdl gets a webm file. Same even with audio only (it just strips the video)
	var reader = ytdl(url, options)
	var writer = fs.createWriteStream(path)

	// ffmpeg formats and then pipes out
	ffmpeg(reader).format(format).pipe(writer)
	
	writer.on("finish", () => {
	    // add file to list for editing
	    activeFiles.push(path)
	    // decrement open counter
	    activeStreams --
	    if (activeStreams == 0) {
		mainWindow.webContents.send("loading-event", false)
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

function addMetaData(file, artist, album, photo) {
    ffm.read(file, function(err, data) {
	console.log(`err: ${err} \n data:${JSON.stringify(data)}`)
	data.artist = artist
	data.album = album
	
	ffm.write(file, data, function(err) {
	    console.log(`err = ${err} on file=${file}`)
	})
    })
}



    

//####################################################


ipcMain.on("downloadRequest", function(event, args) {   
    selectDownloadLocation((dir) => {
	// Tell Ui to load
	mainWindow.webContents.send("loading-event", true)
	download(args.url, args.format, dir)
    })
})

ipcMain.on("bulk-edit", function(event, args) {
    console.log(`bulk edit event recieve. art:${args.artist} alb:${args.album}, photo:${args.photo}`)
    activeFiles.forEach( (file) => addMetaData(file, args.artist, args.album, args.photo))
})


//####################################################

const menu = [
    {
	label: "Open",
	click: function() {
	    selectFiles((files) => {
		activeFiles = files
		mainWindow.webContents.send("openBulk")
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

Menu.setApplicationMenu(Menu.buildFromTemplate(menu))

