const electron = require("electron")
const url = require("url")
const path = require("path")
const {app, BrowserWindow, Menu, ipcMain, shell, dialog} = electron;
const ytdl = require("ytdl-core")
const fs = require("fs")
const ytlist = require("youtube-playlist")
const sanitize = require("sanitize-filename")

var activeStreams = 0

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


function single(url, format, dir) {
    var options = format == "mp3" ? {filter: "audioonly"} : {}
    
    ytdl.getBasicInfo(url, (err, info) => {
	var title = info.player_response.videoDetails.title
	//console.log(title)
	var path = dir + "/" + sanitize(title) + "." + format
	
	// to keep track of when finished
	activeStreams ++
	
	var reader = ytdl(url, options)
	var writer = fs.createWriteStream(path)
	reader.pipe(writer)
	writer.on("finish", () => {
	    console.log(activeStreams)
	    activeStreams --
	    if (activeStreams == 0) { mainWindow.webContents.send("loading-event", false) }
	})

    })
    
}

function playlist(url, format, dir) {
    ytlist(url, "url").then(res => {
	res.data.playlist.forEach(function(videourl) {
	    console.log(videourl)
	    single(videourl, format, dir)
	})
    })
}

function download(url, format, dir) {
    
    ytdl.getBasicInfo(url, (err, info) => {
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

//####################################################


ipcMain.on("downloadRequest", function(event, args) {   
    selectDownloadLocation((dir) => {
	// Tell Ui to load
	mainWindow.webContents.send("loading-event", true)
	download(args.url, args.format, dir)
    })
})


//####################################################

const menu = [
    {
	label: "Open",
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

