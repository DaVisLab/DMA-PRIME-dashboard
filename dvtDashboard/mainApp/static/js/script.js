
// list of objects (organization is hard...)
    // containing divs
var mainContent = document.getElementById("mainContent")
var navBar = document.getElementById("navBar")
var mainVisResizer = document.getElementById("mainVisResizer")
var minorVisResizer = document.getElementById("minorVisResizer")
    // options
var optionsHider = document.getElementById("hideOptionsButton")
var selector = document.getElementById("visSelector")
    // resizing
var mainContentDivider = document.getElementById("mainContentDivider")
    // visualization
var mainSVG = d3.select("#mainVis");
var jsSVG = document.getElementById("mainVis")
var mapItemsD3 = mainSVG.selectAll(".mapItems")

var numMinorVis = 0

// Takes a feature object and gets county/zip code, can be extended later if need be
function getSignifier(d){
    if("NAME" in d.properties)
        return d.properties.NAME.toLowerCase()
    else if("ZCTA5CE20" in d.properties)
        return +d.properties.ZCTA5CE20
    else throw("no signifier")
}