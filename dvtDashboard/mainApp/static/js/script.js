// Takes a feature object and gets county/zip code, can be extended later if need be
function getSignifier(d){
    if("NAME" in d.properties)
        return d.properties.NAME.toLowerCase()
    else if("ZCTA5CE20" in d.properties)
        return +d.properties.ZCTA5CE20
    else throw("no signifier")
}