let downloadElement = document.getElementById('download')
let copyElement = document.getElementById('copy')
let turnElement = document.getElementById('turn')

let regexBattlesnakeUrl = /play\.battlesnake\.com\/g\//
let regexGameId = /\/g\/(.+)?\//

let gameId = ""
let gameTurn = 0
let maxGameTurn = 0
let snakeName = ""


function selectElement(el) {
	snakeName = el.target.dataset.name

	let snakeEl = document.getElementById('snakes')
	snakeEl.childNodes.forEach(node => {
		node.classList.remove('active')
	})
	el.target.classList.add('active')
}

chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
	if (tabs[0].url.match(regexBattlesnakeUrl) != null) {
		console.log('LOADED')

		document.getElementById('popup').removeAttribute("hidden");
		document.getElementById('inactive').setAttribute("hidden", true);

		gameId = tabs[0].url.match(regexGameId)[1]

		fetch('https://engine.battlesnake.com/games/' + gameId, {
			method: 'GET'
		})
			.then(res => res.json())
			.then(res => {
				maxGameTurn = res.LastFrame.Turn
				turnElement.style.width = countCharNumber(maxGameTurn)

				let names = res.LastFrame.Snakes.map(snake => snake.Name)
				let snakeEl = document.getElementById('snakes')
				names.forEach(name => {
					let node = document.createElement('div')
					node.setAttribute('data-name', name)
					node.classList.add('snake')
					node.onclick = selectElement
					let text = document.createTextNode(name)
					node.appendChild(text)
					snakeEl.appendChild(node)
				})
			})
			.then(_ => {
				let defaultSnake = document.getElementById('snakes').firstChild
				snakeName = defaultSnake.dataset.name
				defaultSnake.classList.add('active')
			})
	}
})

downloadElement.onclick = function(element) {
	chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
		downloadTurn()
	})
}
copyElement.onclick = function(element) {
	chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
		copyTurn()
	})
}

turnElement.onchange = function(ev) {
	if (isNaN(parseInt(turnElement.value, 10))) {
		turnElement.value = 0
	} else if (parseInt(turnElement.value, 10) > maxGameTurn) {
		turnElement.value = maxGameTurn
	}
	
	gameTurn = turnElement.value
}


function downloadFile(options) {
	if(!options.url) {
			var blob = new Blob([ options.content ], {type : "application/json;charset=UTF-8"});
			options.url = window.URL.createObjectURL(blob);
	}
	chrome.downloads.download({
			url: options.url,
			filename: options.filename
	})
}


function buildUrl(game, turn) {
	return (
		'https://engine.battlesnake.com/games/' +
		game +
		'/frames?offset=' +
		turn +
		'&limit=1'
	)
}

function transformPoint(point) {
	return {
		x: point.X,
		y: point.Y
	}
}

function transformSnake(snake) {
	let body = snake.Body.map(transformPoint)
	return {
		id: snake.ID,
		name: snake.Name,
		body: body,
		head: body[0],
		length: body.length,
		health: snake.Health,
		shout: snake.Shout,
		squad: snake.Squad
	}
}

function transformFrameToInput(game, frameData) {
	let name = snakeName
	let data = frameData.Frames[0]

	let you = data.Snakes.find(snake => {
		return snake.Name == name
	})

	if (!you) {
		throw new Error('You must provide a valid snake name')
	}

	you = transformSnake(you)

	return {
		game: {
			id: game.Game.ID,
			ruleset: {
				name: game.Game.Ruleset.name,
				version: "",
				settings: {
					foodSpawnChance: parseInt(game.Game.Ruleset.foodSpawnChance),
					minimumFood: parseInt(game.Game.Ruleset.minimumFood),
					hazardDamagePerTurn: parseInt(game.Game.Ruleset.damagePerTurn),
					royale: {
						shrinkEveryNTurns: parseInt(game.Game.Ruleset.shrinkEveryNTurns)
					},
					squad: {
						allowBodyCollisions: game.Game.Ruleset.allowBodyCollisions === 'true',
						sharedElimination: game.Game.Ruleset.sharedElimination === 'true',
						sharedHealth: game.Game.Ruleset.sharedHealth === 'true',
						sharedLength: game.Game.Ruleset.sharedLength === 'true'
					}
				}
			},
			timeout: game.Game.SnakeTimeout
		},
		turn: data.Turn,
		board: {
			width: game.Game.Width,
			height: game.Game.Height,
			// Only grab alive snakes
			snakes: data.Snakes.filter(snake => snake.Death == null).map(
				transformSnake
			),
			food: data.Food.map(transformPoint),
			hazards: data.Hazards.map(transformPoint)
		},
		you
	}
}


function downloadTurn() {
	fetch('https://engine.battlesnake.com/games/' + gameId, {
		method: 'GET'
	})
	.then(res => res.json())
	.then(game => {
		return fetch(buildUrl(gameId, gameTurn), {
			method: 'GET'
		})
			.then(res => res.json())
			.then(res => {
				downloadFile({
					filename: "battlesnake-"+gameId+"-turn-"+gameTurn+".json",
					content: JSON.stringify(transformFrameToInput(game, res))
				});
			})
			.catch(err => {
				console.log(err)
			})
	})
}
function copyTurn() {
	fetch('https://engine.battlesnake.com/games/' + gameId, {
		method: 'GET'
	})
	.then(res => res.json())
	.then(game => {
		return fetch(buildUrl(gameId, gameTurn), {
			method: 'GET'
		})
			.then(res => res.json())
			.then(res => {
				navigator.clipboard.writeText(JSON.stringify(transformFrameToInput(game, res)))
			})
			.catch(err => {
				console.log(err)
			})
	})
}


function countCharNumber(number) {
	number = number.toString()
	return number.length + "ch"
}