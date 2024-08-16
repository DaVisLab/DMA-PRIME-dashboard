

// nav bar interaction functionality
{
navBar.addEventListener("sl-tab-show", (tabName) => {
    mapType = tabName.detail.name 
    selector.value = "none"
    displayMap(mapType)
})
}

// options interaction functionality
{
selector.addEventListener("sl-change", () => {
    visType = selector.value
    switch(visType) {
        case "none":
            clearVisualization()
            break;
        case "aggregated":
            aggregatedVisualization()
            break;
        case "daily":
            dailyVisualization()
            break;
    }
})

normalizePopSwitch.addEventListener("sl-change", () => {
    populationNormalized = normalizePopSwitch.checked
    if(visType == "daily")
        dailyVisualization()
    else {
        aggregatedVisualization()
    }
})
}

// extra options interaction functionality
{
timeSlider.addEventListener("sl-change", (details) => {
    chosenDate = new Date(timeSlider.value * 1000)
    if(visType == "daily")
        dailyVisualization()
})
}

// options visual functionality
{
forecastSelector.addEventListener("sl-after-hide", () => {
    changePrediction()
})
}

// extra options visual functionality
{
timeSlider.tooltipFormatter = (t) => {
    d = new Date(t * 1000);
    return d.toLocaleDateString()
}
}

// main visualization visual functionality
{
mainVisResizer.addEventListener("sl-resize", () => {
    updateMap(mapType)
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
}