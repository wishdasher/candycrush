// Hand it in this way: for simpler testing, always use the same seed.
Math.seedrandom(0);

// constants
const DEFAULT_BOARD_SIZE = 8;
// set size from URL or to default
const size = Math.min(10, Math.max(3, Util.getURLParam("size") || DEFAULT_BOARD_SIZE)) || DEFAULT_BOARD_SIZE;

// Holds DOM elements that don’t change, to avoid repeatedly querying the DOM
var dom = {};

// data model at global scope for easier debugging
// initialize board model
var board = new Board(size);

// load a rule
var rules = new Rules(board);


var hintElems = [];

var hintTimeout;

let durationFactor = 0.15;

var fallingElems = [];

var selectedDetails = {
	candy: null,
	mouseX: 0,
	mouseY: 0
}

// Attaching events on document because then we can do it without waiting for
// the DOM to be ready (i.e. before DOMContentLoaded fires)
Util.events(document, {
	// Final initalization entry point: the Javascript code inside this block
	// runs at the end of start-up when the DOM is ready
	"DOMContentLoaded": function() {
		// Set css variable for board size
		Util.one("#body").style.setProperty("--size", size);
		// Draw grid
		drawGrid();

		// Element refs
		dom.controlColumn = Util.one("#controls"); // example

		// Add events for new game
		Util.one("#start").addEventListener("click", () => {
			startGame();
		});

		// give each direction button a listener for when it is clicked
		Util.all(".dir").forEach((element) => {
			element.addEventListener("click", (evt) => {
				clearHint();
				// disable hints
				// let input = document.getElementById("input-move");
				// let inputText = input.value.toLowerCase();
				let dir = element.id;
				let candy = getCandyForInput(inputText);
				// figure out if we can actually move, yo
				if (rules.isMoveTypeValid(candy, dir)) { //TODO: remove because we now disable the button for an invalid move
					board.flipCandies(candy, board.getCandyInDirection(candy, dir));
					// TODO or work with a promise after things were switched
					// to allow crushing (add wrapper in crushCandies)
					setTimeout(() => crushCandies(), 100);
				}
				// reset input and focus
				// input.value = "";
				// input.focus();

				// console.log("no crushes left");
				// disableAllDirButtons();
			});
		});

		// start game with page loads
		startGame();
	},

	// Keyboard events arrive here
	"keyup": function(evt) {
		// validateInput();
	},

	// Click events arrive here
	"click": function(evt) {
		// console.log(evt);
		// Not used for now
	},

	// MOUSE EVENTS HERE

	"mousedown": function(evt) {
		// if clicked on the div, grabs the image which is childNodes[0]
		// otherwise grabs the target, which should be the candy image
		let candy = evt.target.childNodes[0] || evt.target;
		if (candy.classList && candy.classList.contains("candy-image")) {
			candy.classList.add("moving");
			selectedDetails.candy = candy;
			selectedDetails.mouseX = evt.clientX;
			selectedDetails.mouseY = evt.clientY;
		}

		evt.preventDefault();
	},

	"mouseup": function(evt) {
		console.log(evt);
		let targetCandy = evt.target.childNodes[0] || evt.target;
		let sourceCandy = selectedDetails.candy;
		selectedDetails.candy = null;
		console.log(sourceCandy);
		console.log(targetCandy);
		// check if candy is being dragged, if target is actually a candy
		if (sourceCandy && targetCandy.classList &&
			targetCandy.classList.contains("candy-image")) {
			let source = {
				row: sourceCandy.getAttribute("data-row"),
				col: sourceCandy.getAttribute("data-col")
			}
			let target = {
				row: targetCandy.getAttribute("data-row"),
				col: targetCandy.getAttribute("data-col")
			};
			let dir = getAdjacencyDir(source, target);
			console.log(dir);
			if (dir) {
				console.log("VALID MOVE");
				flipCandies(board.getCandyAt(source.row, source.col), dir);
				return;
			}
		}

		console.log("SNAPPING BACK");
		sourceCandy.style.setProperty("--top", sourceCandy.style.top + "px");
		sourceCandy.style.setProperty("--left", sourceCandy.style.left + "px");
		window.requestAnimationFrame(() => {
			sourceCandy.classList.add("anim-back");
			Util.afterAnimation(sourceCandy, "back").then(() => {
				sourceCandy.classList.remove("anim-back");
				sourceCandy.classList.remove("moving");
			});
		});
		evt.preventDefault();
	},

	"mousemove": function(evt) {
		// ANCHOR
		let candy = selectedDetails.candy;
		if (candy) {
			// console.log(evt);
			// selectedCandy.style.top = parseInt(event.offsetY);
			// selectedCandy.style.left = parseInt(event.offsetX);
			candy.style.top = (parseInt(evt.clientY) - parseInt(selectedDetails.mouseY)) + "px";
			candy.style.left = (parseInt(evt.clientX) - parseInt(selectedDetails.mouseX)) + "px";
			// console.log(selectedDetails.mouseY + ", " + selectedDetails.mouseX);
			// console.log(evt.clientY + ", " + evt.clientX);
			// console.log("TOP " + candy.style.top);
			// console.log("LEFT " + candy.style.left);
		}
		evt.preventDefault();
	}


});

