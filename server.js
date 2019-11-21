const https = require('https')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const MongoClient = require('mongodb').MongoClient
const querystring = require('querystring');
var fs = require("fs");

var db
var collection_name = 'user_preferences'

// Remember to change YOUR_USERNAME and YOUR_PASSWORD to your username and password! 
MongoClient.connect('mongodb://localhost:27017/', (err, database) => {
  if (err) return console.log(err)
  db = database.db('AAL_Project')
  app.listen(process.env.PORT || 3000, () => {
    console.log('listening on 3000')
  })
})

app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())
app.use(express.static('public'))

app.get('/', (req, res) => {
  db.collection('quotes').find().toArray((err, result) => {
    if (err) return console.log(err)
    res.render('index.ejs', {quotes: result})
  })
})

// app.post('/items', (req, res) => {
//   db.collection(collection_name).save(req.body, (err, result) => {
//     if (err) return console.log(err)
//     console.log('Added to database.')
//     res.redirect('/')
//   })
// })

app.post('/items', (req, res) => {
  db.collection(collection_name).findOneAndUpdate({name: 'user'}, {
    $set: {
      desired_temp: req.body.desired_temp,
      pollen_reduction: req.body.pollen_reduction,
      co2_reduction: req.body.co2_reduction,
      goal_strategy: req.body.goal_strategy
    }
  }, {
    sort: {_id: -1},
    upsert: true
  })
  res.redirect('/')
})

app.get('/preferences', (req, res) => {
  db.collection(collection_name).findOne({name: 'user'}).then(function(document){
    var desired_temp = document.desired_temp;
    var pollen_reduction = document.pollen_reduction;
    var co2_reduction = document.co2_reduction;
    var goal_strategy = document.goal_strategy;

    var preferences = {}
    preferences["desired_temp"] = desired_temp;
    preferences["pollen_reduction"] = pollen_reduction;
    preferences["co2_reduction"] = co2_reduction;
    preferences["goal_strategy"] = goal_strategy;

    res.send(preferences)
  })
})

app.post('/receiveData', (req, res) => {
  var temperature = req.query.temperature;
  var pressure = req.query.pressure;
  var noise = req.query.noise;
  var humidity = req.query.humidity;
  var CO2 = req.query.CO2;
  var pollen = req.query.pollen;

  console.log(req.query)

  db.collection(collection_name).findOne({name: 'user'}).then(function(document){
    var desired_temp = document.desired_temp;
    var pollen_reduction = document.pollen_reduction;
    var co2_reduction = document.co2_reduction;
    var goal_strategy = document.goal_strategy;
  
    var circles = {}
    circles["temperature"] = "green";
    circles["pressure"] = "green";
    circles["humidity"] = "green";
    circles["noise"] = "green";
    circles["CO2"] = "green";
    circles["pollen"] = "green";

    var doThis = []

    if (noise > 75 && noise < 85) {
      circles["noise"] = "orange"
    }
    else if (noise >= 85){
      circles["noise"] = "red"
      doThis.push("<font color='red'><b>WARNING:</b></font> Excessive noise detected. Continuous exposure to levels above 85dB can cause permanent hearing damage.<br>")
    }

    if (CO2 > 1000){
      circles["CO2"] = "orange";
      doThis.push("Opening windows to reduce CO2 levels...")
      if (pollen_reduction == "Yes"){
        doThis.push("Switching on HEPA air filtration to reduce pollen count...")
      }
    }

    if (pollen != "Low"){
      circles["pollen"] = "orange";
    }

    if (temperature > desired_temp + 1) {
      circles["temperature"] = "orange";
      if (pollen_reduction == "Yes"){
        if (pollen != "Low"){
          doThis.push("Switching on air conditioning to reduce room temperature...")
        }
        else{
          if (goal_strategy == "cost_minimisation") {
            doThis.push("Opening windows to reduce room temperature...")
          }
          else {
            doThis.push("Switching on air conditioning to reduce room temperature...")
          }
        }
      }
      else {
        if (goal_strategy == "cost_minimisation") {
          doThis.push("Opening windows to reduce room temperature...")
        }
        else {
          doThis.push("Switching on air conditioning to reduce room temperature...")
        }
      }
    }
    else if (temperature < desired_temp - 1) {
      circles["temperature"] = "blue";
      doThis.push("Switching off air conditioning to increase room temperature...")
      if (CO2 >= 1000 ) {
        doThis.push("Switching on central heating system to increase room temperature...")
      }
      else if (CO2 > 750 && CO2 < 1000) {
        if (co2_reduction == "Low"){
          doThis.push("Switching on central heating system to increase room temperature...")
        }
        else {
          doThis.push("Closing windows to increase room temperature...")
          
        }
      }
      else if (CO2 <= 750) {
        if (goal_strategy == "cost_minimisation") {
          doThis.push("Closing windows to increase room temperature...")
        }
        else{
          doThis.push("Closing windows to increase room temperature...")
          doThis.push("Switching on central heating system to increase room temperature...")
        }
      }
    }
    else {
      doThis.push("<i>Everything</i> is OK.")
      circles["temperature"] = "green";
    }
  
    circles["doThis"] = doThis;

    console.log(doThis)
    // res.send(doThis)
    res.send(circles)
  })
})

app.delete('/items', (req, res) => {
  db.collection(collection_name).findOneAndDelete({name: req.body.name}, (err, result) => {
    if (err) return res.send(500, err)
    res.send('Deleted entry.')
  })
})

var options = {
  hostname: 'api.netatmo.com',
  path: '/api/getstationsdata',
  method: 'POST',
  headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
  }
};

var some_data

var params = querystring.stringify({
  'access_token': '5d499e7c8b234500105f79d8|b207817e9c4ceed9dcfdedfc3789321e',
  'device_id': '70:ee:50:12:ad:ee'
});

var callback = function(response) {
  response.on('error', function(e) {
      console.log('error', e);
  });
  var res = '';

  response.on('data', function (chunk) {
      res += chunk;
  });

  response.on('end', function () {
      res = JSON.parse(res);
      if (response.statusCode == '200') {
          var data = res.body;
          console.log(data);
          var myJSON = JSON.stringify(data);
          fs.writeFile("temp.txt", myJSON, (err) => {
            if (err) console.log(err);
            console.log("Successfully Written to File.");
          });
      } else {
          console.log('status code:', response.statusCode, '\n', res);
      }
  });
};

var req_netatmo = https.request(options, callback);

req_netatmo.on('error', function(e) {
  console.log('There is a problem with your request:', e.message);
});

app.get('/latestData', (req, res) => {
  req_netatmo.write(params);
  req_netatmo.end();

  setTimeout(function(){
    fs.readFile("temp.txt", function(err, buf) {
      var MyJSON = JSON.parse(buf)
      return_data = MyJSON["devices"][0]["dashboard_data"];

      res.send(return_data)
    });
  }, 1000);
})