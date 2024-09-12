d3.json('../../static/data/covid-19_zcta_hospitalization_data.json')
    .then(function(data) {console.log(data)})



date = new Date(2024, 7, 26)
date = d3.timeMonday.floor(date)

startDate = new Date(date);
startDate.setMonth(startDate.getMonth() - 18);

historicalDates = d3.timeMonday.range(startDate, new Date(date).setDate(date.getDate()+1), 1)
console.log(historicalDates)
if (historicalDates.at(-1) < date) {
    historicalDates.push(date)
}

endDate = new Date(date);
endDate.setDate(endDate.getDate() + 5*7);

predictionDates = d3.timeMonday.range(date, new Date(endDate).setDate(endDate.getDate()+1), 1)
if (predictionDates.at(-1) < endDate) {
    predictionDates.push(endDate)
}

console.log(date, startDate, endDate)
console.log(d3.timeMonday.floor(date), d3.timeMonday.floor(startDate), d3.timeMonday.floor(endDate))
console.log(predictionDates)

