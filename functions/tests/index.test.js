const functions = require("../index");

require("isomorphic-fetch");
const octokit = require("@octokit/rest")();
jest.mock("@octokit/rest");

// Mock Fetch
fetch = jest.fn(url => {
  let resp;
  switch (true) {
    case url.includes("bad/no_json"):
      resp = "";
      break;
    case url.includes("good/empty_json"):
      resp = {
        json: () => {
          return {};
        }
      };
      break;
    case url.includes("duplicate_issues"):
      resp = {
        json: () => {
          return { duplicate_issues: [1, 2, 3] };
        }
      };
      break;
    default:
      resp = null;
  }
  return new Promise(resolve => resolve(resp));
});

let validRequest;

describe("it handles bad requests by returning a 400 code", () => {
  test("returns a 400 if the body is missing", done => {
    const mockResponse = {
      status: code => {
        expect(code).toEqual(400);
        done();
      }
    };
    functions.hook({}, mockResponse);
  });

  test("returns a 400 if the action is missing in the body", done => {
    const mockResponse = {
      status: code => {
        expect(code).toEqual(400);
        done();
      }
    };
    functions.hook(
      { body: { repository: "foo", project: "foo" } },
      mockResponse
    );
  });

  test("returns a 400 if the repository is missing in the body", done => {
    const mockResponse = {
      status: code => {
        expect(code).toEqual(400);
        done();
      }
    };
    functions.hook({ body: { action: "foo", project: "foo" } }, mockResponse);
  });

  test("returns a 400 if the project is missing in the body", done => {
    const mockResponse = {
      status: code => {
        expect(code).toEqual(400);
        done();
      }
    };
    functions.hook(
      { body: { repository: "foo", action: "foo" } },
      mockResponse
    );
  });
});

describe("it loads a config file from the master branch of the passed repistory", () => {
  beforeEach(() => {
    validRequest = {
      body: {
        action: "open",
        repository: { full_name: "foo/bar" },
        project: { project_id: 1 }
      }
    };
  });

  test("returns a 400 if no valid json could be found", done => {
    validRequest.body.repository.full_name = "bad/no_json";
    const mockResponse = {
      status: code => {
        expect(code).toEqual(400);
        done();
      }
    };
    functions.hook(validRequest, mockResponse);
  });

  test("returns a 200 if valid json could be found", done => {
    validRequest.body.repository.full_name = "good/empty_json";
    const mockResponse = {
      status: code => {
        expect(code).toEqual(200);
        done();
      }
    };
    functions.hook(validRequest, mockResponse);
  });
});

describe("duplicate_issues setting", () => {
  beforeEach(() => {
    validRequest = {
      body: {
        action: "open",
        repository: { full_name: "duplicate_issues", owner: { login: "foo" } },
        project: { project_id: 1 }
      }
    };
  });

  test("queries the list of passed issues and retrieves them from github", done => {
    octokit.issues.get.mockResolvedValue({});
    const mockResponse = {
      status: () => {}
    };
    functions.hook(validRequest, mockResponse);
    expect(octokit.issues.get.mock.calls.length).toBe(1);
  });
});
