
// list of objects
var optionsHider = document.getElementById("hideOptionsButton")
var mainContentDivider = document.getElementById("mainContentDivider")
var mainContent = document.getElementById("mainContent")
var navBar = document.getElementById("navBar")
var selector = document.getElementById("visSelector")

// nav bar interaction functionality
var mapType = "county"

navBar.addEventListener("sl-tab-show", (tabName) => {
    mapType = tabName.detail.name 
    displayMap(mapType)
})

// options interaction functionality
selector.addEventListener("sl-change", () => {
    console.log(selector.value)
    switch(selector.value) {
        case "none":
            clearVisualization()
            break;
        case "aggregated":
            aggregatedVisualization()
            break;
    }
})

// options visual functionality
{
var optionsPosition = mainContent.position
let options_open = true;

optionsHider.addEventListener("click", () => {
    options_open = !options_open;

    if (options_open) {
        optionsHider.name = "chevron-compact-left"
        mainContent.position = optionsPosition
    } else {
        optionsPosition = mainContent.position
        mainContent.position = 0
        optionsHider.name = "chevron-compact-right"
    }
    resizeMap(mapType)
});

mainContent.addEventListener("sl-reposition", () => {
    if (mainContent.position > 0) {
        options_open = true;
        optionsHider.name = "chevron-compact-left"
    } else {
        options_open = false;
        optionsHider.name = "chevron-compact-right"
    }
    resizeMap(mapType)
});
}

// main visualization visual functionality
window.addEventListener("resize", () => {
    resizeMap(mapType)
})

function determineMap(mapType) {
    switch (mapType) {
        case "zip": 
            return "../static/data/tl_2023_sc_zcta.json";
        case "block":
            return "../static/data/tl_2023_sc_block.json";
        default: 
        case "county":
            return "../static/data/tl_2023_sc_county.json";
    }
}