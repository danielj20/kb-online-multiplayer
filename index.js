const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const mysql = require('mysql');
var word2num = require('words-to-numbers');
const stringSimilarity = require('string-similarity');

var adjectives = [
	'attractive',
	'bald',
	'beautiful',
	'chubby',
	'clean',
	'dazzling',
	'drab',
	'elegant',
	'fancy',
	'fit',
	'flabby',
	'glamorous',
	'gorgeous',
	'handsome',
	'long',
	'magnificent',
	'muscular',
	'plain',
	'plump',
	'quaint',
	'scruffy',
	'shapely',
	'short',
	'skinny',
	'stocky',
	'ugly',
	'unkempt',
	'unsightly',
];

var nouns = [
	'lizard',
	'bull',
	'anteater',
	'wombat',
	'boar',
	'crow',
	'polar bear',
	'chimpanzee',
	'shrew',
	'fish',
	'camel',
	'pronghorn',
	'mole',
	'finch',
	'basilisk',
	'hyena',
	'yak',
	'skunk',
	'chameleon',
	'chipmunk',
	'frog',
	'badger',
	'ibex',
	'newt',
	'addax',
	'bumble bee',
	'mule',
	'gemsbok',
	'ermine',
];

function newQuestion(callback, room) {
	var category_list = ['geography', 'music', 'science', 'art', 'math', 'history', 'literature'];
	var category = room.toLowerCase();
	var query = 'select * from `Questions` ORDER BY Rand() LIMIT 1';
	if (category_list.includes(category)) {
		query =
			"select * from `Questions` WHERE `Metadata` LIKE '%" +
			category +
			"%' ORDER BY Rand() LIMIT 1";
	}
	var connection = mysql.createPool({
		host: 'host',
		user: 'user',
		password: 'password',
		database: 'database',
		port: 25060,
	});
	connection.query(query, function newQuestion(err, result, fields) {
		callback(JSON.stringify(result));
	});
}

function getNumChars(str) {
	return str.toString().replace(/\D/g, '');
}

function getAlphaChars(str) {
	return str.toString().replace(/[^a-zA-Z]+/g, '');
}

function isNumeric(string) {
	var numConverted = word2num.wordsToNumbers(string);
	return /\d/.test(numConverted);
}

function hasLabel(str) {
	return /[a-zA-Z]/.test(str);
}

function evaluateNumQuestion(guess, answer) {
	var guessNumeric = word2num.wordsToNumbers(guess);
	var answerNumeric = word2num.wordsToNumbers(answer);
	var guessNums = getNumChars(guessNumeric);
	var answerNums = getNumChars(answerNumeric);
	if (!hasLabel(guessNumeric) && !hasLabel(answerNumeric)) {
		if (guessNums === answerNums) {
			return true;
		} else {
			return false;
		}
	} else if (hasLabel(guessNumeric) && !hasLabel(answerNumeric)) {
		if (guessNums === answerNums) {
			return true;
		} else {
			return false;
		}
	} else if (hasLabel(answerNumeric) && !hasLabel(guessNumeric)) {
		if (guessNums === answerNums) {
			return true;
		} else {
			return false;
		}
	} else if (hasLabel(guessNumeric) && hasLabel(answerNumeric)) {
		var guessAlpha = getAlphaChars(guessNumeric);
		var answerAlpha = getAlphaChars(answerNumeric);
		if (guessNums === answerNums) {
			if (stringSimilarity.compareTwoStrings(guessAlpha, answerAlpha) >= 0.65) {
				return true;
			} else {
				return false;
			}
		} else {
			return false;
		}
	}
}

