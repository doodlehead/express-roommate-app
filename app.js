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

// ======================== Users ===========================//

//TODO: implement this
app.get('/user/:userId', (req, res) => {
  db.one('SELECT $1 AS value', 123)
  .then(function (data) {
    console.log('DATA:', data.value);
    res.send(data);
  })
  .catch(function (error) {
    console.log('ERROR:', error)
    res.send(error);
  });
});

//User creation
app.post('/user', (req, res, next) => {
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
      next(err);
    });
  });
});

app.get('/api/users', (req, res, next) => {
  const userQuery = new PQ({text: 'SELECT * from app_user', values: []});

  db.manyOrNone(userQuery)
    .then(db_res => {
      //TODO: restrict which fields to return
      res.json(db_res);
    }).catch(err => {
      next(err);
    });
});

//================ GROUPS ===================//
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
        values: [req.currentUser.user_id, db_res.pop().group_id]
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
            + '(SELECT group_id FROM belongs_to WHERE user_id = $1);', values: [req.currentUser.user_id]});

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

//=============== AUTH ================//
app.post('/authenticate', (req, res, next) => {
  //TODO: validate the req JSON first
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
      next(err);
    });
})


app.listen(port, () => console.log(`Example app listening on port ${port}!`));