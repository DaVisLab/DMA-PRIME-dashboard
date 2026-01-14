export async function getOutbreakDataBySpatialResoultionIn(
  mapSpatialResoultion
) {
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

export function categorizeStringOrNumber(data) {
  const field = [];
  if (!data || data.length === 0) return field;

  const columns = Object.keys(data[0]);

  for (const col of columns) {
    const values = data
      .map((d) => d[col])
      .filter((v) => v !== null && v !== undefined);

    if (values.length === 0) {
      field.push({
        name: col,
        type: "string",
      });
      continue;
    }

    const isNumber = values.every(
      (v) => typeof v === "number" && !Number.isNaN(v)
    );

    field.push({
      name: col,
      type: isNumber ? "number" : "string",
    });
  }

  return field;
}

function toUTCDate(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) throw new Error("Invalid date: " + d);
  return new Date(
    Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())
  );
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function startOfWeekUTC(d, weekStart = 1) {
  const day = d.getUTCDay(); // 0=Sun ... 6=Sat
  const delta = (day - weekStart + 7) % 7;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - delta)
  );
}

// ---------- Yearly ----------
function inferYearly({ t2, values }) {
  const end = toUTCDate(t2);
  const endYear = end.getUTCFullYear();

  return values.map((v, i) => {
    const year = endYear - (values.length - 1 - i);
    return String(year);
  });
}

// ---------- Monthly ----------
function inferMonthly({ t2, values }) {
  const end = toUTCDate(t2);
  let y = end.getUTCFullYear();
  let m = end.getUTCMonth(); // 0-based

  // go back (n-1) months
  m -= values.length - 1;
  while (m < 0) {
    m += 12;
    y -= 1;
  }

  return values.map((v, i) => {
    const year = y + Math.floor((m + i) / 12);
    const month = (m + i) % 12;

    return `${year}-${pad(month + 1)}`;
  });
}

// ---------- Weekly (full date needed) ----------
function inferWeekly({ t2, values, weekStart = 1 }) {
  const end = startOfWeekUTC(toUTCDate(t2), weekStart);

  return values.map((v, i) => {
    const d = new Date(
      Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        end.getUTCDate() - 7 * (values.length - 1 - i)
      )
    );

    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  });
}

// ---------- Wrapper ----------
export function inferAllDates({
  t2,
  yearlyValues,
  monthlyValues,
  weeklyValues,
}) {
  const out = {};
  if (yearlyValues) out.yearly = inferYearly({ t2, values: yearlyValues });
  if (monthlyValues) out.monthly = inferMonthly({ t2, values: monthlyValues });
  if (weeklyValues) out.weekly = inferWeekly({ t2, values: weeklyValues });
  return out;
}