// start a new game, resets fields, scores
var startGame = () => {
	rules.prepareNewGame();
	board.resetScore();
	// disableAllDirButtons();
	clearHint();
	startHintTimeout();
}

// Attaching events to the board
Util.events(board, {
	// add a candy to the board
	"add": function(e) {
		handleCandyIn(e.detail, true);
	},

	// move a candy from location 1 to location 2
	"move": function(e) {
		handleCandyIn(e.detail, false);
	},

	// remove a candy from the board
	"remove": function(e) {
		let row = e.detail.fromRow;
		let col = e.detail.fromCol;
		let cell = document.getElementById(getCellID(row, col));
		removeAllChildren(cell);
	},

	// update the score
	"scoreUpdate": function(e) {
		Util.one("#score").textContent = e.detail.score;
		Util.one("#scoreboard").className = "gen-module";
		// if there is a candy, otherwise we started with beginning grey
		if (e.detail.candy) {
			Util.one("#scoreboard").classList.add(e.detail.candy.color);
		}
	},
});

// for an add or move event, handle the candy switching and accompanying animations
var handleCandyIn = (detail, adding) => {
	setCandy(detail);
	if (detail.fromCol != null && detail.fromRow != null) {
		let candyCell = Util.one(".candy-cell");
		let cellSize = getComputedStyle(candyCell).getPropertyValue("width").replace(/px/,"");

		// animate candy from original location to current location
		// we grab the candy image from the new location
		let img = getCandyImgFromRowCol(detail.toRow, detail.toCol);
		let xmove = (detail.fromCol - detail.toCol);
		let ymove = (detail.fromRow - detail.toRow);
		let duration = Math.max(Math.abs(xmove), Math.abs(ymove)) * durationFactor;

		// set move distance and move duration needed
		img.style.setProperty("--xmove", xmove * cellSize + "px");
		img.style.setProperty("--ymove", ymove * cellSize + "px");
		img.style.setProperty("--duration-move", duration + "s");

		if (adding) {
			fallingElems.push(img);
		}
		window.requestAnimationFrame(() => {
			img.classList.add("anim-move");
			console.log("ADDED");
			Util.afterAnimation(img, "slide").then(() => {
				img.classList.remove("anim-move");
			});
		});

	}
}

var flipCandies = (candy, dir) => {
	if (rules.isMoveTypeValid(candy, dir)) { //TODO: remove because we now disable the button for an invalid move
		board.flipCandies(candy, board.getCandyInDirection(candy, dir));
		// TODO or work with a promise after things were switched
		// to allow crushing (add wrapper in crushCandies)
		setTimeout(() => crushCandies(), 100);
	}
}

