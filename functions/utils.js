const fs = require("fs");
const fileName = "refreshToken.txt";

function existsRefreshTokenFile() {
  return new Promise((resolve, reject) => {
    fs.exists(fileName, (exists) => resolve(exists));
  });
}

function readRefreshToken() {
  return new Promise((resolve, reject) => {
    fs.readFile(fileName, "utf8", (err, token) => {
      if (err) console.log(err);
      resolve(token);
    });
  });
}

function saveRefreshTokenAsFile(token) {
  const data = token;
  fs.writeFile("refreshToken.txt", data, "utf8", (err) => {
    if (err);
  });
}

module.exports = {
  existsRefreshTokenFile,
  saveRefreshTokenAsFile,
  readRefreshToken,
};
