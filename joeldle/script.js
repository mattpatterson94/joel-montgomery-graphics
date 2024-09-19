let grabWord = "https://words.dev-apis.com/word-of-the-day";
let correctWord;
let guess;
let guessNumber = 1;
let streakNumber = 0;
let prevGuessNumber = 6;

function init() {
    const promise = fetch(grabWord);
    promise
        .then(function (response) {
            const processingPromise = response.json();
            return processingPromise;
        })
            .then(function (processedResponse) {
                correctWord = processedResponse.word;
                console.log(correctWord);
            })
    let disableRow = document.getElementsByClassName("letter");
    for (let i = 0; i < disableRow.length; i++) {
        disableRow[i].disabled = true;
        disableRow[i].value = '';
        disableRow[i].classList.remove("correct");
        disableRow[i].classList.remove("present");
    }
    let enableRow = document.getElementsByClassName("a1");
    for (let i = 0; i < enableRow.length; i++) {
        enableRow[i].disabled = false;
        enableRow[i].value = '';
        enableRow[i].classList.remove("correct");
        enableRow[i].classList.remove("present");
    }
    document.getElementById("start").focus();
}

function isLetter(letter) {
    return /^[a-zA-Z]$/.test(letter);
}

function prepareGuess(guessNumber) {
    const currentInputs = document.querySelectorAll(`.a${guessNumber}`);
    let guess = '';
    currentInputs.forEach(input => {
        guess += input.value;
    });
    guess = guess.toLowerCase();
    
    if (guess.length = 5) {
        validateWord(guess);
    }
}

async function validateWord(guess) {

    const validation = await fetch("https://words.dev-apis.com/validate-word", {
        method: "POST",
        body: JSON.stringify({ word: guess }),
    });
    const { validWord } = await validation.json();
        
    if (validWord === true) {
        checkWord(guess);
    } else {
        const currentRow = document.querySelector(`.row${guessNumber}`);

        for (i = 0; i < currentRow.children.length; i++) {
            let child = currentRow.children[i];
            child.classList.add('invalidWord');
        }
    }
}

