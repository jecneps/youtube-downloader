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

    deleteRequest(path) {
	this.ipc.send("deleteRequest", {path: path})
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
	var comp = m("div", {class:"bg-washed-red mt2 mb2"}, [
	    m("span", {class: "f5",
		       onclick: function() {
			   curData.title = file.meta.title
			   curData.artist = file.meta.artist
			   curData.album = file.meta.album
			   curData.curFile = file
			   curData.show = true
		       }
		      }, file.name.replace(".mp3", "")),
	    m("button", {class:"ml3 fr",
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
	    var main = m("div", {class: "bg-near-white flex flex-column items-center",
			     style: "margin: auto"
			    }, [
				m("div", {class: "flex flex-column"}, makeCards()),
				m("button", {class: "",
					     onclick: function() {
						 ipc.clearState()
						 m.route.set("/download")
					     }
					    }, "Finish")
			    ])
	    return curData.show ? [main, singleEditPopup()] : main
	}
    }
}

function editField(title, dict, key, prefill) {
    var text = prefill == undefined ? "" : prefill
    return [m("p", title),
	    m("input",{type: "text",
		       class: "mb4",
		       onchange: function(e) {
			   e.redraw = false
			   dict[key] = e.currentTarget.value
		       },
		       value: text
		      })
	    ]
}

function singleEditPopup() {
    return m("div", {class: "flex flex-column bg-orange w-50", style: "margin: auto"}, [
	m("h1", "Single Edit") ,
	m("div", {class: "flex"}, [
	    m("div", {class: "flex flex-column"}, [
		    ...editField("Title", curData, "title", curData.title),
		    ...editField("Artist", curData, "artist", curData.artist),
		    ...editField("Album", curData, "album", curData.album)
	    ])
	    // TODO: image thing
	]),
	m("div", {class: "flex"}, [
	    m("button", {class: "",
			 onclick: function() {
			     curData.show = false
			 }
			},
	      "Cancel"),
	    m("button", {class: "",
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
	    return m("div", {class: "flex flex-column bg-orange w-50", style: "margin: auto"}, [
		m("h1", "Bulk Edit") ,
		m("div", {class: "flex"}, [
		    m("div", {class: "flex flex-column"}, [
			    ...editField("Artist", data, "artist"),
			    ...editField("Album", data, "album")			
		    ]),
		    //TODO: IMAGE
		]),
		m("div", {class: "flex"}, [
		    m("button", {class: "",
				 onclick: function() {
				     ipc.updateFilesRequest()
				     m.route.set("/singleEdit")
				 }
				},
				 "Skip"),
		      m("button", {class: "",
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
    let url = ""
    let format = "mp3"
    return  {
	view: function() {
	   // console.log(`load state ${loadState}`)
	    var loadStyle = (loadState == LoadEnum.loading) ? "display:block" : "display:none"
	    var submitStyle = (loadState == LoadEnum.loading) ? "display:none":"display:block"
	   // console.log(`ls ${loadStyle} and ss ${submitStyle}`)
	    return m("div", {class:"flex flex-column items-center"},[
		m("h1", "Enter URL to download"),

		// url text input
		m("input", {type:"text",
			    style:"width: 800px",
			    class:"mb3",
			    value: url,
			    autofocus: "autofocus",
			    onchange: function(e) {
			//	e.redraw = false
				url = e.currentTarget.value
			    }
			   }),
		// radio buttons for format 
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
		//submit button
		m("button", {style: submitStyle,
			     onclick: function(e) {
				 //e.redraw = false
				 ipc.downloadRequest(url, format)
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
    

