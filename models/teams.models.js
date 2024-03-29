const database = require("../database/connection");
const {
  checkTeamExists,
  checkLeagueExists,
  checkUserExists,
} = require("./model.utils");

exports.fetchTeams = (
  sort_by = "created_at",
  order = "desc",
  team_name,
  coach,
  league,
  limit = 10,
  page = 1
) => {
  const validSortBys = {
    created_at: "created_at",
    team_name: "team_name",
    pokemon_count: "pokemon_count",
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

  let query = `SELECT teams.team_id, teams.team_name, teams.coach, users.username, teams.league, leagues.league_name, teams.team_image_url, teams.notes, teams.created_at, COUNT(leagues_pokemon_id) AS pokemon_count FROM teams LEFT JOIN users ON users.user_id = teams.coach LEFT JOIN leagues ON leagues.league_id = teams.league LEFT JOIN leagues_pokemon ON leagues_pokemon.drafted_by = teams.team_id `;

  const queryValues = [];
  let count = 0;
  if (team_name) {
    queryValues.push(team_name);
    query += `WHERE teams.team_name = ? `;
    count++;
  }

  if (coach) {
    queryValues.push(coach);
    if (count === 0) query += `WHERE teams.coach = ? `;
    else query += `AND coach = ? `;
    count++;
  }

  if (league) {
    queryValues.push(league);
    if (count === 0) query += `WHERE teams.league = ? `;
    else query += `AND league = ? `;
  }

  query += `GROUP BY teams.team_id ORDER BY ${validSortBys[sort_by]} ${order} `;

  const totalQuery = database.query(query, queryValues).then((result) => {
    return result[0].length;
  });

  query += `LIMIT ${limit} OFFSET ${(page - 1) * limit};`;

  const teamsQuery = database.query(query, queryValues).then((result) => {
    return result[0];
  });

  return Promise.all([totalQuery, teamsQuery]).then(([total, teams]) => {
    return { total, teams };
  });
};

exports.fetchTeamByTeamId = (team_id) => {
  const doesTeamExist = checkTeamExists(team_id);
  const query = database.query(
    `SELECT teams.team_id, teams.team_name, teams.coach, users.username, teams.league, leagues.league_name, teams.team_image_url, teams.notes, teams.created_at, COUNT(leagues_pokemon_id) AS pokemon_count FROM teams LEFT JOIN users ON users.user_id = teams.coach LEFT JOIN leagues ON leagues.league_id = teams.league LEFT JOIN leagues_pokemon ON leagues_pokemon.drafted_by = teams.team_id WHERE team_id = ? GROUP BY teams.team_id;`,
    [team_id]
  );
  return Promise.all([query, doesTeamExist]).then((results) => {
    return results[0][0][0];
  });
};

exports.createTeam = (team_name, coach, league) => {
  const doesUserExist = checkUserExists(coach);
  const doesLeagueExist = checkLeagueExists(league);
  return Promise.all([doesLeagueExist, doesUserExist])
    .then(() => {
      return database.query(
        `SELECT * FROM teams WHERE coach = ? AND league = ?;`,
        [coach, league]
      );
    })
    .then((result) => {
      if (result[0].length !== 0) {
        return Promise.reject({
          status: 400,
          message: "Each player may coach only one team per league",
        });
      }

      return database.query(
        `INSERT INTO teams (team_name, coach, league) VALUES (?, ?, ?);`,
        [team_name, coach, league]
      );
    })
    .then(() => {
      return database.query(
        `SELECT teams.team_id, teams.team_name, teams.coach, users.username, teams.league, leagues.league_name, teams.team_image_url, teams.notes, teams.created_at FROM teams LEFT JOIN users ON users.user_id = teams.coach LEFT JOIN leagues ON leagues.league_id = teams.league WHERE teams.team_id = LAST_INSERT_ID();`
      );
    })
    .then((result) => {
      return result[0][0];
    });
};

exports.updateTeamByTeamId = (
  team_id,
  team_name,
  coach,
  team_image_url,
  notes
) => {
  return checkTeamExists(team_id).then(() => {
    if (!team_name && !coach && !team_image_url && !notes) {
      return Promise.reject({
        status: 400,
        message: "At least one field must be selected for update",
      });
    }

    let query = `UPDATE teams SET`;
    const queryValues = [];
    let count = 0;

    if (team_name) {
      queryValues.push(team_name);
      query += ` team_name = ?`;
      count++;
    }

    if (coach) {
      queryValues.push(coach);
      if (count === 0) query += ` coach = ?`;
      else query += `, coach = ?`;
      count++;
    }

    if (team_image_url) {
      if (
        /^https?:\/\/(?:\w[%\.\-\/]?)+\.(?:jpg|gif|png)$/.test(team_image_url)
      ) {
        queryValues.push(team_image_url);
        if (count === 0) query += ` team_image_url = ?`;
        else query += `, team_image_url = ?`;
        count++;
      } else {
        return Promise.reject({
          status: 400,
          message: "Please provide a valid jpg, gif or png URL",
        });
      }
    }

    if (notes) {
      queryValues.push(notes);
      if (count === 0) query += ` notes = ?`;
      else query += `, notes = ?`;
    }

    query += ` WHERE team_id = ?;`;
    queryValues.push(team_id);

    if (coach) {
      return checkUserExists(coach)
        .then(() => {
          return database.query(query, queryValues);
        })
        .then(() => {
          return this.fetchTeamByTeamId(team_id);
        })
        .then((team) => team);
    } else {
      return database
        .query(query, queryValues)
        .then(() => {
          return this.fetchTeamByTeamId(team_id);
        })
        .then((team) => team);
    }
  });
};

exports.removeTeamByTeamId = (team_id) => {
  const doesTeamExist = checkTeamExists(team_id);
  const query = database.query(`DELETE FROM teams WHERE team_id = ?;`, [
    team_id,
  ]);
  return Promise.all([query, doesTeamExist]).then((results) => {
    if (results[0][0].affectedRows === 0) {
      return Promise.reject({ status: 500, message: "Issue deleting team" });
    } else return;
  });
};
