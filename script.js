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
        
        // Initialize speech recognition
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
                const transcript = e.results[0][0].transcript.toLowerCase();
                processVoiceInput(transcript);
            };
            
            recognition.onerror = (e) => {
                console.error('Speech error:', e.error);
                stopListening();
                if (e.error === 'not-allowed') {
                    showError('Microphone access denied. Please allow microphone access.');
                }
            };
            
            recognition.onend = () => {
                stopListening();
            };
        } else {
            voiceBtn.disabled = true;
            voiceText.textContent = 'Not Supported';
        }
        
        function toggleVoice() {
            if (!recognition) return;
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
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
        
        function processVoiceInput(text) {
            let nums = text.match(/\d+(\.\d+)?/g);
            let operation = null;
            
            if (text.includes('plus') || text.includes('add')) operation = '+';
            else if (text.includes('minus') || text.includes('subtract')) operation = '-';
            else if (text.includes('times') || text.includes('multiply') || text.includes('multiplied')) operation = '×';
            else if (text.includes('divide') || text.includes('divided')) operation = '÷';
            
            if (nums && nums.length >= 2 && operation) {
                const num1 = parseFloat(nums[0]);
                const num2 = parseFloat(nums[1]);
                
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