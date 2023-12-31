const { readFile } = require("fs/promises");

exports.getApis = (req, res, next) => {
  return readFile(`${__dirname}/../endpoints.json`, "UTF-8")
    .then((result) => {
      res.status(200).send({ endpoints: JSON.parse(result) });
    })
    .catch((err) => {
      next(err);
    });
};
