export function shouldRequireApiKey() {
  return process.env.IRIS_REQUIRE_API_KEY === "true" && Boolean(process.env.IRIS_API_KEY);
}

export function isAuthorizedRequest(req) {
  if (!shouldRequireApiKey()) {
    return true;
  }

  return req.headers.authorization === `Bearer ${process.env.IRIS_API_KEY}`;
}
