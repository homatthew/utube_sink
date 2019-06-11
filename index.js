const express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http); //Creates a socket and mounts it on our http server
const path = require('path')
const PORT = process.env.PORT || 5000




var room_info = {};
var colors = ["#00FF00", "#00FFFF", "#FF00FF", "#FF0000", "#1E90FF", "#008000", "#00FF7F", "#B22222", "#DAA520", "#FF4500", "#2E8B57", "#5F9EA0", "#D2691E"];


app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.get('/watch/:genLink', function (req, res) {
  console.log("GENLINK: " + req.params["genLink"]);
  if (req.params["genLink"] in room_info) {
    res.render('index', { token: req.params["genLink"] });
  } else {
    res.status(404).send('Room Not found');
  }
});

app.get('/', function (req, res) {
  res.render('home');
});

http.listen(PORT, () => console.log(`Listening on ${PORT}`))

io.on('connection', function (socket) {

  console.log(socket.handshake.query.type);
  console.log(socket.handshake.query.token);

  if (socket.handshake.query.type == "watch") {
    console.log('a user connected');
    var room_name = socket.handshake.query.token;                               //Our room

    if (room_name in room_info) {

      var cur_room_color = room_info[room_name]["colors_left"].pop(0);          //Increments our room count
      var socket_name = socket;
      room_info[room_name]["user_list"].push(socket);                           //add socket to our user
      socket.join(room_name);                                                   //Join that room
      room_info[room_name]["room_count"] += 1;
      console.log("Room Count: " + room_info[room_name]["room_count"]);          //Print out some values 
      console.log("Room Color: " + cur_room_color);
      console.log("param: " + socket.handshake.query.token)
      console.log('user ' + socket.id + ' connected');

      function get_currTime(){
        if(room_info[room_name]["is_playing"]){ //if the video is playing, add elapsed time
          let sec = new Date().getTime() / 1000;
          let elapsed = sec - room_info[room_name]["last_paused"];
          room_info[room_name]["last_paused"] = sec;
          room_info[room_name]["curr_time"] += elapsed;
        }
        return room_info[room_name]["curr_time"];
      }


      //send the user the url and other room information 
      let m_msg = {
        "video": room_info[room_name]["video"],
        "room_nickname": room_info[room_name]["room_nickname"],
        "curr_time": get_currTime(),
        "is_playing": room_info[room_name]["is_playing"]
      }
      socket.emit('init', JSON.stringify(m_msg))


      socket.on('pause', function () {
        socket.in(room_name).emit('pause');
        if(room_info[room_name]["is_playing"])
          get_currTime();
        room_info[room_name]["is_playing"] = false;
      });
      socket.on('play', function () {
        socket.in(room_name).emit('play');
        if(!room_info[room_name]["is_playing"]){
          room_info[room_name]["last_paused"] = new Date().getTime() / 1000;
        }
        room_info[room_name]["is_playing"] = true;
      });
      socket.on('seek', function (param) {
        socket.in(room_name).emit('seek', param);
        room_info[room_name]["curr_time"] = param;
        room_info[room_name]["last_paused"] = new Date().getTime() / 1000;
      });
      socket.on('set', function (param) {
        socket.in(room_name).emit('set', param);
        room_info[room_name]["curr_time"] = 0;
        room_info[room_name]["last_paused"] = new Date().getTime() / 1000;
        room_info[room_name]["is_playing"] = false;
        room_info[room_name]["video"] = param;
      });

      socket.on('activity log', function (msg) {
        var msgObject = {
          "message": msg,
          "color": cur_room_color
        }
        io.in(room_name).emit('activity log', JSON.stringify(msgObject));
      });

      socket.on('chat message', function (msg) {
        //Our message is a json object. We will parse it on client side. 
        msg = JSON.parse(msg);
        var msgObject = {
          "name": msg["name"],
          "message": msg["message"],
          "color": cur_room_color
        }
        console.log("COLOR: " + msgObject["color"]);

        //converting our object to string
        var msg_s = JSON.stringify(msgObject);

        //Sends a message to all clients inside our room
        io.in(room_name).emit('chat message', msg_s);
        //Print out socket id, msg
        console.log('message from socket ' + socket.id + ': ' + msg_s);
        console.log('Room: ' + room_name);
        console.log("ROOOOOMS: " + socket.rooms);
      });

      //Client has disconnected from our server
      socket.on('disconnect', function () {
        console.log('user disconnected');
        //We will decrement the number of users in our room
        room_info[room_name]["colors_left"].push(cur_room_color);
        room_info[room_name]["room_count"] -= 1;

        var index = room_info[room_name]["user_list"].indexOf(socket_name);
        if (index > -1) {
          room_info[room_name]["user_list"].splice(index, 1);
        }
        for (var i = 0; i < room_info[room_name]["user_list"].length; i++) {
          console.log("array after removal: " + room_info[room_name]["user_list"][i].id);
        }

      });
    }
  } else if (socket.handshake.query.type == "home") {

    socket.on("create_room", function (param) {
      //generate a random number that hasn't been used
      var room_token = Math.floor(Math.random() * 1000);
      while (room_token in room_info) {
        room_token = Math.floor(Math.random() * 1000);
      }

      //decode the message
      msg_p = JSON.parse(param);
      //TODO: validate user input serverside

      room_info[room_token.toString()] = {
        "colors_left": [],
        "room_count": 0,
        "user_list": [],
        "video": msg_p["vid"],
        "room_nickname": msg_p["room_name"],
        "curr_time": 0,
        "last_paused": new Date().getTime / 1000,
        "is_playing": false
      };

      console.log(room_token);
      console.log("rooms");
      for (var key in room_info) {
        console.log(key);
      };

      for (var i = 0; i < colors.length; i++) {
        room_info[room_token]["colors_left"].push(colors[i]);
      }

      var linkObject = {
        "port": PORT,
        "route": "/watch",
        "token": room_token
      };
      var msg_s = JSON.stringify(linkObject);
      socket.emit('create_room', msg_s)
    });


    var is_valid = false;
    socket.on("is_valid", function (room) {
      for (var key in room_info) {
        if (key == room) {
          socket.emit("is_valid", "valid");
          is_valid = true;
          break;
        }
      }

      if (!is_valid) {
        socket.emit("is_valid", "invalid");
      }
    });

    socket.on('disconnect', function () {
      console.log('home page user disconnected');
    });
  }
});

