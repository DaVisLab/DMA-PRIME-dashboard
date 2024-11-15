
var formatInt = d3.format(".0f")

var primaryMin = 0
var primaryMax = 3
var secondaryMin = 0
var secondaryMax = 3

var mainColor = [d3.hsl(200, .7, .3), // cyan 
d3.hsl(290, .7, .3), // magenta
d3.hsl(0, .7, .3)] //red

var bivariateColormap = createBivariateColormap()

let dataVersion = 0

function createBivariateColormap(primaryMin = 0, primaryMax = 3, secondaryMin = 0, secondaryMax = 3) {
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
        range.push(d3.scaleQuantize().domain([secondaryMin, secondaryMax]).range(innerRange.reverse()))
    }
    return d3.scaleQuantize().domain([primaryMin, primaryMax]).range(range).unknown((val) => d3.hsl("#888888"))
}

// data fetching
async function processZctaData() {
    if (typeof zctaData == "undefined") {
        await d3.json(`/data/hospitalizations/opioid`).then((data) => zctaData = data)
    }
    features = zctaData.features

    features.forEach((feature, index) => {
        features[index][mapVariable1Selector.value] = feature.properties.data[mapYearSelector.value][mapVariable1Selector.value]
        features[index][mapVariable2Selector.value] = feature.properties.data[mapYearSelector.value][mapVariable2Selector.value]
    })

    return true
}


class D3Anchor {
    static #count = 0;
    constructor(props={}) { //should have options.size
        var defaultProps = {
            // interface
            "id":"d3anchor",
            "viewId": null,
            "placement": "top-left",
            // extra
            "onHover": () => null,
            "onClick": () => null,
            "onDragStart": () => null,
            "onDrag": () => null,
            "onDragEnd": () => null,
            "divId": "div",
        }

        this.props = Object.assign(defaultProps, props)

        if (this.props.id == "d3anchor") {
            this.id = `${this.props.id}${D3Anchor.#count}`
            this.props.id = `${this.props.id}${D3Anchor.#count}`
            D3Anchor.#count++
        }

        if (this.props.divId == "div") {
            this.divId = `${this.props.divId}${D3Anchor.#count}`
            this.props.divId = `${this.props.divId}${D3Anchor.#count}`
            D3Anchor.#count++
        }

        this.props = props
    }

    onAdd(context) {
        const el = document.createElement('div');
        el.id = this.divId
        el.className = 'd3anchor';
        // el.style.width = `${this.size}px`;
        // TODO - create animation for .spinner in the CSS stylesheet
        this.element = el;
        return el;
    }

    onRemove() {
        this.element = undefined;
    }

    // update props
    // may add actions to this afterwards idk
    setProps(props) {
        this.props = Object.assign(this.props, props)
    }

    onViewportChange(viewport){

    }
    onRedraw(params) {
        // const isVisible = params.layers.some(layer => !layer.isLoaded);
        // this.element.style.display = isVisible ? 'block' : 'none';
    }
    onHover(info, event) {
        this.props.onHover(info, event)
    }
    onClick(info, event) {
        this.props.onClick(info, event)
    }
    onDragStart(info, event) {
        this.props.onDragStart(info, event)
    }
    onDrag(info, event) {
        this.props.onDrag(info, event)
    }
    onDragEnd(info, event) {
        this.props.onDragEnd(info, event)
    }
}
