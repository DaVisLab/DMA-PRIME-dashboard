import  {getOutbreakDataBySpatialResoultionIn} from "../utils.js"
import { drawTableView } from "../tableView.js";

export const data = {}

async function getOutbreakData() {
    data.regionData = await getOutbreakDataBySpatialResoultionIn("region");
    console.log(data.regionData)
    drawTableView(data.regionData.features, "table-view-container-aiPage");
}

getOutbreakData();