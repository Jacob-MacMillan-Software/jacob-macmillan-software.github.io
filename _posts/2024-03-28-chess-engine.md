---
layout: post
title: Making a Simple Chess Engine
categories: guide chess
---

# Chess Engines

If you're reading this, you probably know, but a chess engine is simply a computer program that can calculate chess moves. It can calculate very bad moves, like [worstfish](https://lichess.org/@/WorstFish){:target="_blank"}{:rel="noopener noreferrer"}
or the chess engine we will make in this guide, or it can be very good like [Stockfish](https://github.com/official-stockfish/Stockfish){:target="_blank"}{:rel="noopener noreferrer"} or AlphaZero.

# Resources

There are many chess engines in the world, and many programmers who make chess engines, so there's a lot of resources on how to make them. One of the most useful is probably
[chessprogramming.org](https://chessprogramming.org){:target="_blank"}{:rel="noopener noreferrer"}, which is essentially Wikipedia for chess programming. It has pages explaining pretty much everything you'll need to make a chess engine, most importantly, it explains the various
techniques and algorithms for move searching and evaluation.

I also made use of [this](https://wbec-ridderkerk.nl/html/UCIProtocol.html){:target="_blank"}{:rel="noopener noreferrer"} site, as it provides a very good reference for UCI, which stands for "Universal Chess Interface", which is a standardized
protocol (one of a few) that chess engines use to talk to chess clients. Without UCI (and the other chess communication protocols) each chess engine would need to make it's own client, and any
other programs that want to use the chess engine would need to make a custom implementation for each engine they want to use, which is obviously unacceptable. With this, as long as the client and the
engine support UCI, they'll be compatible. The developer of the client doesn't need to have ever even heard about the engine and vice-versa.

I found it to be annoying to write a UCI implementation each time I try my hand a new chess engine, and I was unable to find a pre-built implementation, so I built my own. You can write
your own too. It is fairly simple to implement, but if you don't want to, my implementation is available [here](https://github.com/Jacob-MacMillan-Software/python_chess_interface){:target="_blank"}.

# Making the engine

For this guide, we're going to write a chess engine in Python. There's not really any reason for that, aside from that I want to use Python for this, and the UCI implementation I wrote is written in Python,
and I don't feel like writing another one.

Ok, so let's start by making a program for two humans to play chess. We won't make a GUI, and we'll ignore UCI for now. Our chess player will just be a text interface that displays an ASCII representation of the
chess board, takes text input as a move, draws the new board, and then waits for text input from the other player, until the game is over.

So, how do we do that?

## Representing the board

The first thing the program needs to do is draw a chess board, so lets start with that. We'll just use the same letters to represent the pieces as is used in algebraic chess notation: `K` for King, `Q` for
Queen, `N` for kNight, `R` for Rook, and `B` for Bishop. In algebraic notation, you don't put any symbol for pawns, so we'll use `P` for pawn. Upper case
letters will represent a white piece, and a lowercase letter will be a black piece. A `.` will be an empty space. So a chess board will look like this:
```
r n b q k b n r
p p p p p p p p
. . . . . . . .
. . . . . . . .
. . . . . . . .
. . . . . . . .
P P P P P P P P
R N B Q K B N R
```

We'll assign each square a number which we'll use to keep track of what piece is on which square. We can us an 8x8 matrix (2D list/array) to represent this, but it's simpler to just use a single
list and store 64 values. So let's do that.

```python
board = ['R', 'N', 'B', 'K', 'Q', 'B', 'N', 'R'] + ['P' for _ in range(8)] + ['.' for _ in range(8*4)] + ['p' for _ in range(8)] + ['r','n','b','k','q','b','n','r'] 
```

and then we can print it out with
```python
count = 0
for sq in board[::-1]:
    if count % 8 == 0:
        print()
    print(sq, end=" ")
    count += 1
```

You've probably noticed that the list is reversed. That's because we want the square `a1` to be at index `0`. We'll come back to this soon.

## Making moves

Ok, so now let's play a move. We can get input with something as simple as

```python
move = input()
```

But what do we do with that? Let's say that the first move is the very common `e5`. That's great, but how do we move the pawn? We know it's a pawn move because the piece that is moved isn't specified, and we know where the pawn needs to go, but we aren't told which pawn to move. We know it must be the pawn on `e2` because that's the only pawn that can move to `e5`, but how do we tell our program
that? We could write some code to figure that out. It would be pretty simple, actually, but it gets more complicated when there are more move options. So, instead of dealing with that, let's just
make the user tell us. Instead of the normal algebraic notation used for chess, we'll use a more specific notation. The user will tell us what square the piece they want to move is on and what square they
want it to go to.

So, instead of just typing `e5` the user would need to type `e2e5`.

This is also much easier to parse. The first two characters will always be the coordinates of the square to move the piece from, and the second two characters will be the coordinates of the square to move the piece to.

```python
from_square = move[0:2]
to_square = move[2:]
```

Cool, but we can't index a list using just `e2` and `e5`. As mentioned earlier, `a1` is `0`, so `b1` will be `1`, `c1` is `2`, and so on. `a` in ASCII is `97`, so we can get the index with this:
```python
from_square = (ord(move[0:1].lower()) - 97) + ((int(move[1:2]) - 1) * 8)
to_square = (ord(move[2:3].lower()) - 97) + ((int(move[3:4]) - 1) * 8)
```

And then to move the piece to that square, we can simply do
```python
board[to_square] = board[from_square]
board[from_square] = '.'
```

This is just one option to use to store the chess board. It does have some downsides. It uses a list of 64 strings, which are generally harder to work with than numbers. If we want to know where every pawn is on the board,
we need to loop through the entire list and check if the value is a `P` or a `p`. There is a better way, that's more common, called a bitboard.

## Bitboards

Bitboards are essentially just lists, but smaller. As the name implies, a bitboard is a board made up of bits. An entire chess board shown as a bitboard can be represented as

```
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0
1 1 1 1 1 1 1 1
1 1 1 1 1 1 1 1
```

This is just a binary number that I wrote out in a fancy way. It's `18446462598732906495` in decimal.

A `1` means that there is something there, and a `0` means that there is not. This on it's own isn't very useful, except to know which squares have pieces and which don't. So instead of just one bitboard,
we use at least 8. One for each of pawn, knight, bishop, rook, queen, and king, and then two more to denote the colour of that piece.

As you can see, these bitboards are effectively just lists of bits. However, even though you need more of them, you only need to store 8 numbers, instead of 64 strings, so much smaller.
You can also get information through bitwise operations on the bitboards, which is very useful.

You should note that this works perfectly, because a chessboard has 64 squares, which is the same number of bits that an integer uses in Python, and in general on 64 bit systems.

We can make moves in the same way too.

```python
import sys

# Construct bitboards
bishops = 2594073385365405732
rooks = 9295429630892703873
knights = 4755801206503243842
pawns = 71776119061282560
kings = 1152921504606846992
queens = 576460752303423496

bitboards = [bishops, rooks, knights, pawns, kings, queens]

move = input()

from_square = (ord(move[0:1].lower()) - 97) + ((int(move[1:2]) - 1) * 8)
to_square = (ord(move[2:3].lower()) - 97) + ((int(move[3:4]) - 1) * 8)

# Check what piece is being moved
index = 0
max_index = len(bitboards)
while index < max_index
    board = bitboards[index]
    if (1 << from_square) & board:
        # This is the board we want to move on

        # Change the bit of the from_square to 0
        board &= sys.maxsize ^ (1 << from_square)

        # Change the bit of the to_square to 1
        board |= 1 << to_square

        bitboards[index] = board
        break

    index += 1
```

You've (hopefully) noticed a lot of problems with this example, but this is the basic way that piece movement works on bitboards. First thing that you'll notice is that there is no bitboard for white
and black pieces, so we have no way of knowing what piece is which colour. This isn't needed in our example, as we don't bother to check if a move is legal. Of course, if you were to use this for
your chess engine, you would need to implement move validation, otherwise you can move any piece to any square, regardless of the piece, multiple pieces can be on the same square (as long as they're of different
types), and you can capture your own pieces.

### Explaining the bitwise operations

In this section I'll explain the bitwise operations. They're not relevant to the rest of this guide, so if you already know how they work, or you don't care, feel free to skip to the [next section](#dont-write-your-own-board).

I'll explain from top to bottom.

```python
if (1 << from_square) & board:
```

This checks if the piece exists on the board. In chess only one piece can be on a given square, so we can assume that the first instance of a piece we find on that square is what we're looking for (even
though that's not necessarily true with the above implementation).

You can think of `(1 << from_square) & board` as the equivalent to `board[from_square] != '.'`. So, the condition is `True` iff there is a piece on the square. Why `(1 << from_square) & board` behaves that way is
more apparent if you look at the binary representation of each part.

```python
>>> bin(1 << from_square)
'0b1000000000000'
>>> bin(pawns)
'0b11111111000000000000000000000000000000001111111100000000'
```

If you count the number of `0`s in the first result, you'll also see that the `1` at the end aligns with a `1` in `bin(pawns)`, so the bitwise AND of both values will contain a `1` bit at some point. It doesn't matter where. If there is at least a single non-zero bit, the condition will be `True`. Because there can only be one piece on the square, the same operation with every other bitboard will be `0`, so the condition would be `False`.

Next is

```python
board &= sys.maxsize ^ (1 << from_square)
# Which is equivalent to
board = board & (sys.maxsize & (1 << from_square))
```

This is more complicated, but still pretty simple. `sys.maxsize` is simply the largest possible 64 bit value. That means the bitboard it makes is simply all `1` bits. We want to set the bit to zero though, not one, so we need whatever bit represents the piece we're moving to be zero, and every other bit to be one, so it doesn't remove any other pieces. To do this we do a bitwise XOR with `^`. Any bit in `1 << from_square` that is one will be flipped to zero in the result of the XOR operation. We then do a bitwise AND with the bitboard. This will change the `from_square` bit to `0` and leave every other bit unchanged. This is the equivalent to the list operation we did before:

```python
board[from_square] = '.'
```

And last but not least, we have the bitwise operation

```python
board |= 1 << to_square
# Which is equivalent to
board = board | (1 << to_square)
```

This one is pretty simple. It sets the bit on `to_square` to `1`, indicating that the piece is now there.

## Don't write your own board

I mentioned before that the example is missing a lot, notably checking if the move is even legal. Thankfully, we don't need to write that, as there are many people who already have. Despite this, it is still
very useful to know how they work. For this guide we'll be using the aptly named [chess](https://pypi.org/project/chess/){:target="_blank"}{:rel="noopener noreferrer"}.

As it says on the PyPi page, you can use it like this:

```python
import chess

# Create a new board
board = chess.Board()

# List all legal moves
print(board.legal_moves)

# Make a move using standard algebraic notation
board.push_san("e5")

# Make a move using the move notation we've been using in this guide (called UCI notation)
board.push("e2e5")

# Display the current board
print(board)
```

As you can see, this is much simpler than writing this all ourselves.

So, lets finally make the two player chess program. With this library, it's pretty simple.

```python
import chess

board = chess.Board()

while not board.is_game_over():
    print(board)

    move = None
    while not move:
        print("Legal moves: ", board.legal_moves)
        if board.turn:
            move = input("White move: ")
        else:
            move = input("Black move: ")

        try:
            board.push_san(move)
        except chess.IllegalMoveError:
            move = None

print(chess.outcome())
```

That's all you need for a full two player chess game. Really, you don't even need that much. You could do it with less code if you don't print out legal moves, or bother to check for errors when
pushing the move to the board.

The only thing that might not be straight forward or immediately clear is `board.turn`. This, as the name suggests, denotes who's turn it is. It is `True` if it is white's turn, and `False` if it
is black's turn.

Also potentially of note: with `board.push_san` you can provide the move in either of the two move formats we've discussed.

## Making the engine

We're not here to just make a two player chess game though. We're here to make a chess engine. So, let's replace one of the two players with a bot.

```python
import chess
import random

def gen_best_move(board: chess.Board, time_limit: int, depth: int) -> chess.Move:
    # We'll just pick a random move for now
    return random.choice(list(board.legal_moves))

board = chess.Board()

while not board.is_game_over():
    print(board)

    move = None
    while not move:
        print("Legal moves: ", board.legal_moves)
        if board.turn:
            move = input("White move: ")
        else:
            move = gen_best_move(board, 5000, 2)

        try:
            board.push_san(move)
        except chess.IllegalMoveError:
            move = None

print(chess.outcome())
```

Now you can play against a bot. A very bad bot, most likely, but perhaps by some act of God it'll chose the best move every time. Probably not. This bot probably sucks.
You'll notice it takes three arguments: `board`, `time_limit`, and `depth`. `board` and `time_limit` are pretty self-explanatory, but I'm going to explain anyway. `board` contains the game board.
`time_limit` is the maximum amount of time that the move selection should take, specified in milliseconds. This is a requirement for supporting UCI. `depth` may not be as
obvious. It is also required for proper UCI support, but more importantly, similar to `time_limit` it tells the engine how long to search for. The difference is instead of specifying a time limit, the
`depth` tells the engine how many moves to search. In this example, `depth` is 2, so a proper move search algorithm (ie. not random) would evaluate two moves 'deep'. This means it will evaluate the position after simulating 2 moves, rather than just one. This will be more clear as we look at move search algorithms.

## Searching for the best move

There's many ways to search for the best move, some better than others. Some faster. Some find a better move, but take much longer to get there. For this guide we're going to focus on a single search algorithm called "negamax", but I would recommend exploring [chessprogramming.org](https://chessprogramming.org){:target="_blank"}{:rel="noopener noreferrer"} to find better algorithms and get some ideas to make your own.

Negamax is a very simple algorithm, but it's good enough for our chess engine.

```
from time import time
import random
import math
import chess

def evaluate(board: chess.Board) -> int:
    return random.randint(-1000, 1000)

def negamax(board: chess.Board, end_time: int, depth: int) -> int:
    # If depth is 0 or the time limit has expired, evaluate the position and return that value
    if depth == 0 or time() >= end_time:
        return evaluate(board)

    best_score = -math.inf

    # loop through every possible move
    for move in board.legal_moves:
        # simulate the move
        board.push(move)

        # evaluate one depth down
        score = -negamax(board, end_time, depth - 1)

        board.pop() # Un-simulate move

        best_score = max(score, best_score)

    return best_score
```

The first thing you'll notice is that `evaluate` just returns a random number. Later this function will return a number based on the actual position, but we'll work on that later. Let's focus on the move search for
now.

As you can see, Negamax is a recursive algorithm, meaning it calls itself. This is how it evaluates at depths more than just 1. It's pretty simple: it loops through every possible move, and then calls itself,
passing the new position, and a depth of one less than it itself was set to search, and negates the value (hence the name). After that it compares the newly computed position's score to the current best
score, and if it's higher it saves it. After looping through all the moves it returns the best score. Notably this function does not return the best move. The reason why will become clear later, but for now
just be aware that this function only returns a score. You can write your version of the function to return the move as well, but this is slightly more complicated.

The reason we need to negate the value of `negamax` each cycle is because in chess you take turns playing, therefore the next iteration is actually the score for the opposite colour. Because of how the evaluation
function will work, the score for one side will be exactly the score for the other times `-1`.

## Evaluating the position

The next step is to perform the evaluation of the position. There's many methods to do this, and many aspects we can use to score the position, and then still, even more methods we can use to
represent that score.

For this guide, we're going to use simple piece value scoring, and we will score all the pieces in numbers of pawns that they are worth. It is common to use 'centipawns' (1/100th of a pawn) as the base
unit too, but the exact unit we use matters very little, as long as we're consistent with it.

So, we'll assign each piece a value. We'll use the standard piece values, but you can adjust these if you find certain values make the engine better.
A queen is worth 9 points, rooks are 5, bishops and knights are 3, and pawns, of course, are 1 point. What about the king? You can't capture the king, so normally it doesn't need a score.
In fact, in our engine, it won't need a score either, however, we will give it one anyway, as it is useful with other evaluation methods. It is very arbitrary what value the king gets, but for this
example we'll say it's worth 10000 pawns. By convention, white pieces have positive values, and black pieces have negative values.

Here is our evaluation function:

```python
import chess

def evaluate(board: chess.Board) -> int:
    score = 0

    # Loop through each square, and add to the score for each piece
    for square in board.piece_map():
        value = 0
        piece = board.piece_at(square)
        match piece.piece_type:
            case chess.PAWN:
                value = 1
            case chess.KNIGHT:
                value = 3
            case chess.BISHOP:
                value = 3
            case chess.ROOK:
                value = 5
            case chess.QUEEN:
                value = 9
            case chess.KING:
                value = 10000
        if not piece.color:
            value *= -1
        
        score += value
    
    return score
```

That's all the basics of a chess engine, but we are missing one thing: we don't actually call `negamax`; so let's fix that. We'll change our `gen_best_move` function.

```python
from time import time
import math
import chess

def gen_best_move(board: chess.Board, time_limit: int, depth: int) -> chess.Move:
    end_time = time() + (time_limit / 1000) # / 1000 to convert the ms to seconds

    best_move = None
    best_score = -math.inf

    for move in legal_moves:
        # Simulate move
        board.push(move)

        # Evaluate
        score = -negamax(board, end_time, depth - 1)

        # Un-simulate move
        board.pop()
        
        if score > best_score:
            best_score = score
            best_move = move

    return best_move
```

This is basically the same as `negamax`, except that it returns a move instead of just an evaluation. In fact, if you change `negamax` to return both a move and an evaluation, you don't even need the
extra `gen_best_move` function. I prefer to have the additional function, just because it tends to make the code easier to read when using more complex move search algorithms. Most importantly, you
can use the `gen_best_move` function to perform some setup functions for `negamax` (calculating `end_time`, in this example). As `gen_best_move` is not called recursively, it's generally easier to do it here.

Putting that all together, we now have a very basic chess engine. It should make some moves that are not horrible more than it does. You can run it, and play against it, and
probably win, if you're any good at chess.

## Universal Chess Interface

However, we're still missing one thing. Up until now we've been inputting moves by just typing the move in to `stdin`. We still don't have support for UCI. Technically UCI is still just passing moves in to
`stdin`, but in a way that allows for more things, such as reseting the board, and starting the game at arbitrary positions. It also lets us configure the depth and time limit of the move search at
runtime, instead of having to edit the numbers in the code. And, perhaps most importantly, it also allows us to use other chess clients.

I could teach you how to write your own UCI implementation, like I did for bitboards, but writing the UCI support is my least favourite part of writing a chess engine, and bitboards are one of the things I find most
interesting about them, so I will not be showing you how to write a UCI implementation. It is pretty simple. You can probably figure it out yourself from the UCI specification explanation I linked to in the [resources](#resources) section, or probably from some guide on [chessprogramming.org](https://chessprogramming.org){:target="_blank"}{:rel="noopener noreferrer"} or one of many other websites, I'm sure.

Instead I'll be showing you how to implement the UCI implementation I've already written, and is available for free under the LGPG-3.0 on [my Github](https://github.com/Jacob-MacMillan-Software/python_chess_interface){:target="_blank"}. You can install it like you would any other Python module: using `pip`.

```bash
pip install git+https://github.com/Jacob-MacMillan-Software/python_chess_interface.git
```

If you use `poetry` you can also do
```bash
poetry add git+https://github.com/Jacob-MacMillan-Software/python_chess_interface.git
```

We'll have to change our `gen_best_move`, and `negamax` functions slightly to support this.

```python
from time import time
import math
from queue import Queue
import chess

def gen_best_move(position: str, time_limit: int, depth: int, send_queue: Queue, recv_queue: Queue):
    end_time = time() + (time_limit / 1000) # / 1000 to convert the ms to seconds
    board = chess.Board(position)

    best_move = None
    best_score = -math.inf

    for move in legal_moves:
        # Simulate move
        board.push(move)

        # Evaluate
        result = negamax(board, end_time, depth - 1, recv_queue)
        score = -result[0]

        # Un-simulate move
        board.pop()
        
        if score > best_score:
            best_score = score
            best_move = move

        # Check for stop command
        if result[1]:
            break

        if not recv_queue.empty():
            if recv_queue.get() == "stop":
                break

    print("bestmove", best_move)

def negamax(board: chess.Board, end_time: int, depth: int, recv_queue: Queue) -> (int, bool):
    # If depth is 0 or the time limit has expired, evaluate the position and return that value
    if depth == 0 or time() >= end_time:
        return (evaluate(board), False)

    best_score = -math.inf
    forced_stop = False

    # loop through every possible move
    for move in board.legal_moves:
        # simulate the move
        board.push(move)

        # evaluate one depth down
        result = negamax(board, end_time, depth - 1, recv_queue)
        score = -result[0]

        board.pop() # Un-simulate move

        best_score = max(score, best_score)

        if result[1]:
            forced_stop = True
            break

        if not recv_queue.empty():
            if recv_queue.get() == "stop":
                break

    return (best_score, forced_stop)
```

There's a few differences, but the functions remain mostly unchanged. The `gen_best_move` function now takes two additional parameters: two `Queue`s. The `send_queue` is unused in this example, but it can
be used to send messages to the UCI class. The `recv_queue` is used to receive messages from the UCI. In this example it only accepts one command, `stop`, but there are other commands,
such as setting options to change how the engine works, or possibly even change the type of chess that the engine plays, or whatever else you want to allow to be changed at runtime. The `gen_best_move` function also
no longer returns any value. Instead it prints out 'bestmove' followed by the move in UCI format. This is what clients that interact with UCI expect. This tells them what move the engine wants to play.

You'll also notice that the `board` parameter has been changed from a `chess.Board` to a `str` and renamed `position`. This is simply because UCI accepts the position as a string called a `FEN` followed by a list
of moves. The UCI class I wrote converts this to just a FEN (with the moves made), and passes that FEN string to the `gen_best_move` function.

`negamax` has also been changed. It now returns a tuple, and it takes an additional parameter: `recv_queue`. The queue, of course, is used in the same way as in `gen_best_move` as it is the same queue. The client
interacting via the UCI can send a `stop` command at any time, after which it expects the engine to stop searching for moves and return the best move it has found so far. The tuple is used to propagate this `stop`
command up through the recursive calls.

The last thing we need to do is actually start the UCI:

```python
interface = UCI(gen_best_move)
while True:
    try:
        command = interface.read()
    except KeyboardInterrupt:
        exit(0)
```

That code will replace our previous move input code.

So, now we have the following:

```python
from time import time
import math
from queue import Queue
import chess

def gen_best_move(position: str, time_limit: int, depth: int, send_queue: Queue, recv_queue: Queue):
    end_time = time() + (time_limit / 1000) # / 1000 to convert the ms to seconds
    board = chess.Board(position)

    best_move = None
    best_score = -math.inf

    for move in legal_moves:
        # Simulate move
        board.push(move)

        # Evaluate
        result = negamax(board, end_time, depth - 1, recv_queue)
        score = -result[0]

        # Un-simulate move
        board.pop()
        
        if score > best_score:
            best_score = score
            best_move = move

        # Check for stop command
        if result[1]:
            break

        if not recv_queue.empty():
            if recv_queue.get() == "stop":
                break

    print("bestmove", best_move)

def evaluate(board: chess.Board) -> int:
    score = 0

    # Loop through each square, and add to the score for each piece
    for square in board.piece_map():
        value = 0
        piece = board.piece_at(square)
        match piece.piece_type:
            case chess.PAWN:
                value = 1
            case chess.KNIGHT:
                value = 3
            case chess.BISHOP:
                value = 3
            case chess.ROOK:
                value = 5
            case chess.QUEEN:
                value = 9
            case chess.KING:
                value = 10000
        if not piece.color:
            value *= -1
        
        score += value
    
    return score

def negamax(board: chess.Board, end_time: int, depth: int, recv_queue: Queue) -> (int, bool):
    # If depth is 0 or the time limit has expired, evaluate the position and return that value
    if depth == 0 or time() >= end_time:
        return (evaluate(board), False)

    best_score = -math.inf
    forced_stop = False

    # loop through every possible move
    for move in board.legal_moves:
        # simulate the move
        board.push(move)

        # evaluate one depth down
        result = negamax(board, end_time, depth - 1, recv_queue)
        score = -result[0]

        board.pop() # Un-simulate move

        best_score = max(score, best_score)

        if result[1]:
            forced_stop = True
            break

        if not recv_queue.empty():
            if recv_queue.get() == "stop":
                break

    return (best_score, forced_stop)

if __name__ == "__main__":
    print("Chess Engine Example by Jacob MacMillan Software Inc.")
    interface = UCI(gen_best_move)
    while True:
        try:
            command = interface.read()
        except KeyboardInterrupt:
            exit(0)
```

And that's it. You now have a chess engine. If you want, you can open up your preferred chess GUI (assuming it has UCI support) and use it to play against you're newly created engine. Enjoy!

If you have any questions or comments, please feel free to email me at [me@jacobmacmillan.xyz](mailto:me@jacobmacmillan.xyz){:target="_blank"}.
