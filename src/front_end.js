const m = require("mithril")
const ipc = require("electron").ipcRenderer

const LoadEnum = {
    start: 0,
    loading: 1,
}

var loadState = LoadEnum.start

ipc.on("loading-event", function(event, args) {
    console.log(event)
    console.log(args)
    if (args) { loadState = LoadEnum.loading }
    else {
	loadState = LoadEnum.start
	m.route.set("/bulkEdit")
    }
    m.redraw()
})

ipc.on("error", function(event, args) {
    console.log("EEERRROR")
    loadState = LoadEnum.start
    m.redraw()
})

ipc.on("openBulk", function(event, args) {
    m.route.set("/bulkEdit")
})

function callipc(url, format) {
    ipc.send("downloadRequest", {
	url: url,
	format: format,
    })
    console.log(`sent ${url} and ${format}`)
}


function singleEditComponent() {
    return {
	view: function() {}
    }
}


function bulkEditComponent() {
    let artist = "";
    let album = "";
    let photo = null;
    return {
	view: function() {
	    return m("div", {class: "flex flex-column bg-orange w-50", style: "margin: auto"}, [
		m("h1", "Bulk Edit") ,
		m("div", {class: "flex"}, [
		    m("div", {class: "flex flex-column"}, [
			m("p", "Artist"),
			m("input", {type: "text",
				    class: "mb4",
				    onchange: function(e) {
					e.redraw = false
					artist = e.currentTarget.value
				    }
				   }),
			m("p", "Album"),
			m("input", {type: "text",
				    class: "",
				    onchange: function(e) {
					e,redraw = false
					album = e.currentTarget.value
				    }
				   })
			
		    ]),
		    m("div", "Image thing")
		]),
		m("div", {class: "flex"}, [
		    m("button", {class: "",
				 onclick: function() {
				     m.route.set("/singleEdit")
				 }
				},
				 "Skip"),
		      m("button", {class: "",
				   onclick: function() {
				       ipc.send("bulk-edit", {
					   artist: artist,
					   album: album,
					   photo: photo
				       })
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
	    console.log(`load state ${loadState}`)
	    var loadStyle = (loadState == LoadEnum.loading) ? "display:block" : "display:none"
	    var submitStyle = (loadState == LoadEnum.loading) ? "display:none":"display:block"
	    console.log(`ls ${loadStyle} and ss ${submitStyle}`)
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
				 callipc(url, format)
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

    
    
//m.mount(document.body, downloadComponent())
m.route(document.body, "/download", {
    "/download": downloadComponent(),
    "/bulkEdit": bulkEditComponent(),
    "/singleEdit": singleEditComponent()
})
