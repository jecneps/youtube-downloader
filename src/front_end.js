const m = require("mithril")


const LoadEnum = {
    start: 0,
    loading: 1,
}

var loadState = LoadEnum.start
let ipc;
var activeFiles = new Array()

//#############################################
class File {
    constructor(dir, name, meta) {
	this.dir = dir
	this.name = name
	this.meta = meta
	this.isBulk = dir == null && name == null
    }
}

//#################################################
// IPC
//################################################

class IPC {
    constructor() {
	this.ipc = require("electron").ipcRenderer
    }

    on(channel, fun) {
	this.ipc.on(channel, fun)
    }

    downloadRequest(url, format) {
	this.ipc.send("downloadRequest", {url: url,
					  format: format})
    }

    editMetaRequest(file) {
	this.ipc.send("editMetaRequest", {file: file})
    }

    updateFilesRequest() {
	this.ipc.send("updateFilesRequest", {})
    }

    deleteRequest(file) {
	this.ipc.send("deleteRequest", {path: file.dir + file.name})
    }

    clearState() {
	this.ipc.send("clearState", {})
    }

}

function loadingEvent(event, args) {
    console.log(event)
    console.log(args)
    console.log(args.isLoading)
    if (args.isLoading) {
	console.log("isloading")
	loadState = LoadEnum.loading
    }
    else {
	console.log("here")
	loadState = LoadEnum.start
	m.route.set("/bulkEdit")
    }
    m.redraw()
}

function error(event, args) {
    console.log("EEERRROR")
    console.log(args.error)
    loadState = LoadEnum.start
    m.redraw()
}

function setRoute(event, args) {
    m.route.set(args.route)
}

function updateActiveFiles(event, args) {
    console.log(`new files from main:${JSON.stringify(args.files)}`)
    activeFiles = args.files
    m.redraw()
}
//###################################################
//###################################################

var curData = {
    show: false,
    artist: "",
    album: "",
    title: "",
    curFile: null
}

function curMeta() {
    return {
	artist: curData.artist,
	album: curData.album,
	title: curData.title
    }
}

function makeCards() {
    var cards = new Array()
    activeFiles.forEach(function(file) {
	console.log(`file in cards:${JSON.stringify(file)}`)
	var comp = m("div", {class:"songContainer"}, [
	    m("div", {class: "name",
		       onclick: function() {
			   curData.title = file.meta.title
			   curData.artist = file.meta.artist
			   curData.album = file.meta.album
			   curData.curFile = file
			   curData.show = true
		       }
		      }, file.name.replace(".mp3", "")),
	    m("button", {class:"x",
			 onclick: function(){
			     ipc.deleteRequest(file)
			     ipc.updateFilesRequest()
			 }
			}, "X")
	])
	cards.push(comp)
    })
    return cards

}


function singleEditComponent() {
    return {
	view: function() {
	    var main = m("div", {class: "container", id:"cards"}, [
		m("h1", "Click to Edit"),
		m("div", {class: "cardHolder"}, makeCards()),
		m("button", {class: "butt",
			     onclick: function() {
				 ipc.clearState()
				 m.route.set("/download")
			     }
			    }, "Finish")
	    ])
	    return curData.show ? singleEditPopup() : main
	}
    }
}

function coolEditField(label, dict, key, autoFocus, prefill) {
    var text = prefill == undefined ? "" : prefill
    var input = m("input", {type: "text",
			    class: "textInput",
			    autofocus: (autoFocus) ? "autofocus" : undefined,
			    onchange: function(e) {
				e.redraw = false
				dict[key] = e.currentTarget.value
			    },
			    value: text
			   })
    var inner = (label == null) ? [input] : [input, m("label", {class: "lab"},label)]
    return m("div", {class: "editContainer"}, inner)
	
}


