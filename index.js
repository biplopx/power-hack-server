const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const paginate = require('jw-paginate');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
  jwt.verify(token, process.env.PH_ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }
    req.decoded = decoded;
    next();
  });
}

// MongoDB Connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ak5hm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try {
    await client.connect();
    console.log('DB Connect');
    const usersCollection = client.db('powerhack').collection('users');
    const billingCollection = client.db('powerhack').collection('billings');
    billingCollection.createIndex({ fullName: "text", email: "text", phone: "text" })

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
      if (requesterAccount) {
        const isPasswordCorrect = bcryptjs.compareSync(password, requesterAccount.hashedPassword);
        if (isPasswordCorrect) {
          const userToken = jwt.sign(email, process.env.PH_ACCESS_TOKEN);
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
      const fullName = req.body.fullName;
      const email = req.body.email;
      const phone = req.body.phone;
      const paidAmount = req.body.paidAmount;
      const billing = {
        fullName,
        email,
        phone,
        paidAmount,
        created_at: Date.now()
      }
      const result = await billingCollection.insertOne(billing);
      res.send({ status: 200, message: `Add successful from ${req.decoded}` })
    });

    // Billings List
    app.get('/api/billing-list', verifyJWT, async (req, res) => {
      const billings = await billingCollection.find().sort({ created_at: -1 }).toArray();
      const page = parseInt(req.query.page) || 1;
      // get pager object for specified page
      const pageSize = 10;
      const pager = paginate(billings.length, page, pageSize);
      // get page of items from items array
      const pageOfItems = billings.slice(pager.startIndex, pager.endIndex + 1);
      res.send({ pager, pageOfItems });

    });

    // Billings List TotalPaidAmount
    app.get('/api/billing-total', verifyJWT, async (req, res) => {
      const billings = await billingCollection.find().toArray();
      let sum = 0;
      billings.forEach(
        pageItem => {
          sum += parseInt(pageItem.paidAmount)
        }
      )
      res.send({ status: 200, total: sum });

    });

    // Billings List Search
    app.get('/api/billing-search', verifyJWT, async (req, res) => {
      const searchTerm = req.query.search
      const billings = await billingCollection.find({ $text: { $search: searchTerm } }).sort({ created_at: -1 }).toArray();
      const page = parseInt(req.query.page) || 1;
      // get pager object for specified page
      const pageSize = 10;
      const pager = paginate(billings.length, page, pageSize);
      // get page of items from items array
      const pageOfItems = billings.slice(pager.startIndex, pager.endIndex + 1);
      res.send({ pager, pageOfItems });

    });

    // Edit Billing
    app.put('/api/update-billing/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const newBilling = req.body;
      const updatedBilling = await billingCollection.updateOne({ _id: ObjectId(id) }, newBilling);
      res.send(updatedBilling);
    })

    // Edit Billing
    app.delete('/api/delete-billing/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const billings = await billingCollection.deleteOne({ _id: ObjectId(id) })
      console.log(billings)
      res.send({ status: 200, message: 'Deleted Succesfully' });
    })

  }
  finally {
    // 
  }
}
run();

// a. api/registration
// b. api/login
// c. api/billing-list
// d. api/add-billing
// e. api/update-billing/:id
// f. api/delete-billing/:id




app.listen(port, () => {
  console.log('BillingApp is running:', port)
});