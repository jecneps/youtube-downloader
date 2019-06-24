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
    else { loadState = LoadEnum.start }
    m.redraw()
})

function callipc(url, format) {
    ipc.send("downloadRequest", {
	url: url,
	format: format,
    })
    console.log(`sent ${url} and ${format}`)
}



function downloadComponent() {
    let url = ""
    let format = "mp3"
    return  {
	view: function() {
	    console.log(`load state ${loadState}`)
	    var loadStyle = (loadState == LoadEnum.loading) ? "block" : "none"
	    var submitStyle = (loadState == LoadEnum.loading) ? "none":"block"
	    return m("div", {class:"flex flex-column items-center"},[
		m("h1", "Enter URL to download"),
	    
		m("input", {type:"text",
			    style:"width: 800px",
			    value: url,
			    autofocus: "autofocus",
			    onchange: function(e) {
			//	e.redraw = false
				url = e.currentTarget.value
			    }
			   }),
		m("div", {class:"flex"}, [
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
		m("button", {style: submitStyle,
			     onclick: function(e) {
				 e.redraw = false
				 console.log(this)
				 callipc(url, format)
			 }
			     
			    }, "Submit"),
		m("div", {class:"loader", style:loadStyle})
	    ]
		    )
	    
	}
    }
}
    
    
m.mount(document.body, downloadComponent())
