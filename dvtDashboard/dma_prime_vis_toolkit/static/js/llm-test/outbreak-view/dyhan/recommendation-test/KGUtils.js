const RegionStore = {
  countyToRegion: null,
  zipToCounty: null,
};

async function loadRegionData() {
  const [res1, res2] = await Promise.all([
    fetch("/static/assets/GeoJSON/SC_county_to_region.json"),
    fetch("/static/assets/GeoJSON/SC_zip_to_county.json"),
  ]);

  RegionStore.countyToRegion = await res1.json();
  RegionStore.zipToCounty = await res2.json();
}

loadRegionData();

function removeViewPrefix(id) {
  let curID;

  if (id.includes("small-multiple")) {
    curID = id.split("small-multiple-")[1];
  }

  if (id.includes("map-path")) {
    curID = id.split("map-path-")[1];
  }

  if (id.includes("node")) {
    curID = id.split("node-")[1];
  }

  return curID;
}

export function returnKGVerifiedId(nodeID) {
  if (nodeID.includes("node")) return nodeID.split("node-")[1];

  return nodeID;
}

export function getNodeID(id) {
  const idWithoutViewPrefix = removeViewPrefix(id) || id;

  const curGeographicUnit = document.getElementById(
    "map-region-selector",
  ).value;

  let nodeIDPrefix = "state_sc";

  // console.log(id);
  // console.log(RegionStore);
  // console.log(idWithoutViewPrefix);
  if (curGeographicUnit === "region") {
    return `node-${nodeIDPrefix}-region_${idWithoutViewPrefix}`;
  } else if (curGeographicUnit === "county") {
    const regionInfo = RegionStore.countyToRegion[idWithoutViewPrefix].replace(
      " ",
      "_",
    );
    nodeIDPrefix += `-region_${regionInfo}`;
    return `node-${nodeIDPrefix}-county_${idWithoutViewPrefix}`;
  } else if (curGeographicUnit === "zcta") {
    const countyInfo = RegionStore.zipToCounty[idWithoutViewPrefix];
    const regionInfo = RegionStore.countyToRegion[countyInfo];

    nodeIDPrefix += `-region_${regionInfo.replace(" ", "_")}`;
    nodeIDPrefix += `-county_${countyInfo.replace(" ", "_")}`;
    return `node-${nodeIDPrefix}-zip_${idWithoutViewPrefix}`;
  }
  //   map-region-selector

  return `node-${nodeIDPrefix}_${idWithoutViewPrefix}`;
}
