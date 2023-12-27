const database = require("../database/connection");
const {
  checkLeagueExists,
  checkUserExists,
  checkPokemonExists,
  checkLeaguePokemonExists,
} = require("./model.utils");

exports.fetchLeagues = (
  sort_by = "created_at",
  order = "DESC",
  league_name,
  owner,
  limit = 10,
  page = 1
) => {
  const validSortBys = { created_at: "created_at", league_name: "league_name" };

  if (!validSortBys[sort_by]) {
    return Promise.reject({ status: 400, message: "Invalid sort_by" });
  }

  if (order.toUpperCase() !== "DESC" && order.toUpperCase() !== "ASC") {
    return Promise.reject({ status: 400, message: "Invalid order" });
  }

  if (limit % 1 !== 0 || page % 1 !== 0 || limit < 1 || page < 1) {
    return Promise.reject({
      status: 400,
      message: "Invalid limit and/or page",
    });
  }

  let query = `SELECT * FROM leagues `;

  const queryValues = [];
  let count = 0;
  if (league_name) {
    queryValues.push(league_name);
    query += `WHERE league_name = ? `;
    count++;
  }

  if (owner) {
    queryValues.push(owner);
    if (count === 0) query += `WHERE owner = ? `;
    else query += `AND owner = ? `;
  }

  query += `ORDER BY ${validSortBys[sort_by]} ${order} `;

  const totalQuery = database.query(query, queryValues).then((result) => {
    return result[0].length;
  });

  query += `LIMIT ${limit} OFFSET ${(page - 1) * limit};`;

  const leaguesQuery = database.query(query, queryValues).then((result) => {
    return result[0];
  });

  return Promise.all([totalQuery, leaguesQuery]).then(([total, leagues]) => {
    return { total, leagues };
  });
};

exports.fetchLeagueByLeagueId = (league_id) => {
  const doesLeagueExist = checkLeagueExists(league_id);

  const query = database.query(`SELECT * FROM leagues WHERE league_id=?`, [
    league_id,
  ]);

  return Promise.all([query, doesLeagueExist]).then((results) => {
    return results[0][0][0];
  });
};

exports.fetchLeaguePokemonByLeagueId = (
  league_id,
  sort_by = "pokedex_no",
  order = "ASC",
  pokedex_no,
  type,
  type2,
  ability,
  tier,
  limit = 10,
  page = 1
) => {
  const validSortBys = {
    pokemon_name: "pokemon_name",
    pokedex_no: "pokedex_no",
    speed_stat: "speed_stat",
  };

  if (!validSortBys[sort_by]) {
    return Promise.reject({ status: 400, message: "Invalid sort_by" });
  }

  if (order.toUpperCase() !== "DESC" && order.toUpperCase() !== "ASC") {
    return Promise.reject({ status: 400, message: "Invalid order" });
  }

  if (limit % 1 !== 0 || page % 1 !== 0 || limit < 1 || page < 1) {
    return Promise.reject({
      status: 400,
      message: "Invalid limit and/or page",
    });
  }

  let query = `SELECT leagues_pokemon.tier, leagues_pokemon.is_picked, pokemon.pokemon_name, pokemon.pokedex_no, pokemon.speed_stat, pokemon.type_1, pokemon.type_2, pokemon.ability_1, pokemon.ability_2, pokemon.ability_3 FROM leagues_pokemon JOIN pokemon ON leagues_pokemon.pokemon = pokemon.pokemon_name WHERE league = ? `;

  const queryValues = [league_id];
  if (pokedex_no) {
    queryValues.push(pokedex_no);
    query += `AND pokedex_no = ? `;
  }

  if (type) {
    queryValues.push(type);
    queryValues.push(type);
    query += `AND (type_1 = ? OR type_2 = ?) `;
  }

  if (type2) {
    queryValues.push(type2);
    queryValues.push(type2);
    query += `AND (type_1 = ? OR type_2 = ?) `;
  }

  if (ability) {
    queryValues.push(ability);
    queryValues.push(ability);
    queryValues.push(ability);
    query += `AND (ability_1 = ? OR ability_2 = ? OR ability_3 = ?) `;
  }

  if (tier) {
    queryValues.push(tier);
    query += `AND tier = ? `;
  }

  query += `ORDER BY ${validSortBys[sort_by]} ${order} `;

  const totalQuery = database.query(query, queryValues).then((result) => {
    return result[0].length;
  });

  query += `LIMIT ${limit} OFFSET ${(page - 1) * limit};`;

  const leaguePokemonQuery = database
    .query(query, queryValues)
    .then((result) => {
      return result[0];
    });

  const doesLeagueExist = checkLeagueExists(league_id);

  return Promise.all([totalQuery, leaguePokemonQuery, doesLeagueExist]).then(
    ([total, pokemon]) => {
      return { total, pokemon };
    }
  );
};

exports.createLeague = (league_name, owner) => {
  const doesUserExist = checkUserExists(owner);

  const query = database.query(
    `INSERT INTO leagues (league_name, owner) VALUES (?, ?);`,
    [league_name, owner]
  );

  return Promise.all([doesUserExist, query])
    .then(() => {
      return database.query(
        `SELECT * FROM leagues WHERE league_id = LAST_INSERT_ID();`
      );
    })
    .then((result) => {
      return result[0][0];
    });
};

exports.createLeaguePokemon = (league_id, pokemon_name) => {
  return checkPokemonExists(pokemon_name)
    .then(() => {
      return checkLeaguePokemonExists(league_id, pokemon_name);
    })
    .then(() => {
      return database.query(
        `INSERT INTO leagues_pokemon (league, pokemon) VALUES (?, ?);`,
        [league_id, pokemon_name]
      );
    })
    .then(() => {
      return database.query(
        `SELECT * FROM leagues_pokemon WHERE leagues_pokemon_id = LAST_INSERT_ID()`
      );
    })
    .then((result) => {
      return result[0][0];
    });
};

exports.updateLeagueByLeagueId = (league_id, league_name, owner, notes) => {
  const doesLeagueExist = checkLeagueExists(league_id);

  if (!league_name && !owner && !notes) {
    return Promise.reject({
      status: 400,
      message: "At least one field must be selected for update",
    });
  }

  let query = `UPDATE leagues SET`;
  const queryValues = [];
  let count = 0;

  if (league_name) {
    queryValues.push(league_name);
    query += ` league_name = ?`;
    count++;
  }

  let doesUserExist;
  if (owner) {
    doesUserExist = checkUserExists(owner);
    queryValues.push(owner);
    if (count === 0) query += ` owner = ?`;
    else query += `, owner = ?`;
    count++;
  }

  if (notes) {
    queryValues.push(notes);
    if (count === 0) query += ` notes = ?`;
    else query += `, notes = ?`;
  }

  query += ` WHERE league_id = ?;`;
  queryValues.push(league_id);

  const finalQuery = database.query(query, queryValues);

  return Promise.all([finalQuery, doesUserExist, doesLeagueExist])
    .then(() => {
      return this.fetchLeagueByLeagueId(league_id);
    })
    .then((league) => league);
};

exports.removeLeagueByLeagueId = (league_id) => {
  const query = database.query(`DELETE FROM leagues WHERE league_id = ?;`, [
    league_id,
  ]);
  const doesLeagueExist = checkLeagueExists(league_id);
  return Promise.all([query, doesLeagueExist]).then((results) => {
    if (results[0][0].affectedRows === 0) {
      return Promise.reject({ status: 500, message: "Issue deleting league" });
    } else return;
  });
};
