const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());//Cross Origin Resource Sharing: allows us to make request from one domain to a different domain
app.use(bodyParser());// Parse incomming requests and convert the body of the POST request into a JSON value that express api can easily work with

//Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});

pgClient.on('error', () => console.log('Lost PG connection'));

pgClient
  .query('CREATE TABLE IF NOT EXISTS fibvalues (number INT)')
  .catch(err => console.log(err));

//Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();


//Express Route handlers
app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from fibvalues');

  res.send(values.rows);//Only send rows
});

app.get('/values/current', async (req, res) => {
  //Redis library for NodeJS does not have out of the box PROMISE support,
  //hence we are using callbacks as oppose to making use of async await syntax
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO fibvalues(number) VALUES($1)', [index]);

  res.send({working: true});
});

app.listen(5000, err => {
  console.log('Listening');
});
