const express = require('express');
const cors = require('cors');

const app = express();




app.use(cors());
app.use(express.json());




app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});


app.get('/', (req, res) => {
  res.status(200).json({message:'this is the mountain hut server'});
});

module.exports = app;