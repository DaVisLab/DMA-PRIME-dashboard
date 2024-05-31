
// list of objects (organization is hard...)
    // containing divs
var mainContent = document.getElementById("main-content")
var navBar = document.getElementById("nav-bar")
var mainVisResizer = document.getElementById("main-vis-resizer")
var minorVisResizer = document.getElementById("minor-vis-resizer")
    // options
var optionsHider = document.getElementById("hide-options-button")
var selector = document.getElementById("vis-selector")
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

// Takes a feature object and gets county/zip code, can be extended later if need be
function getSignifier(d){
    if("NAME" in d.properties)
        return d.properties.NAME.toLowerCase()
    else if("ZCTA5CE20" in d.properties)
        return +d.properties.ZCTA5CE20
    else throw("no signifier")
}