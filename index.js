"use strict";
/* node packages */
const fs = require("fs");
var getDirName = require("path").dirname;
var mkdirp = require("mkdirp");

/* third party packages */
const Hapi = require("@hapi/hapi");
const Joi = require("Joi");
const boom = require("boom");

/* Models */
const ApplicationModel = require("./models/Application");

/* helper Fns */
const checkForPastApplications = require("./helpers").checkForPastApplications;
const getApplicants = require("./helpers").getApplicants;

// server configuration fn
const init = async () => {
  const dbOpts = {
    url: process.env.MONGODB_URI,
    settings: {
      poolSize: 10
    },
    decorate: true
  };

  // process.argv[2] should be PORT variable, but specify 3210 if not
  const server = Hapi.server({
    host: "localhost",
    port: process.argv[2] || 3210
  });

  console.log("process arg v => ", process.argv);

  //Initialize hapi / mongodb plugin
  await server.register({
    plugin: require("hapi-mongodb"),
    options: dbOpts
  });

  /**
   * Route posting an application form.
   * @name post/applications
   * @requestParam {string} college - applicant's college
   * @requestParam {string} name - applicant's name
   * @requestParam {number} score - applicant's score
   */
  server.route({
    method: "POST",
    path: "/applications",
    options: {
      validate: {
        payload: {
          college: Joi.string()
            .min(3)
            .max(50)
            .required(),
          name: Joi.string()
            .min(1)
            .required(),
          score: Joi.number()
            .min(0)
            .max(100)
            .required()
        },
        failAction: (request, h, error) => {
          return error.isJoi
            ? h
                .response(error.details[0])
                .takeover()
                .code(400)
            : h.response(error).takeover();
        }
      }
    },
    handler: async (request, h) => {
      try {
        const db = request.mongo.db;
        const applicationCollection = db.collection("college-applications");

        // check if the applicant has applied before by pulling all reecords with their name
        // then, see if any of those apps had the same college as the one in request.payload.
        const validCollegeApp = await checkForPastApplications(
          applicationCollection,
          request,
          h
        );
        if (!validCollegeApp) {
          return h
            .response({
              error: "bad request",
              message:
                "Application already submitted for this college/name pair"
            })
            .code(400);
        }

        // if applicant has not applied to college before, create
        // an application object
        var application = new ApplicationModel(request.payload);
        var result = await applicationCollection.insertOne(application);

        return h.response("Application submitted successfully").code(200);
      } catch (error) {
        console.error(
          "there was an error when trying to create an application: ",
          error
        );
        return h.response(error).code(500);
      }
    }
  });

  /**
   * Route serving all processed applications
   * @name get/applicants
   */
  server.route({
    method: "GET",
    path: "/applicants",
    handler: async (request, h) => {
      try {
        const db = request.mongo.db;
        const applicationCollection = db.collection("college-applications");
        const applicants = await getApplicants(applicationCollection, "all");

        return h.response(applicants).code(200);
      } catch (error) {
        console.error("error getting applicants: ", error);
        return h.response(error).code(500);
      }
    }
  });

  /**
   * Route serving a specific user's applications
   * @param {string} name - applicant's name
   */
  server.route({
    method: "GET",
    path: "/applicants/{name}",
    handler: async (request, h) => {
      try {
        const db = request.mongo.db;
        const applicationCollection = db.collection("college-applications");
        const applicants = await getApplicants(
          applicationCollection,
          "applicant",
          request.params
        );
        if (!applicants) {
          return h
            .response({
              error: "not found",
              message: "No applications exist for that name"
            })
            .code(404);
        }
        return h.response(applicants).code(200);
      } catch (error) {
        console.error(
          "error getting applications for specific applicant: ",
          error
        );
        return h.response(error).code(500);
      }
    }
  });

  /**
   * Route serving all applications sorted by college
   */
  server.route({
    method: "GET",
    path: "/colleges",
    handler: async (request, h) => {
      try {
        const db = request.mongo.db;
        const applicationCollection = db.collection("college-applications");
        const colleges = await getApplicants(applicationCollection, "colleges");

        return h.response(colleges).code(200);
      } catch (error) {
        console.error("error getting college applicants: ", error);
        return h.response(error).code(500);
      }
    }
  });

  /**
   * Route serving a specific college's applications
   * @param {string} college - applicant's name
   */
  server.route({
    method: "GET",
    path: "/colleges/{name}",
    handler: async (request, h) => {
      try {
        const db = request.mongo.db;
        const applicationCollection = db.collection("college-applications");
        const applicants = await getApplicants(
          applicationCollection,
          "college",
          request.params
        );
        if (!applicants) {
          return h
            .response({
              error: "not found",
              message: "No applications exist for that college"
            })
            .code(404);
        }
        return h.response(applicants).code(200);
      } catch (error) {
        console.error(
          "error getting applications for specific college: ",
          error
        );
        return h.response(error).code(500);
      }
    }
  });

  /**
   * Route that create's a json backup file in root of project
   * @name post/backup
   * @requestParam none
   */
  server.route({
    method: "POST",
    path: "/backup",
    options: {},
    handler: async (request, h) => {
      try {
        const db = request.mongo.db;
        const applicationCollection = db.collection("college-applications");
        const colleges = await getApplicants(applicationCollection, "colleges");
        console.log("TCL: init -> colleges", colleges);

        writeFile("backup/backup.json", colleges, console.log);

        return h.response("Backup successful").code(200);
      } catch (error) {
        console.error(
          "there was an error when trying to backup the database: ",
          error
        );
        return h.response(error).code(500);
      }
    }
  });

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", err => {
  console.error(err);
  process.exit(1);
});

/** fn to write backup file */

async function writeFile(path, contents, cb) {
  console.log("mkdirp -> ", mkdirp);
  mkdirp(getDirName(path), function(err) {
    if (err) return cb(err);

    fs.writeFileSync(path, JSON.stringify(contents, null, 4));
  });
}

// run server configuration fn
init();
