const express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http); //Creates a socket and mounts it on our http server
const path = require('path')
const PORT = process.env.PORT || 5000




var room_info = {"room1": 0, "room2": 0};
var colors = ["#00FF00", "#00FFFF", "#FF00FF", "#FF0000", "#1E90FF", "#008000", "#00FF7F", "#B22222", "#DAA520", "#FF4500", "#2E8B57", "#5F9EA0", "#D2691E"];

//Hard Coding Room1's object
room_info["room1"] = {
  "colors_left": [],
  "room_count": 0,
  "user_list": []
}

//Hard Coding Room2's object
room_info["room2"] = {
  "colors_left": [],
  "room_count": 0,
  "user_list": []
}

//Represents all the colors that are not taken by a user. Just used for making sure no two users have the same color. 
//We are just looping through our list of colors and putting it into our room's struct
for(var i = 0; i < colors.length; i++) {
  room_info["room1"]["colors_left"].push(colors[i]);
  room_info["room2"]["colors_left"].push(colors[i]);
}


app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.get('/watch/:genLink', function (req, res) {
  console.log("GENLINK: " + req.params["genLink"]);
  res.render('index', {token: req.params["genLink"]});
});
http.listen(PORT, () => console.log(`Listening on ${ PORT }`))

io.on('connection', function(socket){
  console.log('a user connected');
  var room_name = socket.handshake.query.token;                               //Our room
  var cur_room_color = room_info[room_name]["colors_left"].pop(0);          //Increments our room count
  var socket_name = socket;
  room_info[room_name]["user_list"].push(socket);                           //add socket to our user
  socket.join(room_name);                                                   //Join that room
  room_info[room_name]["room_count"] += 1;
  console.log("Room Count: " + room_info[room_name]["room_count"]);          //Print out some values 
  console.log("Room Color: " + cur_room_color);
  console.log("param: " + socket.handshake.query.token)
  console.log('user ' + socket.id + ' connected');

  socket.on('pause', function(){
    socket.broadcast.emit('pause');
  });
  socket.on('play', function(){
    socket.broadcast.emit('play');
  });
  socket.on('seek', function(param){
    socket.broadcast.emit('seek', param);
  });

  socket.on('activity log', function(msg){
    var msgObject = {
      "message": msg, 
      "color": cur_room_color
    }
    io.in(Object.keys(socket.rooms)[1]).emit('activity log', JSON.stringify(msgObject));

  });

  socket.on('chat message', function(msg){
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
    io.in(Object.keys(socket.rooms)[1]).emit('chat message', msg_s);
    //Print out socket id, msg
    console.log('message from socket ' + socket.id + ': ' + msg);
    console.log('Room: ' + room_name);
    console.log(Object.keys(socket.rooms)); //Will get an array of the key + all the rooms. Ill just leave this here cz it might be useful later 
  });

  //Client has disconnected from our server
  socket.on('disconnect', function(){
    console.log('user disconnected');
    //We will decrement the number of users in our room
    room_info[room_name]["colors_left"].push(cur_room_color);
    room_info[room_name]["room_count"] -= 1;

    var index = room_info[room_name]["user_list"].indexOf(socket_name);
    if (index > -1) {
      room_info[room_name]["user_list"].splice(index, 1);
    }
    for(var i = 0; i < room_info[room_name]["user_list"].length; i++) {
      console.log("array after removal: " + room_info[room_name]["user_list"][i].id);
    }

  });
});

