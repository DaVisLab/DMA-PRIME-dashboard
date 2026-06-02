import { DATA_LEVELS } from "./DataRepository.js";

export const HIERARCHY_MODE_IDS = Object.freeze({
  SC_REGION_COUNTY_ZCTA: "sc-region-county-zcta",
  STATE_COUNTY_ZCTA: "state-county-zcta",
  REGION_STATE_COUNTY: "region-state-county",
  DIVISION_STATE_COUNTY: "division-state-county",
});

export const DEFAULT_HIERARCHY_MODE_ID =
  HIERARCHY_MODE_IDS.SC_REGION_COUNTY_ZCTA;

export const HIERARCHY_MODES = [
  {
    id: HIERARCHY_MODE_IDS.SC_REGION_COUNTY_ZCTA,
    label: "south carolina region - county - zcta",
    parentIdKey: "region",
    root: {
      dataLevel: DATA_LEVELS.REGION,
      displayLevel: DATA_LEVELS.REGION,
      geoResolution: "REGION",
      geoID: "SC_REGIONS",
      geoLabel: "South Carolina regions",
      preprocessResolution: "REGION",
      scopeId: "sc",
      scopeLabel: "South Carolina",
      scopeLevel: "state",
    },
    multiMaps: [],
    parentGeojsonUrl: null,
  },
];

export function getHierarchyModeById(modeId = DEFAULT_HIERARCHY_MODE_ID) {
  return (
    HIERARCHY_MODES.find((mode) => mode.id === modeId) ??
    HIERARCHY_MODES.find((mode) => mode.id === DEFAULT_HIERARCHY_MODE_ID) ??
    HIERARCHY_MODES[0]
  );
}
