const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { reset } = require('nodemon');
const port = process.env.PORT || 5000;
const app = express();

// midleware
app.use(cors());
app.use(express.json());

// root route
app.get('/', (req, res) => {
  res.send('Billing Apllication server is running...')
});

// Verify Token
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }
    req.decoded = decoded;
    next();
  });
}



const uri = "mongodb+srv://phadmin:qsg48P4FHaZuHdZP@cluster0.ak5hm.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try {
    await client.connect();
    console.log('DB Connect');
    const usersCollection = client.db('powerhack').collection('users');
    const billingCollection = client.db('powerhack').collection('billings');

    // user creation
    app.post('/api/registration', async (req, res) => {
      const email = req.body.email;
      const fullName = req.body.fullName;
      const password = req.body.password;
      const hashedPassword = bcryptjs.hashSync(password, 10);

      const requester = await usersCollection.findOne({ email: email });

      if (requester) {
        res.send({ status: 401, message: 'user already exits' })
      }
      else {
        const user = {
          email,
          fullName,
          hashedPassword
        }
        const result = await usersCollection.insertOne(user);
        res.send({ status: 200, message: 'User create successfull' })
      }
    });
    // Login
    app.post('/api/login', async (req, res) => {
      const email = req.body.email;
      const password = req.body.password;
      const requesterAccount = await usersCollection.findOne({ email: email });
      console.log(requesterAccount)
      if (requesterAccount) {
        const isPasswordCorrect = bcryptjs.compareSync(password, requesterAccount.hashedPassword);
        if (isPasswordCorrect) {
          const userToken = jwt.sign(email, process.env.ACCESS_TOKEN);
          res.send({ status: 200, message: 'Login Success', token: userToken })
        }
        else {
          res.send({ status: 401, message: 'user or pass not match' })
        }
      }
      else {
        res.send({ status: 401, message: 'user or pass not match' })
      }
    });

    // Add Billing
    app.post('/api/add-billing', verifyJWT, async (req, res) => {
      console.log(req.decoded)
      const fullName = req.body.fullName;
      const email = req.body.email;
      const phone = req.body.phone;
      const paidAmount = req.body.paidAmount;
      const billing = {
        fullName,
        email,
        phone,
        paidAmount
      }
      const result = await billingCollection.insertOne(billing);
      res.send({ status: 200, message: `Add successful from ${req.decoded}` })

    });
  }
  finally {
    // 
  }
}

// a. api/registration
// b. api/login
// c. api/billing-list
// d. api/add-billing
// e. api/update-billing/:id
// f. api/delete-billing/:id

run();



app.listen(port, () => {
  console.log('BillingApp is running:', port)
});