 // --- Voice calculator fixes ---
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

// --- Initialize recognition ---
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
        const transcript = e.results[0][0].transcript.toLowerCase().trim();
        processVoiceInput(transcript);
    };

    recognition.onerror = (e) => {
        console.error('Speech error:', e.error);
        stopListening();
        showError(
            e.error === 'not-allowed' || e.error === 'permission_denied'
                ? 'Microphone access denied. Please allow microphone access.'
                : e.error === 'no-speech'
                ? 'No speech detected. Please try again.'
                : 'Voice recognition error: ' + (e.error || 'unknown')
        );
    };

    recognition.onend = () => {
        // auto reset UI and allow reactivation
        stopListening();
        // Small delay to ensure browser resets mic state
        setTimeout(() => {
            isListening = false;
        }, 300);
    };
} else {
    voiceBtn.disabled = true;
    voiceText.textContent = 'Not Supported';
    showError('Speech recognition not supported in this browser.');
}

// --- Request mic permission safely ---
async function requestMicAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
        showError('Microphone API unavailable.');
        return false;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        return true;
    } catch (err) {
        console.error('getUserMedia error:', err);
        showError('Please allow microphone access for voice input.');
        return false;
    }
}

// --- Toggle mic ---
async function toggleVoice() {
    if (!recognition) return;
    if (isListening) {
        recognition.stop();
    } else {
        const allowed = await requestMicAccess();
        if (!allowed) return;
        try {
            recognition.start();
        } catch (err) {
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

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
}

// --- Convert words to numbers (basic) ---
function wordsToNumber(word) {
    const map = {
        zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
        eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
        fifteen: 15, twenty: 20, thirty: 30, forty: 40,
        fifty: 50, hundred: 100, thousand: 1000
    };
    const cleaned = word.replace(/[,?]/g, '').trim();
    if (!isNaN(cleaned)) return parseFloat(cleaned);
    return map[cleaned] ?? null;
}

// --- Voice input handler ---
function processVoiceInput(text) {
    const cleaned = text.toLowerCase();
    let nums = cleaned.match(/\d+(\.\d+)?/g) || [];

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

    let operation = null;
    if (cleaned.includes('plus') || cleaned.includes('add')) operation = '+';
    else if (cleaned.includes('minus') || cleaned.includes('subtract')) operation = '-';
    else if (cleaned.includes('times') || cleaned.includes('multiply') || cleaned.includes('x')) operation = '×';
    else if (cleaned.includes('divide') || cleaned.includes('divided') || cleaned.includes('over')) operation = '÷';

    if (nums.length >= 2 && operation) {
        const num1 = parseFloat(nums[0]);
        const num2 = parseFloat(nums[1]);

        currentValue = num1.toString();
        previousValue = num1;
        operator = operation;
        updateDisplay();

        currentValue = num2.toString();
        calculate();

        // ensure summary always updates
        setTimeout(() => generateAISummary(num1, num2, operation, text), 150);
    } else {
        resultDiv.textContent = 'Say: 5 plus 2';
    }
}

// ---------------- Calculator logic ----------------
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
    if (operator !== null && !shouldResetDisplay) calculate();
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

    switch (operator) {
        case '+': result = prev + current; break;
        case '-': result = prev - current; break;
        case '×': result = prev * current; break;
        case '÷': result = current !== 0 ? prev / current : 'Error'; break;
    }

    if (result !== 'Error') {
        result = Math.round(result * 1e8) / 1e8;
        generateAISummaryFromCalc(prev, current, operator, result);
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
    currentValue = currentValue.length > 1 ? currentValue.slice(0, -1) : '0';
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

// --- Summaries ---
function generateAISummary(num1, num2, op, originalText) {
    const opWord = { '+': 'addition', '-': 'subtraction', '×': 'multiplication', '÷': 'division' }[op];
    const result = parseFloat(resultDiv.textContent);
    aiSummary.className = 'ai-content';
    aiSummary.innerHTML = `
        <strong>Voice Input Detected:</strong> "${originalText}"<br><br>
        I performed ${opWord}: ${num1} ${op} ${num2} = <strong>${result}</strong>.
    `;
}

function generateAISummaryFromCalc(num1, num2, op, result) {
    const opWord = { '+': 'added', '-': 'subtracted', '×': 'multiplied', '÷': 'divided' }[op];
    const opName = { '+': 'addition', '-': 'subtraction', '×': 'multiplication', '÷': 'division' }[op];
    aiSummary.className = 'ai-content';
    aiSummary.innerHTML = `
        <strong>Calculation Summary:</strong><br><br>
        You ${opWord} ${num1} ${op === '-' ? 'by' : 'to'} ${num2} using ${opName}.<br>
        Result: <strong>${result}</strong>.
    `;
}
