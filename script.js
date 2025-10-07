 // script.js (voice fixes only; calculator logic preserved)

let currentValue = '0';
let previousValue = null;
let operator = null;
let shouldResetDisplay = false;
let recognition = null;
let isListening = false;

const expressionDiv = document.getElementById('expression');
const resultDiv = document.getElementById('result');
const statusDiv = document.getElementById('status');
const errorDiv = document.getElementById('error');
const aiSummary = document.getElementById('aiSummary');
const voiceBtn = document.getElementById('voiceBtn');
const voiceIcon = document.getElementById('voiceIcon');
const voiceText = document.getElementById('voiceText');

// Initialize speech recognition (safe, vendor-prefixed)
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        voiceBtn.classList.add('listening');
        voiceIcon.textContent = '🔴';
        voiceText.textContent = 'Listening...';
        statusDiv.textContent = 'Listening... Speak now!';
        statusDiv.classList.add('listening');
        errorDiv.style.display = 'none';
    };

    recognition.onresult = (e) => {
        // handle final transcript
        const transcript = e.results[0][0].transcript.toLowerCase().trim();
        processVoiceInput(transcript);
    };

    recognition.onerror = (e) => {
        console.error('Speech error:', e.error);
        stopListening();
        if (e.error === 'not-allowed' || e.error === 'permission_denied') {
            showError('Microphone access denied. Please allow microphone access.');
        } else if (e.error === 'no-speech') {
            showError('No speech detected. Please try again.');
        } else {
            showError('Voice recognition error: ' + (e.error || 'unknown'));
        }
    };

    recognition.onend = () => {
        // onend always fires after stop or natural end — ensure UI resets
        stopListening();
    };
} else {
    voiceBtn.disabled = true;
    voiceText.textContent = 'Not Supported';
    showError('Speech recognition is not supported in this browser.');
}

// --- NEW: request mic permission via getUserMedia before starting recognition ---
async function requestMicAccess() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('Microphone access API not available in this browser.');
        return false;
    }
    try {
        // Request a short-lived audio stream solely to prompt permission.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately stop tracks — we just needed permission.
        stream.getTracks().forEach(t => t.stop());
        return true;
    } catch (err) {
        console.error('getUserMedia error:', err);
        showError('Please allow microphone access for voice input.');
        return false;
    }
}

// toggleVoice is wired from HTML, keep same name
async function toggleVoice() {
    if (!recognition) return;

    if (isListening) {
        recognition.stop();
    } else {
        // Request mic permission first (avoids silent failures)
        const allowed = await requestMicAccess();
        if (!allowed) return;
        try {
            recognition.start();
        } catch (err) {
            // start() can throw if already starting or if permissions are in a bad state
            console.error('recognition.start() threw:', err);
            showError('Could not start voice recognition. Try again.');
            stopListening();
        }
    }
}

function stopListening() {
    isListening = false;
    voiceBtn.classList.remove('listening');
    voiceIcon.textContent = '🎤';
    voiceText.textContent = 'Voice Input';
    statusDiv.textContent = 'Tap mic for voice input';
    statusDiv.classList.remove('listening');
}

// Keep showing errors in the same error div
function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
}

// --- Voice processing preserved, small improvement: handle number words optionally ---
function wordsToNumber(word) {
    // minimal mapping for common small words; preserves digits if already provided
    const map = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
        'fifteen': 15, 'twenty': 20, 'thirty': 30, 'forty': 40,
        'fifty': 50, 'hundred': 100, 'thousand': 1000
    };
    const cleaned = word.replace(/[,?]/g, '').trim();
    if (!isNaN(cleaned)) return parseFloat(cleaned);
    if (map[cleaned] !== undefined) return map[cleaned];
    return null;
}

function processVoiceInput(text) {
    // normalize text
    const cleaned = text.toLowerCase();

    // try to extract digits first
    let nums = cleaned.match(/\d+(\.\d+)?/g) || [];

    // if no digit matches, attempt to pull number words (very basic)
    if (nums.length < 2) {
        const tokens = cleaned.split(/\s+/);
        const found = [];
        for (let t of tokens) {
            const n = wordsToNumber(t);
            if (n !== null) found.push(n);
            if (found.length >= 2) break;
        }
        if (found.length >= 2) nums = found.map(String);
    }

    // identify operation
    let operation = null;
    if (cleaned.includes('plus') || cleaned.includes('add') || cleaned.includes('added')) operation = '+';
    else if (cleaned.includes('minus') || cleaned.includes('subtract') || cleaned.includes('subtracted')) operation = '-';
    else if (cleaned.includes('times') || cleaned.includes('multiply') || cleaned.includes('multiplied') || cleaned.includes('x')) operation = '×';
    else if (cleaned.includes('divide') || cleaned.includes('divided') || cleaned.includes('over')) operation = '÷';

    if (nums && nums.length >= 2 && operation) {
        const num1 = parseFloat(nums[0]);
        const num2 = parseFloat(nums[1]);

        // set up calculator state and calculate (preserve your flow)
        currentValue = num1.toString();
        previousValue = num1;
        operator = operation;
        updateDisplay();

        currentValue = num2.toString();
        calculate();

        generateAISummary(num1, num2, operation, text);
    } else {
        resultDiv.textContent = 'Say like: 2 plus 2';
    }
}

