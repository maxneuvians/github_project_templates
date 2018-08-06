require("isomorphic-fetch");

const functions = require("firebase-functions");
const octokit = require("@octokit/rest")();

const key =
  process.env.GITHUB_PUBLIC_ACCESS_TOKEN || functions.config().github.key;

octokit.authenticate({
  type: "token",
  token: key
});

function assignOpenIssues(config, repo, project, newIssues) {
  return new Promise((resolve, reject) => {
    if (config.assign_open_issues && config.assign_open_issues === true) {
      const q = "is:open no:milestone no:project repo:" + repo.full_name;
      octokit.search.issues({ q: q }).then(issueResult => {
        octokit.projects
          .getProjectColumns({ project_id: project.id })
          .then(columnResult => {
            return columnResult.data[0].id;
          })
          .then(columnId => {
            let mergedIssues = newIssues.concat(issueResult.data.items);
            let promises = mergedIssues.map(issue => {
              return octokit.projects.createProjectCard({
                column_id: columnId,
                content_id: issue.id,
                content_type: "Issue"
              });
            });
            Promise.all(promises).then(() => resolve(config));
          });
      });
    } else {
      return resolve(config);
    }
  });
}

function duplicateIssues(config, repo) {
  return new Promise((resolve, reject) => {
    if (config.duplicate_issues && config.duplicate_issues.length > 0) {
      let promises = config.duplicate_issues.map(issueNumber => {
        return octokit.issues
          .get({
            owner: repo.owner.login,
            repo: repo.name,
            number: issueNumber
          })
          .then(result => {
            console.log(result);
            oldIssue = result.data;
            const issue = {
              owner: repo.owner.login,
              repo: repo.name,
              title: oldIssue.title,
              body: oldIssue.body,
              labels: oldIssue.labels
            };
            return octokit.issues.create(issue).then(resp => resp.data);
          });
      });
      Promise.all(promises).then(resp => {
        return resolve([config, resp]);
      });
    } else {
      return resolve([config, []]);
    }
  });
}

exports.hook = functions.https.onRequest((request, response) => {
  if (
    !request.body ||
    !request.body.hasOwnProperty("action") ||
    !request.body.hasOwnProperty("repository") ||
    !request.body.hasOwnProperty("project")
  ) {
    response.status(400);
    return response;
  }

  const action = request.body.action;
  const repo = request.body.repository;
  const project = request.body.project;

  const url =
    "https://raw.githubusercontent.com/" +
    repo.full_name +
    "/master/github_project_template.json";

  return fetch(url)
    .then(r => r.json())
    .then(config => duplicateIssues(config, repo))
    .then(([config, newIssues]) =>
      assignOpenIssues(config, repo, project, newIssues)
    )
    .then(() => response.status(200))
    .catch(err => {
      console.log("Error", err);
      return response.status(400);
    });
});
