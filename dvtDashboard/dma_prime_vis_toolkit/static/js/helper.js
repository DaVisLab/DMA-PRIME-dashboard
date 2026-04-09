export function toIdFriendly(str) {
  return str.replace(/\s+/g, "-");
}

export function getDateWithOffset(date, offset) {
  return dayjs(date).add(offset, "week").format("YYYY-MM-DD");
}