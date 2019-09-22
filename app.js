const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

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
//TODO: terrible practice lmao
const secret = 'no-more-mangoes';

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
        console.log(decoded);
        //Do something?
        next();
      }
    });
  }
});

//TODO: Check the Authorization header if the user matches. If yes return the data.
app.get('/api/me', (req, res, next) => {
  console.log('yeet?');
  res.send('Made it');
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
    const insertUser = new PQ({text: 'INSERT into app_user (email, password_hash) VALUES ($1, $2)', values: [req.body.email, hash]});
    db.any(insertUser)
    .then(db_res => {
      res.sendStatus(201);
    })
    .catch(err => {
      next(err);
    });
  });
});

app.get('/users', (req, res, next) => {
  const userQuery = new PQ({text: 'SELECT * from app_user', values: []});

  db.manyOrNone(userQuery)
    .then(db_res => {
      //TODO: restrict which fields to return
      res.json(db_res);
    }).catch(err => {
      next(err);
    });
});

app.post('/authenticate', (req, res, next) => {
  //TODO: validate the req JSON first

  const getUser = new PQ({text: "SELECT * from app_user WHERE email = $1", values: [req.body.email]});

  db.one(getUser)
    .then(async user => {
      const match = await bcrypt.compare(req.body.password, user.password_hash);
      if(match) {
        //Return a json web token if password is right
        //Token doesn't expire. TODO?: expire token.
        const token = jwt.sign({ id: user.id, email: user.email }, secret);
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