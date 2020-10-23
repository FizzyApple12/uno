class StandardUNO {
    constructor(room, parentPlayers) {
        this.room = room;
        this.parentPlayers = parentPlayers;
        global[`gm_${this.room}`] = io.of(`/${room}`);

        this.gameState = {
            turn: 0,
            direction: true,
            started: false,
            currentCard: this.drawCard(false),
            playerData: {}
        };

        global[`gm_${this.room}`].on('connection', socket => {
            let handshakeData = socket.request;
            socket.uuid = handshakeData._query['uuid'];
            console.log(`User ${socket.uuid} connected to game ${room}`);

            if (!this.gameState.playerData[socket.uuid]) {
                if (this.gameState.started) return socket.emit('alreadystarted');

                this.gameState.playerData[socket.uuid] = {
                    cards: this.drawStack(7, true),
                    turn: false
                }
            } 
            
            this.updatedPlayers()

            socket.on('play', card => {
                if (this.play(card, socket.uuid)) this.updatedPlayers();
            });

            socket.on('start', () => {
                // add host check
                this.gameState.started = true;
                this.updatedPlayers()
            });

            socket.on('disconnect', () => {
                console.log(`User ${socket.uuid} disconnected to game ${room}`);

                if (!this.gameState.started) delete this.gameState.playerData[socket.uuid];
            });
        });
    }

    updatedPlayers = () => {
        global[`gm_${this.room}`].emit('players', this.parentPlayers);

        let allUUIDs = Object.keys(this.gameState.playerData);

        for (let uuid of allUUIDs) {
            this.gameState.playerData[uuid].turn = false;
        }
        if (allUUIDs.length > 0) {
            if (this.gameState.turn < 0) this.gameState.turn = allUUIDs.length - 1;
            if (this.gameState.turn >= allUUIDs.length) this.gameState.turn = 0;

            this.gameState.playerData[allUUIDs[this.gameState.turn]].turn = true;

            while (!this.canPlay(this.gameState.playerData[allUUIDs[this.gameState.turn]].cards, this.gameState.currentCard)) {
                this.gameState.playerData[allUUIDs[this.gameState.turn]].cards.push(this.drawCard(true))
            }
        }

        for (let socket of Object.values(global[`gm_${this.room}`].sockets)) {
            socket.emit('playerdata', this.gameState.playerData[socket.uuid]);
        }

        let filteredGameState = JSON.parse(JSON.stringify(this.gameState));
        delete filteredGameState.playerData;
        global[`gm_${this.room}`].emit('gamestate', filteredGameState);
    }

    play = (card, uuid) => {
        if (this.validatePlay(card, this.gameState.currentCard)) {
            if (!this.gameState.playerData[uuid]) return
            if (!this.gameState.playerData[uuid].turn) return
            if (!this.includesCard(this.gameState.playerData[uuid].cards, card)) return
            
            let allUUIDs = Object.keys(this.gameState.playerData);
            
            this.gameState.playerData[uuid].cards.splice(this.indexOfCard(this.gameState.playerData[uuid].cards, card), 1);
            this.gameState.currentCard = card;

            if (this.gameState.playerData[uuid].cards.length <= 0) this.win(uuid);
            
            if (card[2] == 'reverse') this.gameState.direction = !this.gameState.direction;

            let skipModifiers = [ 'draw2', 'skip', 'draw4' ];

            if (this.gameState.direction) {
                this.gameState.turn++;
                if (this.gameState.turn >= allUUIDs.length) this.gameState.turn = 0;
            } else {
                this.gameState.turn--;
                if (this.gameState.turn < 0) this.gameState.turn = allUUIDs.length - 1;
            }

            if (card[2] == 'draw2') this.gameState.playerData[allUUIDs[this.gameState.turn]].cards.push(...this.drawStack(2, true))
            if (card[2] == 'draw4') this.gameState.playerData[allUUIDs[this.gameState.turn]].cards.push(...this.drawStack(4, true))

            if (this.gameState.direction) {
                if (skipModifiers.includes(card[2])) this.gameState.turn++;
                if (this.gameState.turn >= allUUIDs.length) this.gameState.turn = 0;
            } else {
                if (skipModifiers.includes(card[2])) this.gameState.turn--;
                if (this.gameState.turn < 0) this.gameState.turn = allUUIDs.length - 1;
            }
    
            while (!this.canPlay(this.gameState.playerData[allUUIDs[this.gameState.turn]].cards, this.gameState.currentCard)) {
                this.gameState.playerData[allUUIDs[this.gameState.turn]].cards.push(this.drawCard(true))
            }
            return this.gameState.started;
        } else return false
    }

    win = (uuid) => {
        let winnerName = 'error';
        if (this.parentPlayers[uuid]) winnerName = this.parentPlayers[uuid].name;
        global[`gm_${this.room}`].emit('winner', winnerName);

        for (let uuid of Object.keys(this.gameState.playerData)) {
            this.gameState.playerData[uuid].cards = this.drawStack(7, true);
        }

        this.gameState = {
            turn: 0,
            direction: true,
            started: false,
            currentCard: this.drawCard(false),
            playerData: this.gameState.playerData
        }

        this.updatedPlayers();
    }

    includesCard = (array, item) => {
        let includes = false;

        for (let arrayi of array) {
            if (this.cardsEqual(arrayi, item)) includes = true;
        }

        return includes
    }

    indexOfCard = (array, item) => {
        for (let i = 0; i < array.length; i++) {
            if (this.cardsEqual(array[i], item)) return i;
        }

        return -1
    }

    cardsEqual = (array1, array2) => {
        return (array1.length == array2.length && array1.every((val, i) => val === array2[i])) || (array1[0] > 0 && array1[0] == array2[0]);
    }

    validatePlay = (card, deck) => {
        let modifiers = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'draw2', 'reverse', 'skip', 'wild', 'draw4' ];
        if (card[0] < 0  || card[0] > 2) return false;
        if (!modifiers.includes(card[2])) return false;
        return (card[0] > 0 || card[1] == deck[1] || card[2] == deck[2]);
    }

    canPlay = (cards, deck) => {
        let canPlay = false;

        for (let card of cards) {
            if (this.validatePlay(card, deck)) canPlay = true;
        }

        return canPlay;
    }
    
    drawCard = (includeSpecialty) => {
        let modifiers = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'draw2', 'reverse', 'skip' ];
        let card = [ 0, Math.floor(Math.random() * 4), modifiers[Math.floor(Math.random() * modifiers.length)] ];
        if (!includeSpecialty) return card;
        let typeRNG = Math.random() * 108;
        if (typeRNG < 4) card = [1, 4, 'wild'];
        else if (typeRNG < 8) card = [2, 4, 'draw4'];
        return card;
    }

    drawStack = (number, includeSpecialty) => {
        let cards = [];
        for (let i = 0; i < number; i++) {
            cards.push(this.drawCard(includeSpecialty));
        }
        return cards
    }
}

module.exports = StandardUNO;