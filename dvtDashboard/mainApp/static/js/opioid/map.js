const { DeckGL, GeoJsonLayer } = deck;


// import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
// import {GeoJsonLayer} from '@deck.gl/layers';
// import maplibregl from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';

// const map = new maplibregl.Map({
//     container: "map-div",
//     style: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
//     center: [-80.75, 33.8],
//     zoom: 7,
// })

// const deckOverlay = new DeckOverlay({

// })

// map.addControl(deckOverlay)
// map.addControl(new maplibregl.NavigationControl())

const deckgl = new DeckGL({
    container: document.getElementById("map-div"),
    mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
    initialViewState: {
        longitude: -80.75,
        latitude: 33.8,
        zoom: 7
    },
    controller: true,
    pickingRadius: 10,
});

// deckgl.addWidget(new D3Anchor({
//     "id": "choropleth-legend",
//     "placement": "bottom-left",
//     "divId": "help"
// }));

function redraw() {
    processZctaData().then(function () {
        features = zctaData.features

        var1Data = d3.map(features, d => +d.properties.data[mapYearSelector.value][mapVariable1Selector.value])
        var2Data = d3.map(features, d => +d.properties.data[mapYearSelector.value][mapVariable2Selector.value])

        bivariateColormap = createBivariateColormap(d3.min(var1Data), d3.max(var1Data), d3.min(var2Data), d3.max(var2Data))

        deckgl.setProps({
            layers: [
                new GeoJsonLayer({
                    id: 'opioid_choropleth',
                    data: zctaData, //'../../static/data/opioid_zcta_hospitalization_data.json',
                    stroked: true,
                    filled: true,
                    pointType: 'circle+text',
                    pickable: true,

                    getFillColor: d => {
                        var c = d3.rgb(bivariateColormap(+d.properties.data[mapYearSelector.value][mapVariable1Selector.value])(+d.properties.data[mapYearSelector.value][mapVariable2Selector.value])); return [c.r, c.g, c.b]
                    },
                    getStrokeColor: [0, 0, 0],
                    getLineColor: [0, 0, 0],
                    lineWidthMinPixels: .5,
                    getLineWidth: 20,
                    getPointRadius: 4,
                    getText: d => d.properties.ZCTA5CE20,
                    getTextSize: 12,
                    updateTriggers: {
                        getFillColor: { dataVersion }
                    }
                })
            ]
        })
        drawLegend(d3.min(var1Data), d3.max(var1Data), d3.min(var2Data), d3.max(var2Data))
        return true
    })

}

function drawLegend(primaryMin = 0, primaryMax = 3, secondaryMin = 0, secondaryMax = 3) {
    legendSVG = document.getElementById("choropleth-legend-svg")
    legendSVG.innerHTML = ""
    legend = d3.select(legendSVG)
        .attr("overflow", "visible")
        .attr("transform", `translate(40,-40) rotate(0) scale(1 -1)`)
        // .attr("transform", `translate(-${10 + 10 + 12 + 16},-${(10 + 10 + 12 + 16)}) rotate(0) scale(1 -1)`)
        // .attr("transform", `translate(${10 + 10 + 12 + 16},${height - (10 + 10 + 12 + 16)}) rotate(0) scale(1 -1)`)

    for (i = 0; i < 3; i++) {
        for (j = 0; j < 3; j++) {
            rect = legend.append('rect')
                .attr("id", `#r${i}${j}`)
                .attr("fill", bivariateColormap(primaryMin + (primaryMax-primaryMin)*(i+.1)/3)(secondaryMin + (secondaryMax-secondaryMin)*(j+.1)/3))
                .attr("height", 25)
                .attr("width", 25)
                .attr("x", 25 * i)
                .attr("y", 25 * j)
        }
    }

    legendCountAxis = legend.append("g")
        .attr("id", "legend-count-axis")
    legendCountAxis.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 75)
        .attr("y2", 0)
        .attr("stroke-width", 2)
        .attr("stroke", "black")
    legendCountAxis.append("text")
        .attr("x", 75 / 2)
        .attr("y", 10 + 10 + 12)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("fill", "black")
        .attr("transform", "scale(1 -1)")
        .text(mapVariable1Selector.value)
    for (i = 1; i < 3; i++) {
        legendCountAxis.append("line")
            .attr("x1", 25 * i)
            .attr("y1", 0)
            .attr("x2", 25 * i)
            .attr("y2", -10)
            .attr("stroke-width", 2)
            .attr("stroke", "black")
        legendCountAxis.append("text")
            .attr("x", 25 * i)
            .attr("y", 10 + 10)
            .attr("text-anchor", "middle")
            .attr("font-size", 10)
            .attr("fill", "black")
            .attr("transform", "scale(1 -1)")
            .text(d3.format(".2f")(bivariateColormap.thresholds()[i-1]))
    }

    legendCountAxis = legend.append("g")
        .attr("id", "legend-confidence-axis")
        .attr("transform", "rotate(90)")
    legendCountAxis.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 75)
        .attr("y2", 0)
        .attr("stroke-width", 2)
        .attr("stroke", "black")
    legendCountAxis.append("text")
        .attr("x", 75 / 2)
        .attr("y", -(5 + 10 + 12))
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("fill", "black")
        .attr("transform", "scale(1 -1)")
        .text(mapVariable2Selector.value)
    for (i = 1; i < 3; i++) {
        legendCountAxis.append("line")
            .attr("x1", 25 * i)
            .attr("y1", 0)
            .attr("x2", 25 * i)
            .attr("y2", 10)
            .attr("stroke-width", 2)
            .attr("stroke", "black")
        legendCountAxis.append("text")
            .attr("x", 25 * i)
            .attr("y", -(5 + 10))
            .attr("text-anchor", "middle")
            .attr("font-size", 10)
            .attr("fill", "black")
            .attr("transform", "scale(1 -1)")
            .text(d3.format(".0f")(bivariateColormap(0).thresholds()[i-1]))
    }
}
