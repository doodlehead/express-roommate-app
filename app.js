const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

//Deployment
const dotenv = require('dotenv');
dotenv.config({path: '.env.local'});

//Database
var pgp = require('pg-promise')(/* options */);
var db = pgp(process.env.DATABASE_URL);
const PQ = require('pg-promise').ParameterizedQuery;

//Body Parser
var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

//CORS
var cors = require('cors');
app.use(cors());

//Bcrypt
const bcrypt = require('bcrypt');
const saltRounds = 10;

//For JWT Authentication
const jwt = require('jsonwebtoken');
const secret = process.env.SECRET;

//Check if the user if authorized for all /api/* paths
app.use('/api/*', (req, res, next) => {
  if(!req.headers.authorization) {
    res.status(401).send('No auth header present');
  } else {
    //Check the auth token to see if it's valid
    jwt.verify(req.headers.authorization, secret, function(err, decoded) {
      if(err) {
        res.status(401).json(err);
      } else {
        req.currentUser = decoded; //Put the user stuff in the req
        next();
      }
    });
  }
});

app.get('/api/me', (req, res, next) => {
  //TODO: Check the Authorization header if the user matches. If yes return the data.

  const query = new PQ({
    text: 'SELECT user_id, email, first_name, last_name FROM app_user WHERE user_id = $1;',
    values: [req.currentUser.user_id]
  });

  db.one(query)
    .then(db_res => {
      res.json(db_res);
    }).catch(err => {
      console.log(err);
      next(err);
    });
});

// ======================== USERS ===========================//

//Get a User's data
app.get('/api/user/:userId', (req, res, next) => {
  const query = new PQ({
    text: 'SELECT user_id, email, first_name, last_name FROM app_user WHERE user_id = $1',
    values: [req.params.userId]
  });

  db.one(query)
  .then(db_res => {
    res.json(db_res);
  })
  .catch(err => {
    console.error(err);
    next(err);
  });
});

//User creation
app.post('/api/user', (req, res, next) => {
  //TODO: Validate the submitted JSON data here...

  //Hash the password
  bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
    const insertUser = new PQ({
      text: 'INSERT into app_user (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4)',
      values: [req.body.email, hash, req.body.firstName, req.body.lastName]
    });
    db.any(insertUser)
    .then(db_res => {
      res.sendStatus(201);
    })
    .catch(err => {
      //Duplicate Email
      if(err.code == 23505) {
        res.status(409).send("User with that email already exists.");
      } else {
        next(err);
      }
    });
  });
});
//Get user list
app.get('/api/users', (req, res, next) => {
  const userQuery = new PQ({text: 'SELECT user_id, email, first_name, last_name from app_user', values: []});

  db.manyOrNone(userQuery)
    .then(db_res => {
      //TODO: restrict which fields to return
      res.json(db_res);
    }).catch(err => {
      next(err);
    });
});

//====================== GROUPS ========================//
//Create a new group
app.post('/api/group', (req, res, next) => {
  const query = new PQ({
    text: 'INSERT INTO user_group (group_name, group_admin) VALUES($1, $2) RETURNING group_id;',
    values: [req.body.groupName, req.currentUser.user_id]
  });
  //Is any() the best one to use here?
  db.any(query)
    .then(db_res => {
      //TODO: transaction here. All or nothing
      const queryBelongs = new PQ({
        text: 'INSERT INTO belongs_to VALUES($1, $2);',
        values: [req.currentUser.user_id, db_res[0].group_id]
      });

      db.any(queryBelongs)
        .then(db_res2 => {
          res.sendStatus(201);
        }).catch(err => {
          console.log(err);
          next(err);
        })
    }).catch(err => {
      console.log(err);
      next(err);
    });
});
//Get the groups the user is in
app.get('/api/groups', (req, res, next) => {
  const query = new PQ({
    text: 'SELECT * FROM user_group WHERE group_id IN '
            + '(SELECT group_id FROM belongs_to WHERE user_id = $1);',
    values: [req.currentUser.user_id]
  });

  db.manyOrNone(query)
    .then(db_res => {
      //console.log(db_res);
      res.json(db_res);
    }).catch(err => {
      console.log(err);
    });
});