function singleEditPopup() {
    return m("div", {class: "container", id:"singleEdit"}, [
	m("h1", "Single Edit") ,
	coolEditField("Title", curData, "title", true, curData.title),
	coolEditField("Artist", curData, "artist", false, curData.artist),
	coolEditField("Album", curData, "album", false, curData.album),
	m("div", {class: "buttons"}, [
	    m("button", {class: "butt",
			 onclick: function() {
			     curData.show = false
			 }
			},
	      "Cancel"),
	    m("button", {class: "butt",
			 onclick: function() {
			     curData.show = false
			     curData.curFile.meta = curMeta()
			     ipc.editMetaRequest(curData.curFile)
			     // TODO have this effect file name and reshape
			     
			     console.log("clicked save")
			 }
			},
	      "Save")
	])
    ])   
}

function bulkEditComponent() {
    var data = {
	artist: "",
	album: "",
    }
    return {
	view: function() {
	    return m("div", {class: "container", id:"bulkEdit"}, [
		m("h1", "Bulk Edit") ,
		coolEditField("Artist", data, "artist"),
		coolEditField("Album", data, "album"),
		m("div", {class: "buttons"}, [
		    m("button", {class: "butt",
				 onclick: function() {
				     ipc.updateFilesRequest()
				     m.route.set("/singleEdit")
				 }
				},
				 "Skip"),
		      m("button", {class: "butt",
				   onclick: function() {
				       var file = new File(null,
								    null,
								    {artist: data.artist,
								     album: data.album})
				       console.log(`bulk edit, file=${JSON.stringify(file)}`)
				       ipc.editMetaRequest(file)
				       m.route.set("/singleEdit")
				   }
				  },
			"Perform")
		])
	    ])
	}
    }
}



function downloadComponent() {
    var data = {
	url: ""
    }
    let format = "mp3" //spooooooky, a string that never get's changed!
    return  {
	view: function() {
	   // console.log(`load state ${loadState}`)
	    var loadStyle = (loadState == LoadEnum.loading) ? "display:block" : "display:none"
	    var submitStyle = (loadState == LoadEnum.loading) ? "display:none":"display:block"
	   // console.log(`ls ${loadStyle} and ss ${submitStyle}`)
	    return m("div", {class:"container", id:"download"},[
		m("h1", "Enter URL to download"),

		// url text input
		coolEditField(null, data, "url",true),
		// radio buttons for format 
	/* This was the radio buttons. Since my meta data refactoring didn't take into account mp4, and I really don't care to download videos, I'm just going to remove this from this version, come back to it later.
	  m("div", {class:"flex mb3"}, [
		    m("input", {type: "radio",
				name:"format",
				value:"mp3",
				checked:"checked",
				onchange: function(e) {
				    console.log("the mp3")
				    e.redraw = false
				    format = "mp3"
				}
			       }),
		    m("div", {class:"mr2"},"mp3"),
		    m("input", {type: "radio",
				name:"format",
				value:"mp4",
				onchange: function(e) {
				    console.log("the mp4")
				    e.redraw = false
				    format = "mp4"
				}
			       }, "mp4"),
		    m("div", {class:"mr2"}, "mp4")
		    
		]), 
		*/
		//submit button
		m("button", {class: "butt",
			     style: submitStyle,
			     onclick: function(e) {
				 //e.redraw = false
				 ipc.downloadRequest(data.url, format)
				 url = ""
			 }
			     
			    }, "Submit"),
		// loader div
		m("div", {class:"loader", style: loadStyle})
	    ]
		    )
	    
	}
    }
}


function setup() {
    //m.mount(document.body, downloadComponent())
    m.route(document.body, "/download", {
	"/download": downloadComponent(),
	"/bulkEdit": bulkEditComponent(),
	"/singleEdit": singleEditComponent()
    })

    ipc = new IPC()
    ipc.on("loading-event", loadingEvent)
    ipc.on("error", error)
    ipc.on("update-files", updateActiveFiles)
    ipc.on("set-route", setRoute)

}

setup()
    