// ---------------- Calculator logic (unchanged) ----------------
function appendNumber(num) {
    if (shouldResetDisplay) {
        currentValue = num;
        shouldResetDisplay = false;
        expressionDiv.textContent = '';
    } else {
        currentValue = currentValue === '0' ? num : currentValue + num;
    }
    updateDisplay();
    updateExpression();
}

function setOperator(op) {
    if (operator !== null && !shouldResetDisplay) {
        calculate();
    }
    operator = op;
    previousValue = parseFloat(currentValue);
    shouldResetDisplay = true;
    updateExpression();
}

function calculate() {
    if (operator === null || previousValue === null) return;

    const prev = previousValue;
    const current = parseFloat(currentValue);
    let result;
    let operatorSymbol = operator;

    switch (operator) {
        case '+':
            result = prev + current;
            break;
        case '-':
        case '−':
            result = prev - current;
            operatorSymbol = '-';
            break;
        case '×':
            result = prev * current;
            operatorSymbol = '×';
            break;
        case '÷':
            result = current !== 0 ? prev / current : 'Error';
            operatorSymbol = '÷';
            break;
    }

    if (result !== 'Error') {
        result = Math.round(result * 100000000) / 100000000;
        generateAISummaryFromCalc(prev, current, operatorSymbol, result);
    }

    currentValue = result.toString();
    operator = null;
    previousValue = null;
    shouldResetDisplay = true;
    updateDisplay();
    expressionDiv.textContent = '';
}

function clearAll() {
    currentValue = '0';
    previousValue = null;
    operator = null;
    shouldResetDisplay = false;
    updateDisplay();
    expressionDiv.textContent = '';
}

function deleteOne() {
    if (currentValue.length > 1) {
        currentValue = currentValue.slice(0, -1);
    } else {
        currentValue = '0';
    }
    updateDisplay();
}

function percentage() {
    currentValue = (parseFloat(currentValue) / 100).toString();
    updateDisplay();
}

function updateDisplay() {
    resultDiv.textContent = currentValue;
}

function updateExpression() {
    if (previousValue !== null && operator) {
        expressionDiv.textContent = `${previousValue} ${operator} ${shouldResetDisplay ? '' : currentValue}`;
    } else if (!shouldResetDisplay && currentValue !== '0') {
        expressionDiv.textContent = currentValue;
    }
}

function generateAISummary(num1, num2, op, originalText) {
    const opWord = {'+': 'addition', '-': 'subtraction', '×': 'multiplication', '÷': 'division'}[op];
    const result = parseFloat(resultDiv.textContent);

    aiSummary.className = 'ai-content';
    aiSummary.innerHTML = `
        <strong>Voice Input Detected:</strong> "${originalText}"<br><br>
        I understood you wanted to perform ${opWord}. I calculated ${num1} ${op} ${num2}, which equals <strong>${result}</strong>.<br><br>
        The calculation has been completed and displayed on the calculator above.
    `;
}

function generateAISummaryFromCalc(num1, num2, op, result) {
    const opWord = {'+': 'added', '-': 'subtracted', '×': 'multiplied', '÷': 'divided'}[op];
    const opName = {'+': 'addition', '-': 'subtraction', '×': 'multiplication', '÷': 'division'}[op];

    aiSummary.className = 'ai-content';
    aiSummary.innerHTML = `
        <strong>Calculation Summary:</strong><br><br>
        You ${opWord} ${num1} ${op === '-' ? 'by' : op === '÷' ? 'by' : op === '×' ? 'by' : 'to'} ${num2} using ${opName}.<br><br>
        <strong>Result:</strong> ${num1} ${op} ${num2} = <strong>${result}</strong><br><br>
        ${result < 0 ? 'The result is negative.' : result > 1000 ? 'That\'s quite a large number!' : 'Calculation completed successfully.'}
    `;
}