// set candy from old location to new location in the div cells
var setCandy = (detail) => {
	let row = detail.toRow;
	let col = detail.toCol;

	let cell = document.getElementById(getCellID(row, col));
	removeAllChildren(cell);

	let candyImg = document.createElement("img");
	candyImg.setAttribute("src", getImageForCandy(detail.candy));
	candyImg.setAttribute("class", "candy-image");
	candyImg.setAttribute("data-row", row);
	candyImg.setAttribute("data-col", col);
	cell.appendChild(candyImg);

};

var drawGrid = () => {
		// populate board with candy cells
	let candyBoard = document.getElementById("board");
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			let cell = document.createElement("DIV");
				// this is a candy cell!
			cell.setAttribute("id", getCellID(r, c));
			cell.setAttribute("class", "candy-cell");
			candyBoard.appendChild(cell);
		}
	}
	// Util.all(".candy-cell").forEach((element) => {
	// 	element.addEventListener("mousedown", (evt) => {
	// 		console.log(this);

	// 		console.log(evt);
	// 	});
	// });

}

// maps candy rep column to letter label
let colToLetter = {
	0: "a", 1: "b", 2: "c", 3: "d", 4: "e", 5: "f", 6: "g", 7: "h", 8: "i", 9: "j"}
var getColLetter = (c) => {
	return colToLetter[c];
}

// maps letter label to candy rep column
let letterToCol = {
	"a": 0, "b": 1, "c": 2, "d": 3, "e": 4, "f": 5, "g": 6, "h": 7, "i": 8, "j": 9}
var getColNumber = (c) => {
	return letterToCol[c];
}

// 0-indexed
var getCellID = (row, col) => {
	return "cell-" + row + "-" + col;
}

var getImageForCandy = (candy) => {
	return "graphics/" + candy.color + "-candy.png";
}

var removeAllChildren = (node) => {
	while (node.firstChild) {
    	node.removeChild(node.firstChild);
	}
}

var getAdjacencyDir = (source, target) => {
	let sRow = parseInt(source.row);
	let sCol = parseInt(source.col);
	let tRow = parseInt(target.row);
	let tCol = parseInt(target.col);

	if (sRow === tRow) {
		if (sCol + 1 === tCol) {
			return "right";
		}
		if (sCol - 1 === tCol) {
			return "left";
		}
	} else if (sCol === tCol) {
		if (sRow + 1 === tRow) {
			return "down";
		}
		if (sRow - 1 === tRow) {
			return "up";
		}
	}
	return "";
}
// // given the input, figure out what to do about buttons
// var validateInput = () => {
// 	let input = document.getElementById("input-move");
// 	let inputText = input.value.toLowerCase();
// 	if (inputTextValid(inputText)) {
// 		validateDirButtons(inputText);
// 		Util.one("#input-move").classList.remove("bad-input");
// 	} else if (inputText.length == 0) {
// 		Util.one("#input-move").classList.remove("bad-input");
// 		disableAllDirButtons();
// 	} else {
// 		Util.one("#input-move").classList.add("bad-input");
// 		disableAllDirButtons();
// 	}
// }

// // figure out custom regexes given the board size
// var inputTextValid = (inputText) => {
// 	let re;
// 	if (size < 10) {
// 		re = new RegExp("^[a-" + getColLetter(size - 1) + "][1-" + size + "]$");
// 	} else {
// 		// because regex is being silly for 10
// 		re = new RegExp("^[a-i]([1-9]|10)$");
// 	}
// 	return inputText.match(re);
// }

const dirs = ["up", "left", "right", "down"]

// check if directional buttons should be enabled or disabled
// var validateDirButtons = (inputText) => {
// 	for (let i = 0; i < dirs.length; i++) {
// 		let candy = getCandyForInput(inputText);
// 		if (rules.isMoveTypeValid(candy, dirs[i])) {
// 			enableButton(dirs[i]);
// 		} else {
// 			disableButton(dirs[i]);
// 		}
// 	}
// }