//Get a particular group's info
app.get('/api/group/:groupId', (req, res, next) => {
  const query = new PQ({
    text: 'SELECT * FROM user_group WHERE group_id = $1;',
    values: [req.params.groupId]
  });

  db.one(query)
    .then(db_res => {
      res.json(db_res);
    }).catch(err => {
      console.log(err);
      next(err);
    });
})
//TODO: Define this in a helper file?
function getGroupUsers(groupId) {
  const q = new PQ('SELECT * FROM app_user WHERE user_id IN ' +
                            '(SELECT user_id FROM belongs_to WHERE group_id = $1);');

  return db.query(q, [groupId]);
}
app.get('/api/group/:groupId/users', (req, res, next) => {
  getGroupUsers(req.params.groupId)
    .then(db_res => {
      res.json(db_res);
    }).catch(err => {
      next(err);
    });
});

//Add Users to a group
app.post('/api/group/:groupId/user', async (req, res, next) => {
  if(!req.body.users) {
    res.status(400).send("No users provided");
  }

  const q = new PQ('INSERT INTO belongs_to (user_id, group_id) VALUES ($1, $2);');

  //TODO: make this a transaction
  for(let user_id of req.body.users) {
    try {
      let db_res = await db.query(q, [user_id, req.params.groupId]);
    } catch(err) {
      next(err);
    }
  }
  //Get the group data and send it back...

  getGroupUsers(req.params.groupId)
    .then(db_res => {
      res.json(db_res);
    }).catch(err => {
      next(err);
    });
});
//Remove users from group
app.delete('/api/group/:groupId/user', (req, res, next) => {
  if(!req.body.userId) {
    res.status(400).send("No userId provided");
  }

  const q = new PQ({
    text: 'DELETE FROM belongs_to WHERE user_id = $1 AND group_id = $2;',
    values: [req.body.userId, req.params.groupId]
  });

  //Return the remaning group members
  db.query(q)
    .then(db_res => {
      getGroupUsers(req.params.groupId)
        .then(db_res => {
          res.json(db_res);
        }).catch(err => {
          next(err);
        });
    }).catch(err => {
      console.error(err);
      next(err);
    });
});

//Get all events that belong to a group
app.get('/api/group/:groupId/events', (req, res, next) => {
  //Get all the ID of users in the group
  const eventsQuery = new PQ({
    text:
    `SELECT * FROM
    (SELECT user_id FROM belongs_to where group_id = $1) as T1
    JOIN calendar
    ON T1.user_id = calendar.user_id
    JOIN calendar_event
    ON calendar.calendar_id = calendar_event.calendar_id;`,
    values: [req.params.groupId]
  })

  db.query(eventsQuery)
    .then(db_res => {
      res.json(db_res);
    })
    .catch(err => {
      console.error(err);
      next(err);
    })
});

//============================== Calendar ===========================//
//Create Calendar
app.post('/api/calendar', (req, res, next) => {
  if(!req.body.name) {
    res.status(400).send("No name provided");
  }

  const query = new PQ({
    text: 'INSERT INTO calendar (user_id, calendar_name) VALUES ($1, $2);',
    values: [req.currentUser.user_id, req.body.name]
  });

  db.any(query)
    .then(db_res => {
      res.sendStatus(200);
    }).catch(err => {
      console.error(err);
      next(err);
    });
});
//Get a list of calendar ids
app.get('/api/calendars', (req, res, next) => {
  const query = new PQ({
    text: 'SELECT * FROM calendar WHERE user_id = $1;',
    values: [req.currentUser.user_id]
  });

  db.any(query)
    .then(db_res => {
      res.json(db_res);
    }).catch(err => {
      console.error(err);
      next(err);
    })
});
//Get a calendar and its events
app.get('/api/calendar/:calendarId', async (req, res, next) => {
  const query = new PQ({
    text: 'SELECT * FROM calendar WHERE calendar_id = $1;',
    values: [req.params.calendarId]
  });

  const eventQuery = new PQ({
    text: 'SELECT * FROM calendar_event WHERE calendar_id = $1;',
    values: [req.params.calendarId]
  });

  try {
    let calendarRes = await db.one(query);
    let eventList = await db.any(eventQuery);

    res.json({
      name: calendarRes.calendar_name,
      events: eventList
    });

  } catch(err) {
    console.error(err);
    next(err);
  }

});

