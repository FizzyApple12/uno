var vue;
var socket;
var gameSocket;

var data = {
	uuid: "",
	host: false,
	gameCode: window.location.pathname.split('/')[2],
	gamemodes: [ StandardUNO ],
	gametemplates: [ 'StandardUNO.html' ],
	gameObject: null,
	name: "player"
}

$(document).ready(() => {
	vue = new Vue({
		data: data
	});

	data.uuid = localStorage.getItem('uuid');

	socket = io({ query: `uuid=${data.uuid}` });

	socket.on('uuid', uuid => {
		localStorage.setItem('uuid', uuid);
		data.uuid = uuid;
	});

	socket.emit('joingame', data.gameCode, (redirect, host, mode) => {
		if (redirect) window.location.assign('/')
		data.host = host;
		gameSocket = io(`/${data.gameCode}`, { query: `uuid=${data.uuid}` });
		data.gameObject = new (data.gamemodes[mode])();
		$(`#gameContainer`).load(`/gametypes/${data.gametemplates[mode]}`, () => {
			vue.$mount('.fullscreen')
            $('#nameModal').modal();
		});
	});
});

const updatePlayerData = () => {
	socket.emit('updateinfo', data.name);
}