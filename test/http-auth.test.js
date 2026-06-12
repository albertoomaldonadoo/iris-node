import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isAuthorizedRequest, shouldRequireApiKey } from "../lib/interfaces/http-auth.js";

const originalApiKey = process.env.IRIS_API_KEY;
const originalRequireApiKey = process.env.IRIS_REQUIRE_API_KEY;

afterEach(() => {
  process.env.IRIS_API_KEY = originalApiKey;
  process.env.IRIS_REQUIRE_API_KEY = originalRequireApiKey;
});

describe("http auth policy", () => {
  it("keeps public chat access by default for web clients", () => {
    process.env.IRIS_API_KEY = "secret";
    delete process.env.IRIS_REQUIRE_API_KEY;

    assert.equal(shouldRequireApiKey(), false);
    assert.equal(isAuthorizedRequest({ headers: {} }), true);
  });

  it("requires bearer token only when strict auth is enabled", () => {
    process.env.IRIS_API_KEY = "secret";
    process.env.IRIS_REQUIRE_API_KEY = "true";

    assert.equal(shouldRequireApiKey(), true);
    assert.equal(isAuthorizedRequest({ headers: {} }), false);
    assert.equal(isAuthorizedRequest({ headers: { authorization: "Bearer secret" } }), true);
  });
});