function evaluateQuestion(guess, answer) {
	var sim = 0.0;
	answer = answer.toLowerCase();
	guess = guess.toLowerCase();
	if (isNumeric(answer) || isNumeric(guess)) {
		return evaluateNumQuestion(guess, answer);
	} else {
		answer = answer.replace(')', '');
		if (answer.includes(' (or ')) {
			if (answer.includes(', ')) {
				var first = answer.split(' (or ')[0];
				var seconds = answer.split(' (or ')[1].split(', ');
				seconds.push(first);
				for (var i = 0; i < seconds.length; i++) {
					var acceptableAnswer = seconds[i];
					sim = stringSimilarity.compareTwoStrings(guess, acceptableAnswer);
					if (sim >= 0.65) {
						return true;
					}
				}
				return false;
			} else {
				var seconds = answer.split(' (or ');
				for (var i = 0; i < seconds.length; i++) {
					var acceptableAnswer = seconds[i];
					sim = stringSimilarity.compareTwoStrings(guess, acceptableAnswer);
					if (sim >= 0.65) {
						return true;
					}
				}
				return false;
			}
		} else if (answer.includes(' (')) {
			if (answer.includes(', ')) {
				var first = answer.split(' (')[0];
				var seconds = answer.split(' (')[1].split(', ');
				seconds.push(first);
				for (var i = 0; i < seconds.length; i++) {
					var acceptableAnswer = seconds[i];
					sim = stringSimilarity.compareTwoStrings(guess, acceptableAnswer);
					if (sim >= 0.65) {
						return true;
					}
				}
				return false;
			} else {
				var seconds = answer.split(' (');
				for (var i = 0; i < seconds.length; i++) {
					var acceptableAnswer = seconds[i];
					sim = stringSimilarity.compareTwoStrings(guess, acceptableAnswer);
					if (sim >= 0.65) {
						return true;
					}
				}
				return false;
			}
		} else {
			sim = stringSimilarity.compareTwoStrings(guess, answer);
			if (sim >= 0.65) {
				return true;
			} else {
				return false;
			}
		}
	}
}

function prepare_for_question(room) {
	if (roomsInfo[room]) {
		roomsInfo[room]['canBuzz'] = false;
		roomsInfo[room]['questionDone'] = false;
		endTimeRemaining = 10;
		roomsInfo[room]['endTimeRemaining'] = 10;
		roomsInfo[room]['answerTimeRemaining'] = 10;
		clearInterval(roomsInfo[room]['resumeReadingInterval']);
		clearInterval(roomsInfo[room]['answeringInterval']);
		clearInterval(roomsInfo[room]['endOfAnswerInterval']);
		roomsInfo[room]['buzzQueue'] = [];
		roomsInfo[room]['playersHaveBuzzed'] = [];
		io.to(room).emit('queue changed', roomsInfo[room]['buzzQueue']);
		roomsInfo[room]['readValue'] = 0;
		roomsInfo[room]['readQuestion'] = '';
	}
}

var roomsInfo = {};

function initialize_room(room) {
	roomsInfo[room] = {
		players: {},
		isAnswer: false,
		currentAnswerer: '',
		buzzQueue: [],
		currentQuestion: {},
		unreadQuestion: '',
		readQuestion: '',
		readValue: 0,
		answerTimeRemaining: 10,
		endTimeRemaining: 10,
		playersHaveBuzzed: [],
		questionDone: true,
		buzzedList: [],
		lastSentAnswer: '',
		canBuzz: true,
		resumeReadingInterval: '',
		answeringInterval: '',
		endOfAnswerInterval: '',
	};
}

function random_name() {
	var adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
	var noun = nouns[Math.floor(Math.random() * nouns.length)];
	return adjective + ' ' + noun;
}

function add_player(room, socket_id, name) {
	if (roomsInfo[room]) {
		roomsInfo[room]['players'][socket_id] = {
			name: name,
			points: 0,
			active: true,
		};
		io.to(room).emit('players changed', roomsInfo[room]['players']);
	}
}

function not_blank(message) {
	if (message !== null) {
		if (message.replace(/\s/g, '').length) {
			if (!message.includes('‎')) {
				return true;
			}
		}
	}
	return false;
}

function endOfQuestion(room) {
	if (roomsInfo[room]) {
		roomsInfo[room]['endOfAnswerInterval'] = setInterval(function () {
			if (roomsInfo[room]['endTimeRemaining'] > 0) {
				roomsInfo[room]['endTimeRemaining'] -= 1;
				io.to(room).emit('end of question countdown', roomsInfo[room]['endTimeRemaining']);
			} else {
				roomsInfo[room]['questionDone'] = true;
				if (
					roomsInfo[room]['lastSentAnswer'] === roomsInfo[room]['currentQuestion']['Answer'] ||
					roomsInfo[room]['currentQuestion']['Answer'] === undefined
				) {
					clearInterval(roomsInfo[room]['endOfAnswerInterval']);
					process.exit();
				} else {
					io.to(room).emit('question over', roomsInfo[room]['currentQuestion']);
					roomsInfo[room]['lastSentAnswer'] = roomsInfo[room]['currentQuestion']['Answer'];
					clearInterval(roomsInfo[room]['endOfAnswerInterval']);
				}
			}
		}, 1000);
	}
}

