const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());

let dbpath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initialisation = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("server started");
    });
  } catch (e) {
    console.log(`error: ${e}`);
  }
};

initialisation();

let jwtToken;

const authenticationf = (req, res, next) => {
  let jwtToken;
  const authentication = req.headers["authorization"];
  console.log(authentication);
  if (authentication !== undefined) {
    jwtToken = authentication.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "naval5", async (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/register/", async (req, res) => {
  const { username, name, password, gender, location } = req.body;
  const isUserPresentQuery = `SELECT *
        FROM 
            user 
        WHERE 
            username =  '${username}';`;
  const isUserPresent = await db.get(isUserPresentQuery);
  console.log(isUserPresent);
  if (isUserPresent === undefined) {
    let passLength = password.length;

    if (passLength > 4) {
      const hashPass = await bcrypt.hash(password, 10);
      //console.log(hashPass);
      const registerQuery = `INSERT INTO user
            (username, name, password, gender, location)
            VALUES
            ('${username}', '${name}', '${hashPass}', '${gender}', '${location}');`;

      await db.run(registerQuery);
      res.send("User created successfully");
    } else {
      res.status(400);
      res.send("Password is too short");
    }
  } else {
    res.status(400);
    res.send("User already exists");
  }
});
//api-2 login

app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const isUserPresentQuery = `SELECT *
        FROM 
            user 
        WHERE 
            username =  '${username}';`;
  const isUserPresent = await db.get(isUserPresentQuery);
  if (isUserPresent === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const matchPass = await bcrypt.compare(password, isUserPresent.password);
    if (matchPass) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "naval5");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

//api-3 change pass
app.put("/change-password/", authenticationf, async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const isUserPresentQuery = `SELECT *
        FROM 
            user 
        WHERE 
            username =  '${username}';`;
  const isUserPresent = await db.get(isUserPresentQuery);
  if (isUserPresent === undefined) {
    res.status(400);
    res.send("user not found");
  } else {
    const isPassMatch = await bcrypt.compare(
      oldPassword,
      isUserPresent.password
    );
    if (isPassMatch) {
      const newPassLength = newPassword.length;
      if (newPassLength > 4) {
        const hashNewPass = await bcrypt.hash(newPassword, 10);
        const changePassQuery = `UPDATE user 
                    SET 
                    password = '${hashNewPass}'
                    WHERE 
                    username = '${username}';`;
        await db.run(changePassQuery);
        res.send("Password updated");
      } else {
        res.status(400);
        res.send("Password is too short");
      }
    } else {
      res.status(400);
      res.send("Invalid current password");
    }
  }
});

//API-1 get states
app.get("/states/", authenticationf, async (req, res) => {
  const getStatesQuery = `SELECT *
        FROM 
            state`;

  const getStates = await db.all(getStatesQuery);
  res.send(
    getStates.map((eachItem) => {
      return {
        stateId: eachItem.state_id,
        stateName: eachItem.state_name,
        population: eachItem.population,
      };
    })
  );
});

//API-2 Get state by id

app.get("/states/:stateId/", authenticationf, async (req, res) => {
  let { stateId } = req.params;
  const getStateByIdQuery = `SELECT * 
        FROM 
            state 
        WHERE 
            state_id = ${stateId};`;
  const getStateById = await db.get(getStateByIdQuery);
  res.send({
    stateId: getStateById.state_id,
    stateName: getStateById.state_name,
    population: getStateById.population,
  });
});

//API-3 post districts
app.post("/districts/", authenticationf, async (req, res) => {
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  //console.log(districtName);
  const postDistrictQuery = `INSERT INTO district
    (district_name, state_id, cases, cured, active, deaths)
    VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths} );`;

  const postDistrict = await db.run(postDistrictQuery);
  res.send("District Successfully Added");
});

//API-4 get District by id
app.get("/districts/:districtId/", authenticationf, async (req, res) => {
  const { districtId } = req.params;
  const getDistrictByIdQuery = `SELECT *
        FROM district 
        WHERE 
            district_id = ${districtId};`;
  const getDistrictById = await db.get(getDistrictByIdQuery);
  res.send({
    districtId: getDistrictById.district_id,
    districtName: getDistrictById.district_name,
    stateId: getDistrictById.state_id,
    cases: getDistrictById.cases,
    cured: getDistrictById.cured,
    active: getDistrictById.active,
    deaths: getDistrictById.deaths,
  });
});

//API-5 delete district by Id
app.delete("/districts/:districtId/", authenticationf, async (req, res) => {
  const { districtId } = req.params;
  const deleteDistrictQuery = `DELETE 
        FROM 
            district 
        WHERE 
            district_id = ${districtId};`;
  const deleteDistrict = await db.run(deleteDistrictQuery);
  res.send("District Removed");
});

//API-6 put district
app.put("/districts/:districtId/", authenticationf, async (req, res) => {
  const { districtId } = req.params;
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const putDistrictByIdQuery = `INSERT INTO district
        (
        district_name,
        state_id,
        cases,
        cured,
        active,
        deaths) 
        VALUES
        ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const putDistrictById = await db.run(putDistrictByIdQuery);
  res.send("District Details Updated");
});

//API-7 get statistict of corona by stateId
app.get("/states/:stateId/stats/", authenticationf, async (req, res) => {
  const { stateId } = req.params;
  const getStatsByDistrictIdQuery = `SELECT 
            sum(cases) as totalCases,
            sum(cured) as totalCured,
            sum(active) as totalActive,
            sum(deaths) as totalDeaths
        FROM 
            district
        WHERE 
            state_id = ${stateId};`;
  const getStatsByDistrictId = await db.get(getStatsByDistrictIdQuery);
  res.send(getStatsByDistrictId);
});

//API-8 get districtName by district_id
app.get(
  "/districts/:districtId/details/",
  authenticationf,
  async (req, res) => {
    const { districtId } = req.params;
    const getDistrictNameByIdQuery = `SELECT 
            state.state_name as stateName
        FROM 
            state INNER JOIN district ON state.state_id = district.state_id
        WHERE 
            district.district_id = ${districtId};`;
    const getDistrictNameById = await db.get(getDistrictNameByIdQuery);
    res.send(getDistrictNameById);
  }
);

module.exports = app;
