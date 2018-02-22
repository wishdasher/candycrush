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

//TODO: figure out when to add crush state check

// Attaching events on document because then we can do it without waiting for
// the DOM to be ready (i.e. before DOMContentLoaded fires)
Util.events(document, {
	// Final initalization entry point: the Javascript code inside this block
	// runs at the end of start-up when the DOM is ready
	"DOMContentLoaded": function() {
		// Draw grid
		drawGrid();

		// Element refs
		dom.controlColumn = Util.one("#controls"); // example

		// Add events
		Util.one("#start").addEventListener("click", () => {
			rules.prepareNewGame();
			// reset all other fields
			let input = document.getElementById("input-move");
			input.value = "";
			disableAllDirButtons();
			checkCrushState();
			input.focus();
		});

		// give each direction button a listener for when it is clicked
		Util.all(".dir").forEach((element) => {
			element.addEventListener('click', (evt) => {
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
			rules.removeCrushes(rules.getCandyCrushes());
			setTimeout(handleMoveCandies, 500, checkCrushState);
		});

		// always start with a game
		rules.prepareNewGame();
		disableAllDirButtons();
		checkCrushState();
		document.getElementById("input-move").focus();
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

// Attaching events to the board
Util.events(board, {
	// add a candy to the board
	"add": function(e) {
		setCandy(e.detail);
	},

	// move a candy from location 1 to location 2
	"move": function(e) {
		setCandy(e.detail);
	},

	// remove a candy from the board
	"remove": function(e) {
		let detail = e.detail;
		let row = detail.fromRow;
		let col = detail.fromCol;
		let cell = document.getElementById(getCellID(row, col));
		removeAllChildren(cell);
	},

	// update the score
	"scoreUpdate": function(e) {
		// Your code here. To be implemented in PS3.
	},
});

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
let colToLetter = {0: "a", 1: "b", 2: "c", 3: "d", 4: "e", 5: "f", 6: "g", 7: "h"}
var getColLetter = (c) => {
	return colToLetter[c];
}

// maps letter label to candy rep column
let letterToCol = {"a": 0, "b": 1, "c": 2, "d": 3, "e": 4, "f": 5, "g": 6, "h": 7}
var getColNumber = (c) => {
	return letterToCol[c];
}

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
	if (inputText.length >= 2) {
		if (inputText.match(/^[a-h][1-8]$/)) {
			validateDirButtons(inputText);
		} else {
			disableAllDirButtons();
		}
	} else {
		disableAllDirButtons();
	}
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

// check crush state, re-enable and disable components as necessary
var checkCrushState = () => {
	let crushes = rules.getCandyCrushes();
	if (crushes.length > 0) {
		enableButton("crush");
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

// assumes valid inputText
var getCandyForInput = (inputText) => {
	return board.getCandyAt(parseInt(inputText[1]) - 1, getColNumber(inputText[0]));
}

// can accommodate a callback function after moving candies down
var handleMoveCandies = (callback) => {
	rules.moveCandiesDown();
	if (callback) {
		callback();
	}
}