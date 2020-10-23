var vue;
var socket;

var data = {
	games: []
}

$(document).ready(() => {
	vue = new Vue({
		el: '.fullscreen',
		data: data
	});

	data.uuid = localStorage.getItem('uuid');

	socket = io({ query: `uuid=${data.uuid}` });
	
	socket.on('games', games => {
		data.games = games;
	});

	socket.on('uuid', uuid => {
		localStorage.setItem('uuid', uuid);
		data.uuid = uuid;
	});

	$('.mdb-select').materialSelect();
});

const startGame = () => {
	socket.emit("startgame", $('#gameMode')[0].value, $('#privateGame')[0].checked, code => {
		window.location.assign(`/game/${code}`);
	});
}