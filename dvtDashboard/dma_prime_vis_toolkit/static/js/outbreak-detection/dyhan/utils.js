
export async function getOutbreakDataBySpatialResoultionIn(mapSpatialResoultion) {
  const mapOutcomeVariableSelector = document.getElementById(
    "map-outcome-variable-selector"
  );
  await customElements.whenDefined("sl-select");
  await mapOutcomeVariableSelector.updateComplete;

  const data = await d3.json(
    `/data/outbreak-detection/${mapSpatialResoultion}/${
      mapOutcomeVariableSelector.value
    }?data_version=${metadata.data_version}&${parseInt(
      Math.random() * 9999999999
    )}`
  );

  // remove Point geometries
  data.features = data.features.filter(
    (item) => item.geometry.type !== "Point"
  );

  // set id and name fields
  data.features.forEach((item) => {
    if (mapSpatialResoultion == "state") {
    } else if (mapSpatialResoultion == "region") {
      item.nameID = item.properties.Region.toLowerCase().replace(" ", "_");
      item.properties.id = item.properties.Region.toLowerCase().replace(
        " ",
        "_"
      );
      item.name = item.properties.Region;
    } else if (mapSpatialResoultion == "county") {
      item.nameID = item.properties.NAME.toLowerCase().replace(" ", "_");
      item.properties.id = item.properties.NAME.toLowerCase().replace(" ", "_");
      item.name = item.properties.NAME;
      item.countyName = item.properties.NAME;
    } else if (mapSpatialResoultion == "zcta") {
      item.nameID = item.properties.ZCTA.toLowerCase().replace(" ", "_");
      item.properties.id = item.properties.ZCTA.toLowerCase().replace(" ", "_");
      item.name = item.properties.ZCTA;
      item.zipName = item.properties.ZCTA;
      item.countyName = item.properties.county;
    }
  });

  return data;
}