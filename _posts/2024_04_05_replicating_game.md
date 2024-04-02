---
layout: post
title: Making a game replicate
categories: guide viedo-games
---

# Video Games

Video games are fun. I've played hundreds of video games in my life, and I've worked on a few too. Some fun, some not. Four have been released. Three are commercial products, and one is open source.
I didn't work on any of the game aspects of the commercial products. Instead, I worked on the backend side: login systems, leaderboards, inventory management, etc.

If you're interested, the commercial projects were [Dissolution](https://store.steampowered.com/app/920470/Dissolution/){:target="_blank"}{:rel="noopener noreferrer"}
[comment]: <> (_)
which is no longer being developed, and the servers are no longer up, but it
was a multiplayer PvP FPS game. You can still play first the singleplayer campaign mission set. We had more planned, but we never got to release them; the next game I worked on was [Shutdown](https://store.steampowered.com/app/2536460/Shutdown/){:target="_blank"}{:rel="noopener noreferrer"}.
[comment]: <> (_)
As of writing it is not available on Steam, but there are download links available for early versions. Shutdown is still being developed,
as far as I'm aware; I also worked a bit on [Trinity of The Fabled](https://store.steampowered.com/app/2215710/Trinity_Of_The_Fabled/){:target="_blank"}{:rel="noopener noreferrer"}
[comment]: <> (_)
, although it was just called "The Fabled" when I was working on it. I worked the least on this one, of the three. It shares the backend APIs with Shutdown, both of which use my [web3 game API suite](https://web3gameapi.dev){:target="_blank"}.
[comment]: <> (_)

The open source project was made for a Global Game Jam I took part in in 2019 when I was in university. It's a rhythm game. I improved it a little bit after the game jam, but it was mostly built over a single weekend.
You can find it on GitHub [here](https://github.com/MrMcGoats/Global-Game-Jam-2019){:target="_blank"}
[comment]: <> (_)
, if you're interested. However, the repo for the game engine I used, Angel2D, is archived, and the exact branch seems to no longer exist, so it may be difficult to build the game, if you want to actually play it.

This is all a long way of saying "I like video games", both playing and making them. Many types of games, both singleplayer and multiplayer, which is what this guide will focus on.

This guide, however, isn't about making video games. Instead, it's about making a game replicate. If you want to learn to make a video game, this guide is not for you.

## What is replication

So, what is replication? Simply, in the context of video games, it means cloning the game state of one player to that of another player. So, if player A and player B are playing a game together, and player A kills player B's character, it is replication that allows player B to see in his game that he has been killed by player A. Replication is what makes a multiplayer game multiplayer.

## Resources

As this guide is not about how to make a game, you will need to provide your own if you want to follow along with this tutorial. I would recomend a game written in Javascript or Typescript (admitedly, a small relatively small subset of open source games), but this guide will be easilly applicable in any programming language.

In this guide, we're going to be using the game from a tutorial by jslegend, which can be found [here](https://github.com/JSLegendDev/Pokemon-like-Game-Made-in-Kaboom.js){:target="_blank"}, but you can feel free to use any game you like.
[comment]: <> (_)

## The server

Since we already have our game, we'll start by making the game server to connect to. This will be what is called an "authoratative server". That means that the server is treated as the authority of truth in the
gmae world. Whatever the server says happens is what happened, and any rumors to the contrary are ignored and discarded by the game.

There's a few protocols we can use to make this, but we're going to use one called Websockets in our example. Websockets, if you don't know, is effectively a message protocol. Similar to a phone call between you
and your mom, the game client opens a "call" (called a "channel") with the server, and they both remain on the call for the duration of the play session. They use the channel to send messages to each other. These
messages will contain information about the game state. They can be things like the client informing the server that the user is trying to move up, or the server informing all the connected clients that another
player has moved to the left.

Depending on the requirements to prevent cheating, and minimum acceptable latency, and things of that nature, the server verifies all actions the client claims to perform, before announcing that action to
everyone else who needs to know. Since this is just a demo, we don't really care if anyone cheats, so our server will have very minimal checks on client actions, but we will discuss what could be added
at the end.

You don't have to write the server in the same language as the game, but we will in this tutorial. However, it is often easier to write the game and server in the same language, so you can share code between the two.

Ok, so let's start writing our server. With Javascript, and many other languages, we don't have to write the entire server on our own. We'll use the npm package `ws` to help us.

```bash
npm install ws
```

And then we can write our first iteration of the server.

```js
import WebSocket, { WebSocketServer } from 'ws';

const wss = new WebSocketServer({port: 8080});

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (message: string) => {
    console.log(`Received message => ${message}`);
  });

  ws.on('error', console.error);
  ws.on('close', console.log);

  ws.send('something');
});
``` 

This is pretty basic, but it's a good start. You can connect on port 8080. When the client connects, the server starts checking for any messages from the client. If we get a message, we print it out.

You can connect to this server with your prefered Websocket client and interact with it to see it in action, but it will be more useful to update our game to interact with the server.

I added a new file to the game, that I called `socket.js` which is used to open the connection to the game server. It effectively mirrors what the server does: connects to the server, and passes
messages that it recieves to another function to handle.

```js
// Connect to the websocket server
const socket = new WebSocket('ws://localhost:3000')

socket.onopen = () => {
    alert('Connected to the websocket server')
}

socket.onclose = (event) => {
  if (event.wasClean) {
    alert('Connection closed cleanly')
  } else {
    alert('Connection died')
  }
}

socket.onerror = (error) => {
  alert(`Error: ${error.message}`)
}

// socket.binaryType = "arraybuffer"

window.setupHandler = (func) => {
  socket.onmessage = (event) => {
    func(event)
  }
}


window.socket = socket;
```

This is good, but doesn't really do anything. Let's send messages to the server. The simplest thing would probably be to tell the server where the player has moved to, so let's start with that.

In the file `scene/world.js`, which is the file that manages player input and world events for the game I'm using, I added a function called `updatePlayer` which takes the coordinates of the player, and
uses `window.socket.send` to send the server those coordinates.

```js
function updatePlayer({x, y}) {
  window.socket.send([x, y])
}
```

and then we'll just add a call to the `updatePlayer` function everywhere that handles player movement.

If we did everything correctly, you should see your server printing out the players coordinates as you walk around the map in game. Congratualtions, you have half of a replicating game. Now we need the server to tell the client where everyone else is.

To do this, we will need to add a function the game to recieve messages from the server. This is pretty simple:

```js
function handleMessage(message) {
  console.log(message);
}

window.setupHandler((event) => {
  handleMessage(event.data)
})
```

As you have probably guessed, this will print out any message sent to the server. You'll notice that we pass `event.data` instead of simply `event`. The `event` object returned from the websocket has more information
than we need for this, so we're only interested in the `data` portion, which is the exact message that we get from the server.

Just printing out the message isn't very useful. Let's move the character based on the server messages. It would be better to use binary messages, but for ease of reading, we will just use plaintext. We can indicate
that a message adjusts the players position by using a prefix, and a seperator, followed by the information in the expected format. For the prefix we'll use `position`. We can use a colon for the seperator, as
we don't expect that that will be in any of the data we want to send. The data part can simply be formatted as `x,y`.

Now let's update our `handleMessage` funciton
```js
function handleMessage(message) {
  if(!message) return false;
  if(message.split(':')[0] === 'position') {
    const [x, y] = message.split(':')[1].split(',');
    player.moveTo(parseInt(x, 10), parseInt(y, 10));
  }
  console.log('handled!', player.pos)
  return true;
}
```

Now we need to change the server to send messages to the client. We'll start simple. We'll have the server expect only one client to connect, and track where the player is, and then inform the same client of
where the player has moved to.

First we need to store the player's location, so let's add a variable for that.

```js
const lastLocation = {x: 0, y: 0};
```

We'll define this within the `wss.on('connection', ...)` block, so that the variable is unique per client.

Now let's update our `ws.on('message', ...)` block.

```js
ws.on('message', (message: string[]) => {
  console.log(`Recieved message => ${message}`);
  const messagearr = message.toString().split(',');
  // messagearr now contains the x coord in the first element, and y coord in the second
  const parsedMessage = [parseInt(messagearr[0], 10), parseInt(messagearr[1], 10)];
  console.log(parsedMessage)

  lastLocation.x = parsedMessage[0];
  lastLocation.y = parsedMessage[1];

  // Send location to client
  ws.send(`position: ${parsedMessage[0]},${parsedMessage[1]}`);
});
```

The full code, as we've written it so far, is available [here](https://github.com/Jacob-MacMillan-Software/replicating-js-game-client/tree/8c24124e26f16c9fd31b94d0b4a48ee97630c20e){:target="_blank"} for the client,
and [here](https://github.com/Jacob-MacMillan-Software/replicating-js-game-server/tree/6b31db22b8c581ea2ee86aba25a3209424d7c7e3){:target="_blank"} for the server. However, if you've never done this before, I would
recomend that you type out the code yourself.
[comment]: <> (_)
