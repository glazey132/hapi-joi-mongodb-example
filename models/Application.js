const Mongoose = require("mongoose");

const ApplicationModel = Mongoose.model("application", {
  college: String,
  name: String,
  score: Number
});

module.exports = ApplicationModel;
