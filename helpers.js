const _ = require("lodash");

/**
 * Helper fn to check if a user has previously submitted an application to a college
 * @param {*} applicationCollection
 * @param {*} request
 * @param {*} h
 */
async function checkForPastApplications(applicationCollection, request, h) {
  var cursor = await applicationCollection.find({
    name: request.payload.name
  });
  var previousApplications = await cursor.toArray();
  if (
    previousApplications.length &&
    _.findIndex(previousApplications, app => {
      return app.college === request.payload.college;
    }) !== -1
  ) {
    return false;
  } else {
    return true;
  }
}

/**
 * helper fn to get all exisiting applications from mongo db collection
 * @param {*} applicationCollection
 */
async function getAllApplications(applicationCollection) {
  const cursor = await applicationCollection.find();
  let arr = await cursor.toArray();
  return arr;
}

/**
 *  Helper fn to get applicants based on the type parameter passed into this fn
 * @param {*} applicationCollection
 * @param {*} type
 * @param {*} requestParams
 */
async function getApplicants(applicationCollection, type, requestParams) {
  if (type === "all") {
    let applications = await getAllApplications(applicationCollection);
    let applicationsByApplicant = await formatAllApplications(applications);
    return applicationsByApplicant;
  } else if (type === "applicant") {
    let applications = await getApplicationsByApplicant(
      applicationCollection,
      requestParams
    );
    if (!applications.length) {
      return false;
    }
    let applicationsByApplicant = await formatApplicantApplications(
      applications
    );
    return applicationsByApplicant;
  } else if (type === "colleges") {
    let applications = await getAllApplications(applicationCollection);
    let collegesByApplicant = await formatAllApplicationsByCollege(
      applications
    );
    return collegesByApplicant;
  } else if (type === "college") {
    let applications = await getApplicationsByCollege(
      applicationCollection,
      requestParams
    );
    if (!applications.length) {
      return false;
    }
    let collegeApplicants = await formatApplicationsByCollege(applications);
    return collegeApplicants;
  }
}

/**
 * Helper fn to get applications by applicant
 * @param {*} applicationCollection
 * @param {*} requestParams
 */
async function getApplicationsByApplicant(
  applicationCollection,
  requestParams
) {
  const cursor = await applicationCollection.find({ name: requestParams.name });
  let arr = await cursor.toArray();
  return arr;
}

/**
 * Helper fn to get applications by college
 * @param {*} applicationCollection
 * @param {*} requestParams
 */
async function getApplicationsByCollege(applicationCollection, requestParams) {
  const cursor = await applicationCollection.find({
    college: requestParams.name
  });
  let arr = await cursor.toArray();
  return arr;
}

/**
 * Helper fn to format the response for the get all applications endpoint
 * @param {*} arr
 */
async function formatAllApplications(arr) {
  const applications = {};
  const applicantNames = _.chain(arr)
    .map("name")
    .uniq()
    .value();
  applicantNames.map(name => (applications[name] = []));
  _.each(applicantNames, function(name) {
    let userApps = [];
    const apps = _.chain(arr)
      .filter(app => app.name === name)
      .orderBy(["score"], ["desc"])
      .value();
    _.each(apps, function(app) {
      const res = _.pick(app, ["college", "score"]);
      userApps.push(res);
    });
    applications[name] = userApps;
  });
  return applications;
}

/**
 * Helper fn to format the response for a specific applicant's applications
 * @param {*} arr
 */
async function formatApplicantApplications(arr) {
  const applications = {};

  const applicantName = arr[0].name;

  (applications.name = applicantName), (applications.applications = []);

  _.each(arr, function(app) {
    const res = _.pick(app, ["college", "score"]);
    applications.applications.push(res);
  });

  applications.applications = await _.orderBy(
    applications.applications,
    ["score"],
    ["desc"]
  );
  return applications;
}

/**
 * Helper fn to format the response for all applications by college
 * @param {*} arr
 */
async function formatAllApplicationsByCollege(arr) {
  const applications = {};

  const collegeNames = _.chain(arr)
    .map("college")
    .uniq()
    .value();
  collegeNames.map(college => (applications[college] = []));
  _.each(collegeNames, function(college) {
    let collegeApps = [];
    const apps = _.chain(arr)
      .filter(app => app.college === college)
      .orderBy(["score"], ["desc"])
      .value();
    _.each(apps, function(app) {
      const res = _.pick(app, ["name", "score"]);
      collegeApps.push(res);
    });
    applications[college] = collegeApps;
  });
  return applications;
}

/**
 * Helper fn to format the response for all applications to a specific college
 * @param {*} arr
 */
async function formatApplicationsByCollege(arr) {
  const applications = {};

  const college = arr[0].college;

  (applications.college = college), (applications.applications = []);

  _.each(arr, function(app) {
    const res = _.pick(app, ["name", "score"]);
    applications.applications.push(res);
  });

  applications.applications = await _.orderBy(
    applications.applications,
    ["score"],
    ["desc"]
  );
  return applications;
}

module.exports = {
  checkForPastApplications,
  getApplicants
};
