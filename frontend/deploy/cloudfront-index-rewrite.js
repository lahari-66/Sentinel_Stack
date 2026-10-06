// CloudFront Function (runtime cloudfront-js-2.0), attached to the distribution's default behavior as a
// "Viewer request" function. The static export writes /findings/index.html, but S3 behind Origin Access
// Control does not resolve directory indexes, so /findings/ or /findings would return AccessDenied.
// This maps both to /findings/index.html. Requests for real files (anything with a dot) pass through.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith("/")) {
    request.uri += "index.html";
  } else if (!uri.includes(".")) {
    request.uri += "/index.html";
  }
  return request;
}