app.delete('/api/calendar/:calendarId', (req, res, next) => {
  db.query('DELETE FROM calendar WHERE calendar_id = ${calendarId}', {
    calendarId: req.params.calendarId
  }).then(db_res => {
    res.sendStatus(200);
  }).catch(err => {
    console.error(err);
    next(err);
  });
});
//Create a new event
app.post('/api/calendar/:calendarId/event', (req, res, next) => {
  //TODO: validate the payload

  db.one('INSERT INTO calendar_event (event_name, calendar_id, start_time, end_time, start_date, end_date, recurring, description, event_importance) '
      + 'VALUES (${name}, ${calendarId}, ${startTime}, ${endTime}, ${startDate}, ${endDate}, ${recurring}, ${description}, ${eventImportance}) RETURNING *;', {
        name: req.body.name,
        calendarId: req.body.calendarId,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        recurring: req.body.recurring,
        description: req.body.description,
        eventImportance: req.body.eventImportance
    })
    .then(db_res => {
      res.json(db_res);
    }).catch(err => {
      console.error(err);
      next(err);
    });

});
//Modify event
app.put('/api/calendar/:calendarId/event/:eventId', (req, res, next) => {
  //TODO: validate payload

  db.one('UPDATE calendar_event SET event_name = ${name}, start_time = ${startTime}, end_time = ${endTime}, '
  + 'start_date = ${startDate}, end_date = ${endDate}, description = ${description}, event_importance = ${eventImportance}, recurring = ${recurring} '
  + 'WHERE event_id = ${eventId} RETURNING *;', {
    name: req.body.name,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    description: req.body.description,
    eventImportance: req.body.eventImportance,
    recurring: req.body.recurring,
    eventId: req.params.eventId
  })
    .then(db_res => {
      res.json(db_res);
    }).catch(err => {
      console.error(err);
      next(err);
    })
});
//Delete event
app.delete('/api/calendar/:calendarId/event/:eventId', (req, res, next) => {
  const query = new PQ({
    text: 'DELETE FROM calendar_event WHERE event_id = $1;',
    values: [req.params.eventId]
  });

  db.query(query)
    .then(db_res => {
      res.sendStatus(200);
    }).catch(err => {
      console.error(err);
      next(err);
    });
});

//======================== AUTH ========================//
app.post('/authenticate', (req, res, next) => {
  if(!req.body.email || !req.body.password) {
    res.status(400).send('Username or password missing');
  }

  const getUser = new PQ({text: "SELECT * FROM app_user WHERE email = $1", values: [req.body.email]});

  db.one(getUser)
    .then(async user => {
      const match = await bcrypt.compare(req.body.password, user.password_hash);
      if(match) {
        //Return a json web token if password is right
        //Token doesn't expire. TODO?: expire token.
        const token = jwt.sign({ user_id: user.user_id, email: user.email }, secret);
        res.json({authorization: token});
      } else {
        //Password doesn't match
        res.status(401).send('Invalid username or password');
      }
    }).catch(err => {
      //Can't find user or other error
      if(err.message) {
        res.status(401).send(err.message);
      } else {
        next(err);
      }
    });
})


app.listen(port, () => console.log(`Example app listening on port ${port}!`));