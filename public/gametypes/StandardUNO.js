class StandardUNO {
    constructor() {
        this.cards = [new Card(0, 0, '0')];
        this.players = {};
        this.topCard = new Card(0, 0, '0');
        this.modalWild = false;
        this.winner = '';
        this.turn = false;
        this.turnNum = 0;
        this.started = false;
        this.direction = true;

        this.waitMessage = '(Waiting for the Host to start the game...)';
        this.playCardMessage1 = '(Waiting on';
        this.playCardMessage2 = 'to play a card...)';
        this.currentPlayerName = '';

        gameSocket.on('playerdata', data => {
		    this.cards = [];
		    for (let card of data.cards) {
		    	this.cards.push(new Card(...card));
            }
            this.turn = data.turn;
        });

        gameSocket.on('gamestate', state => {
            this.topCard = new Card(...state.currentCard);
            this.turnNum = state.turn;
            this.started = state.started;
            this.direction = state.direction;
            for (let i = 0; i < Object.keys(this.players).length; i++) {
                this.players[Object.keys(this.players)[i]].turn = (i == this.turnNum);
                if (i == this.turnNum) this.currentPlayerName = this.players[Object.keys(this.players)[i]].name;
            }
        });
        
        gameSocket.on('players', players => {
            let playersFixed = players;
            for (let i = 0; i < Object.keys(playersFixed).length; i++) {
                playersFixed[Object.keys(playersFixed)[i]].turn = (i == this.turnNum);
                if (i == this.turnNum) this.currentPlayerName = playersFixed[Object.keys(playersFixed)[i]].name;
            }
            this.players = playersFixed;
	    });
        
        gameSocket.on('alreadystarted', () => {
            window.location.assign('/');
	    });
        
        gameSocket.on('winner', name => {
            this.winner = name;
            $('#winnerModal').modal();
	    });
    }

    start = () => {
        if (!data.host) return;
        gameSocket.emit('start');
    }

    play = (card) => {
        if (card[1] < 4) {
            $('#colorModal').modal('hide');
            return gameSocket.emit('play', card);
        }
        this.modalWild = (card[0] == 1);
        $('#colorModal').modal();
    }
}

class Card {
    constructor(type, color, modifier) {
        this.type = type;
        this.color = color;
        this.modifier = modifier;

        this.colorNames = ['_red', '_yellow', '_green', '_blue', '']
    }

    getImage() {
        switch (this.type) {
            case 0:
                return `/assets/cards/uno${this.colorNames[this.color]}_${this.modifier}.svg`
            case 1:
                return `/assets/cards/uno_wild${this.colorNames[this.color]}.svg`
            case 2:
                return `/assets/cards/uno_draw4${this.colorNames[this.color]}.svg`
        }
	}
	
	play() {
		socket.emit("playcard", [ this.type, this.color, this.modifier ])
	}
}