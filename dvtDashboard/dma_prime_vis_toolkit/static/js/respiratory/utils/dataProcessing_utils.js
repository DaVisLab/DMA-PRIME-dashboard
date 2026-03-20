export async function call_data(geoSelected, diseaseSelected, data_version) {
  return await d3.json(
    `/data/respiratory/${geoSelected}/${
      diseaseSelected
    }?data_version=${data_version}&${parseInt(Math.random() * 9999999999)}`,
  );
}

export function facility_dataProcessing(features, facility_unit) {
  switch (facility_unit) {
    case "individual-unit":
      features = features.filter(
        (item) =>
          item.properties.id != "MUSC" && item.properties.id != "PRISMA",
      );
      break;
    case "prisma":
      features = features.filter((item) => item.properties.id == "PRISMA");
      break;
    case "musc":
      features = features.filter((item) => item.properties.id == "MUSC");
      break;
  }
  return features;
}
