let answer = 0;
let buffer = "0";
let operator;
const screen = document.querySelector(".screen");

function buttonClick(value) {
    if (isNaN(parseInt(value))) {
        handleSymbol(value);
    } else {
        handleNumber(value);
    }
    render();
};

function handleNumber(value) {
    if (buffer === "0") {
        buffer = value;
    } else {
        buffer += value;
    }
}

function handleSymbol(value) {
    switch(value) {
        case "C":
            buffer = "0";
            answer = 0;
            break;
        case "⌫":
            if (buffer.length === 1) {
                buffer = "0";
            } else {
            buffer = buffer.substring(0, buffer.length - 1);
            }
            break;
        case "+":
        case "-":
        case "×":
        case "÷":
            handleMath(value);
            break;
        case "=":
            performOperation(value);
            break;
    }
}

function performOperation(value) {
    const intBuffer = parseInt(buffer);
    console.log(answer, operator, buffer)
    if (operator === "+") {
        answer += intBuffer;
    } else if (operator === "-") {
        answer -= intBuffer;
    } else if (operator === "×") {
        answer *= intBuffer;
    } else {
        answer /= intBuffer;
    }
    buffer = answer;
    answer = 0;
    operator = null;
}  

function handleMath(value) {
    if (buffer === "0") {
        console.log("nothing to do");
        return;
    }
    if (answer === 0) {
        // No number to work with
    } else {
        performOperation(buffer);
    }
    const intBuffer = parseInt(buffer);
    answer = intBuffer;
    buffer = "0";
    operator = value;
}

function render() {
    screen.innerText = buffer;
}

document
    .querySelector(".calculator")
    .addEventListener("click", function (event) {
    buttonClick(event.target.innerText);
    });