function checkWord(guess) {
    const currentRow = document.querySelector(`.row${guessNumber}`);

    const letterBox1 = currentRow.children[0];
    const letterBox2 = currentRow.children[1];
    const letterBox3 = currentRow.children[2];
    const letterBox4 = currentRow.children[3];
    const letterBox5 = currentRow.children[4];

    const letters = correctWord.split("");
    const guessLetters = guess.split("");

    const letter1 = letters[0];
    const letter2 = letters[1];
    const letter3 = letters[2];
    const letter4 = letters[3];
    const letter5 = letters[4];

    const guessLetter1 = guessLetters[0];
    const guessLetter2 = guessLetters[1];
    const guessLetter3 = guessLetters[2];
    const guessLetter4 = guessLetters[3];
    const guessLetter5 = guessLetters[4];

    let matchedLetterArray = [];

    if (guessLetter1 === letter1) {
        letterBox1.classList.add("correct");
        matchedLetterArray.push(1);
    }
    if (guessLetter2 === letter2) {
        letterBox2.classList.add("correct");
        matchedLetterArray.push(2);
    }
    if (guessLetter3 === letter3) {
        letterBox3.classList.add("correct");
        matchedLetterArray.push(3);
    }
    if (guessLetter4 === letter4) {
        letterBox4.classList.add("correct");
        matchedLetterArray.push(4);
    }
    if (guessLetter5 === letter5) {
        letterBox5.classList.add("correct");
        matchedLetterArray.push(5);
    }

    if (guessLetter1 === letter2) {
        matchedLetterArray.push(2);
        letterBox1.classList.add("present");
    } else if (guessLetter1 === letter3) {
        matchedLetterArray.push(3);
        letterBox1.classList.add("present");
    } else if (guessLetter1 === letter4) {
        matchedLetterArray.push(4);
        letterBox1.classList.add("present");
    } else if (guessLetter1 === letter5) {
        matchedLetterArray.push(5);
        letterBox1.classList.add("present");
    }

    if (guessLetter2 === letter1) {
        if (matchedLetterArray.includes(1)) {} else {
            letterBox2.classList.add("present");
            matchedLetterArray.push(1);
        };
    } else if (guessLetter2 === letter3) {
        if (matchedLetterArray.includes(3)) {} else {
            letterBox2.classList.add("present");
            matchedLetterArray.push(3);
        };
    } else if (guessLetter2 === letter4) {
        if (matchedLetterArray.includes(4)) {} else {
            letterBox2.classList.add("present");
            matchedLetterArray.push(4);
        };
    } else if (guessLetter2 === letter5) {
        if (matchedLetterArray.includes(5)) {} else {
            letterBox2.classList.add("present");
            matchedLetterArray.push(5);
        };
    }

    
    if (guessLetter3 === letter1) {
        if (matchedLetterArray.includes(1)) {} else {
            letterBox3.classList.add("present");
            matchedLetterArray.push(1)
        };
    } else if (guessLetter3 === letter2) {
        if (matchedLetterArray.includes(2)) {} else {
            letterBox3.classList.add("present");
            matchedLetterArray.push(2)
        };
    } else if (guessLetter3 === letter4) {
        if (matchedLetterArray.includes(4)) {} else {
            letterBox3.classList.add("present");
            matchedLetterArray.push(4)
        };
    } else if (guessLetter3 === letter5) {
        if (matchedLetterArray.includes(5)) {} else {
            letterBox3.classList.add("present");
            matchedLetterArray.push(5)
        };
    }

    
    if (guessLetter4 === letter1) {
        if (matchedLetterArray.includes(1)) {} else {
            letterBox4.classList.add("present");
            matchedLetterArray.push(1);
        };
    } else if (guessLetter4 === letter2) {
        if (matchedLetterArray.includes(2)) {} else {
            letterBox4.classList.add("present");
            matchedLetterArray.push(2);
        };
    } else if (guessLetter4 === letter3) {
        if (matchedLetterArray.includes(3)) {} else {
            letterBox4.classList.add("present");
            matchedLetterArray.push(3);
        };
    } else if (guessLetter4 === letter5) {
        if (matchedLetterArray.includes(5)) {} else {
            letterBox4.classList.add("present");
            matchedLetterArray.push(5);
        };
    }


    if (guessLetter5 === letter1) {
        if (matchedLetterArray.includes(1)) {} else {
            letterBox5.classList.add("present");
            matchedLetterArray.push(1);
        };
    } else if (guessLetter5 === letter2) {
        if (matchedLetterArray.includes(2)) {} else {
            letterBox5.classList.add("present");
            matchedLetterArray.push(2);
        };
    } else if (guessLetter5 === letter3) {
        if (matchedLetterArray.includes(3)) {} else {
            letterBox5.classList.add("present");
            matchedLetterArray.push(3);
        };
    } else if (guessLetter5 === letter4) {
        if (matchedLetterArray.includes(4)) {} else {
            letterBox5.classList.add("present");
            matchedLetterArray.push(4);
        };
    }

    if (guess === correctWord) {
        endGame();
        victory();
    } else if (guessNumber>=6) {
        endGame();
        defeat();
    } else {
        guessNumber += 1;
        nextLine();
    };
}

function backspace() {
    const currentRow = document.querySelector(`.row${guessNumber}`);

    for (i = 0; i < currentRow.children.length; i++) {
        let child = currentRow.children[i];
        child.classList.remove('invalidWord');
    }

    const activeElement = document.activeElement;

    if (activeElement.value.length >= 1) {
        activeElement.value = '';
    } else {
        activeElement.value = '';

        const inputs = Array.from(document.querySelectorAll('input'));

        const index = inputs.indexOf(activeElement);

        if (index > 0) {
            inputs[index - 1].focus();
        }
    }
}

function nextInput() {
    letterInput.forEach((input, index) => {
        input.addEventListener('input', function() {
            const nextInput = letterInput[index +1];
            nextInput.focus();
        });
    });
}

