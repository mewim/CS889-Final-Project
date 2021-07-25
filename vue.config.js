const configureAPI = require("./src/server/Configure");

module.exports = {
  devServer: {
    host: "0.0.0.0",
    before: configureAPI,
    disableHostCheck: true,
  },
};