// disable all directional controls, including the input field
// var disableDirControls = () => {
// 	// disable buttles
// 	disableAllDirButtons();
// 	// disable input
// 	let input = document.getElementById("input-move");
// 	input.classList.add("disabled");
// 	input.disabled = true;
// }

// // disable all the directional buttons
// var disableAllDirButtons = () => {
// 	for (let i = 0; i < dirs.length; i++) {
// 		disableButton(dirs[i]);
// 	}
// }

// takes button dID to enable
var enableButton = (id) => {
	let element = document.getElementById(id);
	element.disabled = false;
	element.classList.remove("disabled");
}

// takes button ID to disable
var disableButton = (id) => {
	let element = document.getElementById(id);
	element.disabled = true;
	element.classList.add("disabled");
}

// // check crush state, re-enable and disable components as necessary
// var checkCrushState = () => {
// 	let crushes = rules.getCandyCrushes();
// 	if (crushes.length > 0) {
// 		enableButton("crush");
// 		disableDirControls();
// 	} else {
// 		disableButton("crush");
// 		// re-enable input
// 		let input = document.getElementById("input-move");
// 		input.classList.remove("disabled");
// 		input.disabled = false;
// 		input.focus();
// 	}
// }

var crushCandies = () => {
	console.log("CRUSHING");
	let crushes = rules.getCandyCrushes();

	if (crushes.length === 0) {
		startHintTimeout();
		return;
	}

	let elements = [];
	for (let i = 0; i < crushes.length; i++) {
		for (let j = 0; j < crushes[i].length; j++) {
			let row = crushes[i][j].row;
			let col = crushes[i][j].col;
			let img = getCandyImgFromRowCol(row, col);
			elements.push(img);
		}
	}
	// attach fade-out animation
	window.requestAnimationFrame(() => {
		elements.forEach(e => e.classList.add("anim-fade"));
		Util.afterAnimation(elements, "fade").then(() => {
			// TODO: Is this necessary? they all get deleted anyways
			elements.forEach(e => e.classList.remove("anim-fade"));
			rules.removeCrushes(crushes);
			// change this to cascading something?
			rules.moveCandiesDown();
			setTimeout(() => crushCandies(), 300);
			// Util.afterAnimation(fallingElems, "slide").then(() => {
			// 	console.log("after falling");
			// 	console.log(fallingElems);
			// 	// debugger;
			// 	// because we're calling crush candies before cascading happens
			// 	fallingElems.length = 0;
			// 	// crushCandies();
			// 	setTimeout(() => crushCandies(), 500);
			// });
			// crushCandies();
		});
	});
}

// start hint timeout
var startHintTimeout = () => {
	hintTimeout = setTimeout(() => animateHint(), 5000);
}

var animateHint = () => {
	Util.delay(0);
	let move = rules.getRandomValidMove();
	// using the helper method because specs changed? and the rules.js functions were not
	// re-written to account for this
	let hintCandies = rules.getCandiesToCrushGivenMove(move.candy, move.direction);
	for (let i = 0; i < hintCandies.length; i++) {
		let row = hintCandies[i].row;
		let col = hintCandies[i].col;
		let img = getCandyImgFromRowCol(row, col);
		hintElems.push(img);
	}
	// add hint animation
	window.requestAnimationFrame(() => {
		hintElems.forEach(e => e.classList.add("anim-hint"));
	});
	// focus input cell
	// let input = document.getElementById("input-move");
	// input.focus();
}

var clearHint = () => {
	clearTimeout(hintTimeout);
	hintElems.forEach(e => e.classList.remove("anim-hint"));
	hintElems.length = 0;
}

// assumes valid inputText
// var getCandyForInput = (inputText) => {
// 	return board.getCandyAt(parseInt(inputText.substring(1)) - 1, getColNumber(inputText[0]));
// }


var getCandyImgFromRowCol = (row, col) => {
	let cell = document.getElementById(getCellID(row, col));
	//TODO some better method?
	let img = cell.childNodes[0];
	return img;
}