function buzzAttempt(room, socket_id) {
	if (roomsInfo[room]) {
		if (!roomsInfo[room]['questionDone']) {
			if (!roomsInfo[room]['playersHaveBuzzed'].includes(socket_id)) {
				if (!roomsInfo[room]['isAnswer']) {
					if (roomsInfo[room]['canBuzz']) {
						io.to(room).emit('buzz accepted', socket_id);
						roomsInfo[room]['playersHaveBuzzed'].push(socket_id);
						roomsInfo[room]['isAnswer'] = true;
						roomsInfo[room]['currentAnswerer'] = socket_id;
						roomsInfo[room]['answerTimeRemaining'] = 10;
						roomsInfo[room]['buzzQueue'] = roomsInfo[room]['buzzQueue'].filter(
							(element) => element !== socket_id,
						);
						io.to(room).emit('queue changed', roomsInfo[room]['buzzQueue']);
						clearInterval(roomsInfo[room]['startReadingInterval']);
						clearInterval(roomsInfo[room]['resumeReadingInterval']);
						clearInterval(roomsInfo[room]['endOfAnswerInterval']);

						roomsInfo[room]['answeringInterval'] = setInterval(function () {
							if (roomsInfo[room]['answerTimeRemaining'] !== 0) {
								io.to(room).emit('answer countdown', roomsInfo[room]['answerTimeRemaining']);
								roomsInfo[room]['answerTimeRemaining'] -= 1;
							} else {
								clearInterval(roomsInfo[room]['answeringInterval']);
								roomsInfo[room]['isAnswer'] = false;
								roomsInfo[room]['answerTimeRemaining'] = 10;
								if (roomsInfo[room]['buzzQueue'].length !== 0) {
									io.to(room).emit('buzz done', socket_id);
									buzzAttempt(room, roomsInfo[room]['buzzQueue'][0]);
								} else {
									resumeReading(room);
									io.to(room).emit('buzz done', socket_id);
								}
							}
						}, 1000);
					}
				} else {
					if (!roomsInfo[room]['buzzQueue'].includes(socket_id)) {
						if (roomsInfo[room]['currentAnswerer'] !== socket_id) {
							roomsInfo[room]['buzzQueue'].push(socket_id);
							io.to(room).emit('queue changed', roomsInfo[room]['buzzQueue']);
						}
					}
				}
			}
		}
	}
}

function resumeReading(room) {
	if (roomsInfo[room]) {
		roomsInfo[room]['questionDone'] = false;
		roomsInfo[room]['resumeReadingInterval'] = setInterval(function () {
			if (roomsInfo[room]['unreadQuestion'].length !== 0) {
				roomsInfo[room]['readQuestion'] += roomsInfo[room]['unreadQuestion'][0] + ' ';
				roomsInfo[room]['unreadQuestion'].shift();
				io.to(room).emit('question sent', roomsInfo[room]['readQuestion']);
			} else {
				clearInterval(roomsInfo[room]['resumeReadingInterval']);
				endOfQuestion(room);
			}
		}, 250);
	}
}

