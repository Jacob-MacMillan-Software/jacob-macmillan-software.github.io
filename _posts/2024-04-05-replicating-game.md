---
layout: post
title: Making a game replicate
categories: guide video-games
---

# Replicating Video Games

I have a lot of experience in video games. Both playing, and creating. I've played hundreds of games, and developed several, both commercial and just as a hobby. Most of the hobby ones aren't open source, and none of the commercial ones are, but a game I worked on for Global Game Jam 2019 is open source, and you can find it on GitHub [here](https://github.com/MrMcGoats/Global-Game-Jam-2019){:target="_blank"} , if you're interested. However, the repo for the game engine I used, Angel2D, is archived, and the exact branch
seems to no longer exist, so it may be difficult to build the game, if you want to actually play it.

You can find more information about my commercial projects on my [about page](/about){:target="_blank"}.

I especially like the more backend aspect of game development. I enjoy the less visual aspects of programming in general.
In that theme, this guide is not about how to make a video game. This guide is about how to make a video game replicate.

## What is replication

So, what is replication? Simply, in the context of video games, it means cloning the game state of one player to that of another player. So, if player A and player B are playing a game together, and player A kills player B's character, it is replication that allows player B to see in his game that he has been killed by player A. Replication is what makes a multiplayer game multiplayer.

## Resources

As this guide is not about how to make a game, you will need to provide your own if you want to follow along with this tutorial. I would recommend a game written in Javascript or Typescript (admittedly, a relatively small subset of open source games), but this guide will be easily applicable in any programming language.

In this guide, we're going to be using the game from a tutorial by jslegend, which can be found [here](https://github.com/JSLegendDev/Pokemon-like-Game-Made-in-Kaboom.js){:target="_blank"}, but you can feel free to use any game you like.

## The server

Since we already have our game, we'll start by making the game server to connect to. This will be what is called an "authoritative server". That means that the server is treated as the authority of truth in the
game world. Whatever the server says happens is what happened, and any rumours to the contrary are ignored and discarded by the game.

There's a few protocols we can use to make this, but we're going to use one called Websockets in our example. Websockets is effectively a message protocol. Similar to a phone call between you
and your mom, the game client opens a "call" (called a "channel") with the server, and they both remain on the call for the duration of the play session. They use the channel to send messages to each other. These
messages will contain information about the game state. They can be things like the client informing the server that the user is trying to move up, or the server informing all the connected clients that another
player has moved to the left.

Depending on the requirements to prevent cheating, and minimum acceptable latency, and things of that nature, the server verifies all actions the client claims to perform before announcing that action to
everyone else who needs to know. Since this is just a demo, we don't really care if anyone cheats, so our server will have very minimal checks on client actions, but we will discuss what could be added
at the end.

You don't have to write the server in the same language as the game, like we will be doing in this tutorial, however it is often easier to write the game and server in the same language, so you can share code between the two.

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

You can connect to this server with your preferred Websocket client and interact with it to see it in action, but it will be more useful to update our game to interact with the server.

I added a new file to the game, that I called `socket.js` which is used to open the connection to the game server. It effectively mirrors what the server does: connects to the server, and passes
messages that it receives to another function to handle.

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

If we did everything correctly, you should see your server printing out the players coordinates as you walk around the map in game. Congratulations, you have half of a replicating game. Now we need the server to tell the client where everyone else is.

To do this, we will need to add a function the game to receive messages from the server. This is pretty simple:

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

Just printing out the message isn't very useful. Let's move the character based on the server messages. It would be better to use some sort of binary encoded messages, but for ease of reading, we will just use plaintext. We can indicate
that a message adjusts the players position by using a prefix, and a separator, followed by the information in the expected format. For the prefix we'll use `position`. We can use a colon for the separator, as
we don't expect that that will be in any of the data we want to send. The data part can simply be formatted as `x,y`.

Now let's update our `handleMessage` function
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
recommend that you type out the code yourself.

If you've done everything correctly, you should see your character gliding around the screen. Or, maybe the game you're building on even still animates the character. If it doesn't, that's normal. The game we're
using only animates the character when it is moved through normal means, but with our new code it just plops the character at the new location. We'll fix this a little later.

Since we're making a replicating game, the server should support multiple clients. If you open another client and move around, you should notice something: it's exactly the same as the first client you
opened. You can't see any other players. Let's fix that next.

## Making it multiplayer

Now that we have a game sending information between the server and multiple clients, but with a separate game state for each client, it should be pretty simple to make the game
multiplayer. We just need to create a game state shared between all clients, instead of being unique to each client. So, what do we need to do to do that?

We need some way to broadcast a message to all clients, to tell them the game state has updated. Let's add a function to do that.

```js
function updateAllClients(message: string) {
  console.log(`Broadcasting message: ${message}`);
}
```

It's a start, but not very useful. We need to loop through each client and send them each `message`, so we'll need to store each client. We can use an array for this. We'll make it a global variable so that it will
be the same for each connection:

```js
const clients = [];
```

and then our broadcast function can be

```js
function updateAllClients(message: string) {
    for (const client of clients) {
      client.send(message)
    }
}
```

and then in our `wss.on('connection', ...)` we'll save each connection to the client array

```js
clients.push(ws)
```

What about when a client disconnects? We'll need to remove it from the array. Finding the exact spot in the array and re-arranging it every time a client disconnects is not very simple though, computationally,
and it'll be hard to maintain the same order of clients on the server and on each client, so let's store the clients like this instead

```js
const clients = {};
```

And we'll give each client a unique key, that we'll call `clientId`. So, to add a new client to the object

```js
const clientId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
clients[clientId] = ws;
```

and our broadcast function body will be changed to

```js
for (const clientId in clients) {
  clients[clientId].send(message)
}
```

And when a client disconnects we simply

```js
delete clients[clientId]
```

Ok, awesome! Now our server can keep track of multiple clients at once, and send messages to each client. We're still missing something though. The clients don't know how many other clients
there are, or where to put each of the other player characters. We'll use our broadcast function for this. We need to broadcast whenever a client connects, disconnect, or when the player on the client
changes location. We'll add two new messages for this: `connected` and `disconnected`. We also need some way to tell each client exactly which client has changed positions, so let's modify our position
message slight too. Instead of just `position:x,y`, we'll include the client ID as well: `clientId:position:x,y`, and, last but not least, we need a message to tell each client what their own ID is. We'll call this `id`.

We will also need to tell the newly connected client about every other client, and then tell every other client about it. Each client also needs to know their own client ID so they know which player is their own.

```js
ws.send(`id:${clientId}`);

for (const otherClientId in clients) {
    if (otherClientId in clients) {
      ws.send(`connected:${otherClientId}`)
    }
}

// Inform all clients of newly connected one
updateAllClients(`connected:${clientId}`);
```

Ok, so after all those changes, our `wss.on('connection', ...)` now looks like this

```js
wss.on('connection', (ws: WebSocket) => {
  // generate client ID
  const clientId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const lastLocation = {x: 0, y: 0}

  // add client to clients object
  clients[clientId] = ws;

  ws.on('message', (message: string[]) => {
    const messagearr = message.toString().split(',');
    const parsedMessage = [parseFloat(messagearr[0]), parseFloat(messagearr[1])];

    lastLocation.x = parsedMessage[0];
    lastLocation.y = parsedMessage[1];

    updateAllClients(`${clientId}:position:${parsedMessage[0]},${parsedMessage[1]}`);
  })

  ws.on('error', (error: Error) => {
    console.log(error);
    delete clients[clientId];

    // Notify all clients of disconnect
    updateAllClients(`disconnected:${clientId}`);
  })

  ws.on('close', () => {
    delete clients[clientId];

    // Notify all clients of disconnect
    updateAllClients(`disconnected:${clientId}`);
  })

  ws.send(`id:${clientId}`);

  for (const otherClientId in clients) {
    if (otherClientId in clients) {
      ws.send(`connected:${otherClientId}`)
    }
  }

  // Inform all clients of newly connected one
  updateAllClients(`connected:${clientId}`);
})
```

You can see all the changes [here](https://github.com/Jacob-MacMillan-Software/replicating-js-game-server/commit/62a3ba045749c8d501d5c5bf79bb422c9b819bb6){:target="_blank"}.

Now if you open the client, if it still works with the updated server, you'll notice it's still the same as before.

The changes are pretty simple. We essentially just need to handle the new messages.

We'll start with the new `id` message, since it's the simplest. This message informs the client of their own ID.
So, we'll start by making a global variable called `clientId` that will store our ID.

```js
let clientId = '';
```

and then we'll add some code to handle the message in our `handleMessage` function

```js
if (message.split(':')[0] === 'id') {
  clientId = message.split(':')[1];
  return true;
}
```

Next we'll change our `position` handling to handle the position of other players. We will handle our own movement slightly differently, but you can handle both together, if you prefer, or if that is easier in the
project that you're working on.

We'll need some way to store the locations of the other players. We'll store it by their client IDs.

```js
cons otherPlayers = {};
```

and then we can handle the message as follows

```js
if (message.split(':')[0] !== clientId && message.split(':')[1] === 'position') {
  const id = message.split(':')[0];
  const [x, y] = message.split(':')[2].split(',');

  // Move player
  otherPlayers[id].moveTo(parseFloat(x), parseFloat(y));

  return true;
}
```

Handling movement of our own player is almost the same

```js
if (clientId && message.split(':')[0] === clientId && message.split(':')[1] === 'position') {
  const [x, y] = message.split(':')[2].split(',');
  player.moveTo(parseFloat(x), parseFloat(y));
  return true;
}
```

The only messages left are `connected` and `disconnected`. When a player connects they'll need a new player entity on each client,
in order to represent that player to every other player. And when they disconnect we need to destroy that entity.

```js
// Handle connections
if (message.split(':')[0] === 'connected') {
  const id = message.split(':')[1];
  
  // Ignore our own connection message
  if (id === clientId) return false;

  // `add` is the function to add new entites to the world in kaboom.js
  otherPlayers[id] = add([
    sprite('player-down'),
    pos(500, 700),
    scale(4),
    area(),
    body(),
    {
      currentSprite: 'player-down',
      speed: 300,
      isInDialogue: false
    }
  ]);

  alert(`${id} has connected!`);
  return true
}

// Handle disconnections
if (message.split(':')[0] === 'disconnected') {
  const id = message.split(':')[1];
  destroy(otherPlayers[id]);
  delete otherPlayers[id];
  alert(`${id} has discnnected!`);
  return true;
}
```

Now if we open our client, we should be able to play with a single player as normal, and then, if everything is working, if you open another game client and connect to the same server,
you should see a message on the original client saying that the new one has connected, and you should see a new player on your map. If you move one player, you should see it move,
almost immediately, on both clients.

You can find the client diff [here](https://github.com/Jacob-MacMillan-Software/replicating-js-game-client/commit/2100f2e266f0912ec819028b54e998ef7b794100){:target="_blank"}.

That's the basics of it. You've now made a singleplayer game into a multiplayer one.

If you notice bugs, that's expected. You probably don't have working animations, and it's unlikely that the players start in the correct location on other player's screens. There's also no verification on the server
side. If the client says it can move outside of the map, then the server just takes its word for it.

Things like these are very important for multiplayer games, but outside the scope of this guide, as the implementation of those is far too specific to the exact game.

Also of note, in this guide we used an authoritative server (although, it's authority is questionable), but you could make a peer to peer multiplayer game with many of the same principles you learned in this guide.
A peer to peer setup has many benefits, but also downsides. In a peer to peer setup, there is no central server, which save a lot on cost to the developer.
Each client simply connects to other clients. Essentially, each client acts as a server. In fact,
you could simply copy the server code to the client, and you will have effectively made a peer to peer multiplayer game. If you want more than two players, or any sort of player discovery system, that will
be more difficult to implement for a peer to peer game, but it is possible. Also worth noting that it is much easier to cheat in a peer to peer game. Since one (or more) of the peers is the `host` (basically
treated the same as an authoritative server) the player using the host can change the game rules to do whatever they want. If allowing this is a deal breaker for your game, peer to peer is not for you.

If you're interested you can see my client and server with many of the bugs fixed [here](https://github.com/Jacob-MacMillan-Software/replicating-js-game-client){:target="_blank"} and [here](https://github.com/Jacob-MacMillan-Software/replicating-js-game-server){:target:"_blank"} respectively.

If you have any questions or comments, please feel free to email me at [me@jacobmacmillan.xyz](mailto:me@jacobmacmillan.xyz){:target="_blank"}.
