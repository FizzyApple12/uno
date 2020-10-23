const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').Server(app);
global.io = require('socket.io')(http);
const uuid = require('uuid');
var readline = require('readline');

const StandardUNO = require('./StandardUNO.js');

const gamemodes = [ StandardUNO ];

var games = {};

app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/game/:gameid', (req, res) => {
    res.sendFile(__dirname + '/public/game.html');
});

app.use("/", express.static(__dirname + '/public'));

io.on('connection', socket => {
    let handshakeData = socket.request;
    socket.uuid = handshakeData._query['uuid'];
    socket.currentGame = "";
    console.log(`User ${handshakeData._query['uuid']} connected`);

    if (!uuid.validate(handshakeData._query['uuid'])) {
        socket.uuid = uuid.v4();
        socket.emit('uuid', socket.uuid)
    }

    sendOutGames();

    socket.on('startgame', (gamemode, private, callback) => {
        gamemode = parseInt(gamemode);
        let gamecode = generateGameID();
        let newGame = {
            host: '',
            players: {},
            code: gamecode,
            public: !private,
            gamemode: gamemode,
            gameClass: null
        }
        games[newGame.code] = newGame;
        newGame.gameClass = new (gamemodes[gamemode])(gamecode, newGame.players)
        callback(newGame.code);

        sendOutGames();
    });

    socket.on('joingame', (gamecode, callback) => {
        if (games[gamecode] == undefined) return callback(true, false, 0);
        socket.join(gamecode);
        socket.currentGame = gamecode;
        let isHost = false
        if (Object.keys(games[gamecode].players).length == 0) isHost = true;
        games[gamecode].players[socket.uuid] = {
            uuid: socket.uuid,
            sid: socket.id,
            name: ''
        };
        if (isHost) games[gamecode].host = socket.uuid;
        games[gamecode].gameClass.updatedPlayers();
        callback(false, isHost, games[gamecode].gamemode);

        sendOutGames();
    });

    socket.on('updateinfo', (name) => {
        if (socket.currentGame != "") {
            games[socket.currentGame].players[socket.uuid].name = name;
            
            games[socket.currentGame].gameClass.updatedPlayers();

            sendOutGames();
        }
    })
    
    socket.on('disconnect', () => {
        console.log(`User ${handshakeData._query['uuid']} disconnected`);
        if (socket.currentGame != "") {
            delete games[socket.currentGame].players[socket.uuid];
            games[socket.currentGame].gameClass.updatedPlayers();
            if (Object.keys(games[socket.currentGame].players).length < 1) {
                delete games[socket.currentGame];
            }
        }
        socket.leaveAll();

        sendOutGames();
    });
});

const sendOutGames = () => {
    let publicGames = Object.values(games).filter(game => game.public);
    io.emit('games', publicGames);
}

const generateGameID = () => {
    let time = new Date().getTime();
    let uuid = 'xxxxxxxx'.replace(/[x]/g, c => {
        let r = (time + Math.random() * 16) % 16 | 0;
        time = Math.floor(time / 16);
        return (c == 'x' ? r :(r&0x3 | 0x8)).toString(16);
    });
    return uuid;
}

http.listen(80, () => {
    console.log('listening on *:80');
});

var readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function fixStdoutFor(cli) {
    var oldStdout = process.stdout;
    var newStdout = Object.create(oldStdout);
    newStdout.write = function() {
        cli.output.write('\x1b[2K\r');
        var result = oldStdout.write.apply(
            this,
            Array.prototype.slice.call(arguments)
        );
        cli._refreshLine();
        return result;
    }
    process.__defineGetter__('stdout', function() { return newStdout; });
}

fixStdoutFor(readlineInterface)

readlineInterface.question("> ", (input) => {
    console.log(eval(input))
    
});