io.on('connection', (socket) => {
	var room = socket.handshake.query.room;
	var name = socket.handshake.query.name;
	socket.join(room);

	if (!roomsInfo[room]) {
		initialize_room(room);
	}

	add_player(room, socket.id, name);

	io.to(room).emit('question sent', roomsInfo[room]['readQuestion']);

	socket.on('changed name', (msg) => {
		if (not_blank(msg)) {
			roomsInfo[room]['players'][socket.id]['name'] = msg.substring(0, 30);
		} else {
			roomsInfo[room]['players'][socket.id]['name'] = random_name();
		}
		io.to(room).emit('players changed', roomsInfo[room]['players']);
	});

	socket.on('message submitted', (msg) => {
		if (not_blank(msg)) {
			io.to(room).emit('message sent', [msg.substring(300, 0), socket.id]);
		}
	});

	socket.on('inactive', () => {
		roomsInfo[room]['players'][socket.id]['active'] = false;
		io.to(room).emit('players changed', roomsInfo[room]['players']);
	});

	socket.on('active', () => {
		roomsInfo[room]['players'][socket.id]['active'] = true;
		io.to(room).emit('players changed', roomsInfo[room]['players']);
	});

	socket.on('disconnect', () => {
		delete roomsInfo[room]['players'][socket.id];
		console.log(Object.keys(roomsInfo[room]['players']).length);
		if (Object.keys(roomsInfo[room]['players']).length === 0) {
			clearInterval(roomsInfo[room]['startReadingInterval']);
			clearInterval(roomsInfo[room]['resumeReadingInterval']);
			clearInterval(roomsInfo[room]['endOfAnswerInterval']);
			delete roomsInfo[room];
			console.log('room deleted');
		} else {
			io.to(room).emit('players changed', roomsInfo[room]['players']);
			roomsInfo[room]['buzzQueue'] = roomsInfo[room]['buzzQueue'].filter(
				(element) => element !== socket.id,
			);
			io.to(room).emit('queue changed', roomsInfo[room]['buzzQueue']);
		}
	});

	socket.on('next question', () => {
		if (!roomsInfo[room]['isAnswer']) {
			if (roomsInfo[room]['questionDone']) {
				if (roomsInfo[room]['buzzQueue'].length === 0) {
					prepare_for_question(room);
					newQuestion((result) => {
						roomsInfo[room]['canBuzz'] = true;
						roomsInfo[room]['currentQuestion'] = JSON.parse(result)[0];
						var questionWords = roomsInfo[room]['currentQuestion']['Question'].split(' ');
						roomsInfo[room]['unreadQuestion'] =
							roomsInfo[room]['currentQuestion']['Question'].split(' ');
						roomsInfo[room]['startReadingInterval'] = setInterval(function () {
							if (roomsInfo[room]['readValue'] !== questionWords.length) {
								roomsInfo[room]['readQuestion'] +=
									questionWords[roomsInfo[room]['readValue']] + ' ';
								roomsInfo[room]['unreadQuestion'].shift();
								roomsInfo[room]['readValue']++;
								io.to(room).emit('question sent', roomsInfo[room]['readQuestion']);
							} else {
								clearInterval(roomsInfo[room]['startReadingInterval']);
								endOfQuestion(room);
							}
						}, 250);
					}, room);
				}
			}
		}
	});

	socket.on('buzz attempted', () => {
		buzzAttempt(room, socket.id);
	});

	socket.on('answer submitted', (msg) => {
		if (!roomsInfo[room]['questionDone']) {
			clearInterval(roomsInfo[room]['answeringInterval']);
			clearInterval(roomsInfo[room]['endOfAnswerInterval']);
			roomsInfo[room]['isAnswer'] = false;
			if (evaluateQuestion(msg, roomsInfo[room]['currentQuestion']['Answer'])) {
				io.to(room).emit('correct', [socket.id, msg]);
				roomsInfo[room]['players'][socket.id]['points'] += 1;
				io.to(room).emit('players changed', roomsInfo[room]['players']);
				roomsInfo[room]['buzzQueue'] = [];
				roomsInfo[room]['questionDone'] = true;
			} else {
				io.to(room).emit('incorrect', [socket.id, msg]);
				if (
					roomsInfo[room]['playersHaveBuzzed'].length ===
					Object.keys(roomsInfo[room]['players']).length
				) {
					io.to(room).emit('question over', roomsInfo[room]['currentQuestion']);
					roomsInfo[room]['lastSentAnswer'] = roomsInfo[room]['currentQuestion']['Answer'];
					clearInterval(roomsInfo[room]['endOfAnswerInterval']);
					roomsInfo[room]['questionDone'] = true;
				} else {
					if (roomsInfo[room]['buzzQueue'].length !== 0) {
						roomsInfo[room]['answerTimeRemaining'] = 10;
						buzzAttempt(room, roomsInfo[room]['buzzQueue'][0]);
					} else {
						resumeReading(room);
					}
				}
			}
		}
	});
});

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

app.get('/mobile/', (req, res) => {
	res.sendFile(__dirname + '/mobile/index.html');
});

app.use(express.static('public'));

server.listen(process.env.PORT || 3000, () => {
	console.log('listening on *:3000');
});
