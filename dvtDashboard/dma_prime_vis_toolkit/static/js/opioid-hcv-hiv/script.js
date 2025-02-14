
var formatInt = d3.format(".0f")

var primaryMin = 0
var primaryMax = 3
var secondaryMin = 0
var secondaryMax = 3

var mainColor = [d3.hsl(200, .7, .3), // cyan 
d3.hsl(290, .7, .3), // magenta
d3.hsl(0, .7, .3)] //red

var unknownColor = d3.hsl("#7F7F7F")

var bivariateColormap = createBivariateColormap()
var univariateColormap = createUnivariateColormap()

let dataVersion = 0


function createUnivariateColormap(primaryMin = 0, primaryMax = 3) {
    // creating a linear colormap from cyan to magenta to red
    return d3.scaleLinear().domain([primaryMin, (primaryMin+primaryMax)/2, primaryMax]).range(mainColor).unknown(unknownColor)
}

function createBivariateColormap(primaryMin = 0, primaryMax = 3, secondaryMin = 0, secondaryMax = 3) {
    // creating a bivariate colormap from cyan to magent to red on one axis and light to dark on the other 
    var range = []
    for (var hue = 0; hue <= 2; hue++) {
        var innerRange = []
        for (var sat = -1; sat <= 1; sat++) {
            var color = d3.hsl(mainColor[hue])
            color.l = .4
            color.s -= .3 * sat
            color.l += .2 * sat
            innerRange.push(color)
        }
        range.push(d3.scaleQuantize().domain([secondaryMin, secondaryMax]).range(innerRange.reverse()).unknown(unknownColor))
    }
    return d3.scaleQuantize().domain([primaryMin, primaryMax]).range(range).unknown((val) => unknownColor)
}

function capitalizeFirst(string) {
    // capitalize first character of a string and return the result
    return string[0].toUpperCase()+string.substring(1)
}
