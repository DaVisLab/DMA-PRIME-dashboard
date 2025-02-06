function parseDate(datestring) {
    return dayjs.tz(datestring, "YYYY-MM-DD", "America/New_York").toDate()
}
