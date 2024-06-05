
// list of objects (organization is hard...)
    // containing divs
var mainContent = document.getElementById("main-content")
var navBar = document.getElementById("nav-bar")
var mainVisResizer = document.getElementById("main-vis-resizer")
var minorVisResizer = document.getElementById("minor-vis-resizer")
    // options
var optionsHider = document.getElementById("hide-options-button")
var selector = document.getElementById("vis-selector")
var forecastSelector = document.getElementById("forecast-selector")
var normalizePopSwitch = document.getElementById("normalize-pop-switch")
var timeSlider = document.getElementById("time-slider")
    // resizing
var mainContentDivider = document.getElementById("main-content-divider")
    // visualization
var mainSVG = d3.select("#main-vis");
var jsSVG = document.getElementById("main-vis")
var mapItemsD3 = mainSVG.selectAll(".map-items")

// variables
var mapType = "county"
var populationNormalized = false
var visType = "none"
var optionsPosition = mainContent.position
var optionsOpen = true;
var chosenDate = new Date(timeSlider.value * 1000)
var numMinorVis = 0

chosenColumn = 0

// visualization variables
var iconDoubleDown = `<path fill="currentColor" fill-rule="evenodd" d="M1.646 6.646a.5.5 0 0 1 .708 0L8 12.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                      <path fill="currentColor" fill-rule="evenodd" d="M1.646 2.646a.5.5 0 0 1 .708 0L8 8.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>`
var iconDown = '<path fill="currentColor" fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>'
var iconNeutal = '<path fill="currentColor" fill-rule="evenodd" d="M2 8a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 8"/>'
var iconUp = '<path fill="currentColor" fill-rule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708z"/>'
var iconDoubleUp = `<path fill="currentColor" fill-rule="evenodd" d="M7.646 2.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 3.707 2.354 9.354a.5.5 0 1 1-.708-.708z"/>
                    <path fill="currentColor" fill-rule="evenodd" d="M7.646 6.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 7.707l-5.646 5.647a.5.5 0 0 1-.708-.708z"/>`

// Takes a feature object and gets county/zip code, can be extended later if need be
function getSignifier(d){
    if("NAME" in d.properties)
        return d.properties.NAME.toLowerCase()
    else if("ZCTA5CE20" in d.properties)
        return "zip-" + d.properties.ZCTA5CE20
    else throw("no signifier")
}