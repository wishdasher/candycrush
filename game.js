// Hand it in this way: for simpler testing, always use the same seed.
Math.seedrandom(0);

// constants
const DEFAULT_BOARD_SIZE = 8;
// set size from URL or to default
const size = Math.min(10, Math.max(3, Util.getURLParam("size") || DEFAULT_BOARD_SIZE));

// Holds DOM elements that don’t change, to avoid repeatedly querying the DOM
var dom = {};

// data model at global scope for easier debugging
// initialize board model
var board = new Board(size);

// load a rule
var rules = new Rules(board);


var hintElems = [];

let durationFactor = 0.15;

//TODO: figure out when to add crush state check

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

		Util.one("#hint").addEventListener("click", () => {
			disableHints();
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
			let input = document.getElementById("input-move");
			input.focus();
		});

		// give each direction button a listener for when it is clicked
		Util.all(".dir").forEach((element) => {
			element.addEventListener("click", (evt) => {
				// disable hints
				disableHints();
				let input = document.getElementById("input-move");
				let inputText = input.value.toLowerCase();
				let dir = element.id;
				let candy = getCandyForInput(inputText);
				// figure out if we can actually move, yo
				if (rules.isMoveTypeValid(candy, dir)) { //TODO: remove because we now disable the button for an invalid move
					board.flipCandies(candy, board.getCandyInDirection(candy, dir));
				}
				// reset input and focus
				input.value = "";
				input.focus();
				checkCrushState();
			});
		});

		// crush listener, implemented with timeout and callback
		Util.one("#crush").addEventListener("click", () => {
			let button = document.getElementById("crush");
			button.classList.add("disabled");
			button.disabled = true;
			let crushes = rules.getCandyCrushes();
			checkAvailableMoves();

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
					rules.moveCandiesDown();
					checkCrushState();
				});
			});

		});
		// start game with page loads
		startGame();
	},

	// Keyboard events arrive here
	"keyup": function(evt) {
		validateInput();
	},

	// Click events arrive here
	"click": function(evt) {
		// Not used for now
	}
});

// start a new game, resets fields, scores
var startGame = () => {
	rules.prepareNewGame();
	board.resetScore();
	disableAllDirButtons();
	checkCrushState();
	checkAvailableMoves();
	let input = document.getElementById("input-move");
	input.value = "";
	input.focus();
}

// Attaching events to the board
Util.events(board, {
	// add a candy to the board
	"add": function(e) {
		handleCandyIn(e.detail);
	},

	// move a candy from location 1 to location 2
	"move": function(e) {
		handleCandyIn(e.detail);
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
var handleCandyIn = (detail) => {
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

		window.requestAnimationFrame(() => {
			img.classList.add("anim-move");
			Util.afterAnimation(img, "slide").then(() => {
				img.classList.remove("anim-move");
			});
		});
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
	candyImg.setAttribute("class", "candy");
	cell.appendChild(candyImg);

};

var drawGrid = () => {
		// populate board with candy cells
	let candyBoard = document.getElementById("board");
	for (let r = 0; r < size + 1; r++) {
		for (let c = 0; c < size + 1; c++) {
			let cell = document.createElement("DIV");
			// If the cell is on the edge, but not for (0,0)
			if (r == 0 && !(c == 0)) {
				cell.innerHTML = getColLetter(c - 1);
				cell.setAttribute("class", "text-cell");
				cell.classList.add("high-z-index");

			} else if (c == 0 && !(r == 0)) {
				// only place we use 1-indexing
				cell.innerHTML = r;
				cell.setAttribute("class", "text-cell");

			} else if (c != 0 && r != 0) {
				// this is a candy cell!
				cell.setAttribute("id", getCellID(r - 1, c - 1));
				cell.setAttribute("class", "candy-cell");

			}
			candyBoard.appendChild(cell);
		}
	}


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

// given the input, figure out what to do about buttons
var validateInput = () => {
	let input = document.getElementById("input-move");
	let inputText = input.value.toLowerCase();
	if (inputTextValid(inputText)) {
		validateDirButtons(inputText);
		Util.one("#input-move").classList.remove("bad-input");
	} else if (inputText.length == 0) {
		Util.one("#input-move").classList.remove("bad-input");
		disableAllDirButtons();
	} else {
		Util.one("#input-move").classList.add("bad-input");
		disableAllDirButtons();
	}
}

// figure out custom regexes given the board size
var inputTextValid = (inputText) => {
	let re;
	if (size < 10) {
		re = new RegExp("^[a-" + getColLetter(size - 1) + "][1-" + size + "]$");
	} else {
		// because regex is being silly for 10
		re = new RegExp("^[a-i]([1-9]|10)$");
	}
	return inputText.match(re);
}

const dirs = ["up", "left", "right", "down"]

// check if directional buttons should be enabled or disabled
var validateDirButtons = (inputText) => {
	for (let i = 0; i < dirs.length; i++) {
		let candy = getCandyForInput(inputText);
		if (rules.isMoveTypeValid(candy, dirs[i])) {
			enableButton(dirs[i]);
		} else {
			disableButton(dirs[i]);
		}
	}
}

// disable all directional controls, including the input field
var disableDirControls = () => {
	// disable buttles
	disableAllDirButtons();
	// disable input
	let input = document.getElementById("input-move");
	input.classList.add("disabled");
	input.disabled = true;
}

// disable all the directional buttons
var disableAllDirButtons = () => {
	for (let i = 0; i < dirs.length; i++) {
		disableButton(dirs[i]);
	}
}

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

var disableHints = () => {
	hintElems.forEach(e => e.classList.remove("anim-hint"));
	hintElems.length = 0;
}

// check crush state, re-enable and disable components as necessary
var checkCrushState = () => {
	let crushes = rules.getCandyCrushes();
	if (crushes.length > 0) {
		enableButton("crush");
		disableButton("hint");
		disableDirControls();
	} else {
		disableButton("crush");
		// re-enable input
		let input = document.getElementById("input-move");
		input.classList.remove("disabled");
		input.disabled = false;
		input.focus();
	}
}

// if there is no valid moves, disable the hint button
var checkAvailableMoves = () => {
	if (rules.getRandomValidMove()) {
		enableButton("hint");
	} else {
		disableButton("hint");
	}
}

// assumes valid inputText
var getCandyForInput = (inputText) => {
	return board.getCandyAt(parseInt(inputText[1]) - 1, getColNumber(inputText[0]));
}

var getCandyImgFromRowCol = (row, col) => {
	let cell = document.getElementById(getCellID(row, col));
	//TODO some better method?
	let img = cell.childNodes[0];
	return img;
}