function nextLine() {
    let oldRow = guessNumber - 1;
    let newRow = guessNumber;

    let oldRowString = oldRow.toString();
    let newRowString = newRow.toString();

    let oldRowClass = `a${oldRowString}`;
    let newRowClass = `a${newRowString}`;

    let enableRow = document.getElementsByClassName(newRowClass);
    for (let i = 0; i < enableRow.length; i++) {
        enableRow[i].disabled = false;
    }

    document.getElementById(newRowString).focus();

    let disableRow = document.getElementsByClassName(oldRowClass);
    for (let i = 0; i < disableRow.length; i++) {
        disableRow[i].disabled = true;
    }
}

function endGame() {
    let oldRow = guessNumber;

    let oldRowString = oldRow.toString();

    let oldRowClass = `a${oldRowString}`;

    let disableRow = document.getElementsByClassName(oldRowClass);
    for (let i = 0; i < disableRow.length; i++) {
        disableRow[i].disabled = true;
    }
}

function victory() {
    streakNumber += 1;

    document.getElementById("message").innerHTML=`Solved in ${guessNumber}!`;
    document.getElementById("prizes").classList.remove('prizeHidden');

    if (prevGuessNumber === 1 && guessNumber === 1) {
        document.getElementById("streak").innerHTML=`Stop cheating!`;
    } else if (streakNumber > 1 && streakNumber < 3) {
        document.getElementById("streak").innerHTML=`${streakNumber} in a row!`;
    } else if (streakNumber >= 3 && streakNumber < 4) {
        document.getElementById("streak").innerHTML=`Keep going! ${streakNumber} in a row!`;
    } else if (streakNumber >= 4 && streakNumber < 5) {
        document.getElementById("streak").innerHTML=`Cool streak! ${streakNumber} in a row!`;
    } else if (streakNumber >= 5 && streakNumber < 7) {
        document.getElementById("streak").innerHTML=`You're smart! ${streakNumber} in a row!`;
    } else if (streakNumber >= 7 && streakNumber < 10) {
        document.getElementById("streak").innerHTML=`Wow! ${streakNumber} in a row!`;
    } else if (streakNumber >= 10) {
        document.getElementById("streak").innerHTML=`Great streak! ${streakNumber} in a row!`;
    }

    prevGuessNumber = guessNumber;
}

function defeat() {
    document.getElementById("message").innerHTML=`You lost! The word was ${correctWord}`;
    document.getElementById("prizes").classList.remove('prizeHidden');
    streakNumber = 0;
}

function playRandom() {
    let grabWord = "https://words.dev-apis.com/word-of-the-day?random=1";
    let disableRow = document.getElementsByClassName("letter");
    for (let i = 0; i < disableRow.length; i++) {
        disableRow[i].disabled = true;
        disableRow[i].value = '';
        disableRow[i].classList.remove("correct");
        disableRow[i].classList.remove("present");
    }
    let enableRow = document.getElementsByClassName("a1");
    for (let i = 0; i < enableRow.length; i++) {
        enableRow[i].disabled = false;
        enableRow[i].value = '';
        enableRow[i].classList.remove("correct");
        enableRow[i].classList.remove("present");
    }
    const promise = fetch(grabWord);
    promise
        .then(function (response) {
            const processingPromise = response.json();
            return processingPromise;
        })
            .then(function (processedResponse) {
                correctWord = processedResponse.word;
                console.log(correctWord);
            })
    guessNumber = 1;
    document.getElementById("message").innerHTML=`Playing a random word`;
    document.getElementById("prizes").classList.add('prizeHidden');
    document.getElementById("start").focus();
}


init();

document
    .querySelector(".game")
    .addEventListener("keydown", function (event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
            prepareGuess(guessNumber);
        } else if (event.key === 'Backspace' || event.keyCode === 8) {
            backspace();
        } else if (!isLetter(event.key)) {
            event.preventDefault();
        };
    });

const letterInput = document.querySelectorAll('input');

letterInput.forEach((input, index) => {
    input.addEventListener('input', function() {
        if (input.value.length === parseInt(input.getAttribute('maxlength'))) {
            const nextInput = letterInput[index +1];
            if (nextInput) {
                nextInput.focus();
            }
        }
    });
});
