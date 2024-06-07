

// dom objects
    // containing divs
var mapResizer = document.getElementById("map-resizer")
    // options
var resetButton = document.getElementById("reset-button")
    // map
var jsmapSVG = document.getElementById("map-svg")
var mapSVG = d3.select("#map-svg")
var countiesGroup = d3.select("#counties")

// visualization variabls
margins = {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10
}

var mapProjection = null

function fixHospitalName(name) {
    newName = name.toLowerCase().split(" ").join('-')
    newName = newName.replace(/\//g, '')
    newName = newName.replace(/'/g, '')
    return newName
}