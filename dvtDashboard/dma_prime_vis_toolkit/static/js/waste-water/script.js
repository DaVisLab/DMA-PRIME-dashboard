function parseDate(datestring) {
    return dayjs(datestring, "YYYY-MM-DD").toDate()
}

function stringToHtmlId(str) {
  // Replace non-alphanumeric characters (except hyphens and underscores) with a hyphen
  let id = str.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');

  // Trim leading and trailing hyphens
  id = id.replace(/^-+|-+$/g, '');

  // Ensure the ID doesn't start with a number (prefix with a letter if needed)
  if (/^[0-9]/.test(id)) {
    id = 'id-' + id;
  }
  
  return id;
}