// === Global state ===
let autoClickerTimeoutId = null;
let previousStateWasStop = false; // Track button state for sound notification
let audioCtx = null; // Reuseable AudioContext for sound

// === CONFIGURATION ===
const textToFill = "continue"; // Text to put in textarea
const buttonSelector = '[mattooltipclass="run-button-tooltip"]'; // Target button
const textareaSelector = 'textarea.gmat-body-medium'; // Target textarea
const minInterval = 2000; // Minimum wait time in ms (e.g., 2 seconds)
const maxInterval = 10000; // Maximum wait time in ms (e.g., 10 seconds)
// === END CONFIGURATION ===

// --- Sound Notification Function ---
function playNotificationSound() {
    try {
        // Initialize AudioContext on first use (often needs implicit user gesture like starting script)
        if (!audioCtx || audioCtx.state === 'closed') {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
             if (!audioCtx) {
                console.warn("AutoClicker: AudioContext not supported. Cannot play sound.");
                return; // Exit if context can't be created
            }
        }

        // Resume context if it was suspended by the browser
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain(); // Control volume

        oscillator.type = 'sine'; // Simple tone
        oscillator.frequency.setValueAtTime(660, audioCtx.currentTime); // E5 note frequency
        gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime); // Adjust volume (0 to 1)
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5); // Fade out

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5); // Play for 500ms

        console.log('%cAutoClicker: Ding! (Detected Stop -> Ready state change)', 'color: magenta; font-weight: bold;');

    } catch (e) {
        console.error("AutoClicker: Error playing sound:", e);
        // If context fails, nullify it so it might try again, unless specific error prevents it
        if (e.name === 'SecurityError' || e.name === 'NotAllowedError') {
             console.warn("AutoClicker: Browser blocked audio playback. Disable sound or ensure interaction.");
        }
        audioCtx = null; // Reset context on error, maybe it works next time
    }
}


// --- Main AutoClicker Function ---
function startAutoClicker(playSoundOnChange = false) { // Optional parameter for sound
    // Prevent multiple instances
    if (autoClickerTimeoutId !== null) {
        console.warn("AutoClicker: Already running. Stop the current instance with stopAutoClicker() first.");
        return;
    }

    console.log(`%cAutoClicker Initializing:
    - Text to fill: "${textToFill}"
    - Button Selector: "${buttonSelector}"
    - Textarea Selector: "${textareaSelector}"
    - Interval: Random between ${minInterval}ms and ${maxInterval}ms
    - Sound on 'Stop' -> 'Ready' change: ${playSoundOnChange}
    - To stop, type: stopAutoClicker()`,
    "color: blue; font-weight: bold;"
    );

    // --- 1. PREFILL TEXTAREA ON START (if empty) ---
    try {
        const initialTextarea = document.querySelector(textareaSelector);
        if (initialTextarea && initialTextarea.value.trim() === '') {
            console.log(`AutoClicker: Pre-filling empty textarea with: "${textToFill}"`);
            initialTextarea.value = textToFill;
            initialTextarea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            initialTextarea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            initialTextarea.focus(); // Helps ensure detection sometimes
            initialTextarea.blur(); // Helps ensure detection sometimes
        } else if (initialTextarea) {
             console.log("AutoClicker: Initial textarea not empty, skipping prefill.");
        } else {
            console.warn("AutoClicker: Initial textarea not found, cannot prefill.");
        }

        // Initialize previous button state for sound logic
        const initialButton = document.querySelector(buttonSelector);
        if (initialButton) {
            const initialInnerSpan = initialButton.querySelector('div.inner span');
            const initialButtonText = initialInnerSpan ? initialInnerSpan.textContent.trim().toLowerCase() : '';
            previousStateWasStop = (initialButtonText === 'stop');
            console.log(`AutoClicker: Initial button state detected. Is 'Stop': ${previousStateWasStop}`);
        } else {
             previousStateWasStop = false; // Assume not stopped if button isn't found
             console.log("AutoClicker: Initial button not found, assuming initial state is not 'Stop'.");
        }

    } catch (e) {
        console.error("AutoClicker: Error during initialization/prefill:", e);
    }


    // --- Internal function for the check/click logic (recursive via setTimeout) ---
    function checkAndClick() {
        // Make sure we haven't been stopped externally
        if (autoClickerTimeoutId === null) {
             console.log("AutoClicker: Loop detected stop signal, halting check.");
             return;
        }

        try {
            const button = document.querySelector(buttonSelector);
            const textarea = document.querySelector(textareaSelector);
            let currentIsStopButton = false; // Default assumption

            if (!button) {
                console.warn('AutoClicker: Button not found.');
                 // If button disappears, treat it as no longer being a "Stop" button
                 currentIsStopButton = false;
                 // If sound is enabled and it was previously stop, play sound
                if (playSoundOnChange && previousStateWasStop && !currentIsStopButton) {
                    console.log("AutoClicker: Button disappeared, likely indicating state change.");
                    playNotificationSound();
                 }
                previousStateWasStop = false; // Update state since button is gone

            } else {
                // Check for "Stop" text within the specified inner structure
                const innerSpan = button.querySelector('div.inner span');
                const buttonText = innerSpan ? innerSpan.textContent.trim().toLowerCase() : '';
                currentIsStopButton = (buttonText === 'stop');

                // Check disabled state
                const isDisabled = button.disabled || button.getAttribute('aria-disabled') === 'true';

                 // --- 3. SOUND NOTIFICATION LOGIC ---
                 // Play sound if: sound enabled AND it *was* stop AND it *is now not* stop
                 if (playSoundOnChange && previousStateWasStop && !currentIsStopButton) {
                     console.log("AutoClicker: Detected state change from 'Stop' to Ready/Run.");
                     playNotificationSound();
                 }
                 // Update previous state *after* the check for next iteration
                 previousStateWasStop = currentIsStopButton;


                console.log(`AutoClicker: Checking - Button Found. Disabled: ${isDisabled}, Text: "${buttonText}" (Is Stop: ${currentIsStopButton})`);

                // --- Conditions to click: Button exists, is NOT disabled, and does NOT say "Stop" ---
                if (!isDisabled && !currentIsStopButton) {
                    console.log('%cAutoClicker: Conditions met! Preparing to click.', 'color: green');

                    if (!textarea) {
                        console.warn('AutoClicker: Textarea not found. Cannot fill text, but will attempt click.');
                    } else {
                        // Fill textarea every time before clicking
                        console.log(`AutoClicker: Filling textarea with: "${textToFill}"`);
                        textarea.value = textToFill;
                        textarea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                        textarea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                        textarea.focus();
                        textarea.blur();
                        console.log('AutoClicker: Textarea value set and events dispatched.');
                    }

                    console.log('%cAutoClicker: Clicking the button!', 'color: green; font-weight: bold;');
                    button.click();
                    console.log('AutoClicker: Click action performed.');

                } else {
                    if (isDisabled) console.log('AutoClicker: Condition not met - Button is disabled.');
                    if (currentIsStopButton) console.log('AutoClicker: Condition not met - Button says "Stop".');
                }
            }
        } catch (error) {
            console.error('AutoClicker: An error occurred during check/click:', error);
            console.log('%cAutoClicker: Stopping due to error.', 'color: orange;');
            stopAutoClicker(); // Stop the loop if a critical error occurs
            return; // Prevent scheduling next check
        }

        // --- 2. RANDOMIZED INTERVAL & Reschedule ---
        if (autoClickerTimeoutId !== null) { // Check if we haven't been stopped in the meantime
            const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
            console.log(`AutoClicker: Next check scheduled in ${randomInterval}ms.`);
            autoClickerTimeoutId = setTimeout(checkAndClick, randomInterval);
        }
    }

    // --- Function to stop the loop (defined globally) ---
    window.stopAutoClicker = function() {
        if (autoClickerTimeoutId) {
            clearTimeout(autoClickerTimeoutId);
            autoClickerTimeoutId = null; // Critical: Mark as stopped
            console.log('%cAutoClicker: Stopped by user command.', 'color: red; font-weight: bold;');
        } else {
            console.log('%cAutoClicker: Already stopped or was never started properly.', 'color: yellow;');
        }
        // Optional: You could close the audio context here if desired, but leaving it
        // open might allow restarting sound faster if the script runs again.
        // if (audioCtx && audioCtx.state !== 'closed') { audioCtx.close(); audioCtx = null; }
    };

    // --- Initial call to start the process ---
    // Add a very small delay before the first check to ensure initialization completes
    autoClickerTimeoutId = setTimeout(checkAndClick, 50); // Start first check almost immediately
    console.log("AutoClicker: First check scheduled.");

}

// === HOW TO USE ===
// 1. Paste the ENTIRE script block above into the developer console and press Enter.
//    (This defines the functions `startAutoClicker`, `stopAutoClicker`, `playNotificationSound`)
//
// 2. To START the process WITHOUT sound notification:
//    Type this into the console and press Enter:
//    startAutoClicker()
//
// 3. To START the process WITH sound notification when the button changes from "Stop" back to "Run/Ready":
//    Type this into the console and press Enter:
//    startAutoClicker(true)
//
// 4. To STOP the process at any time:
//    Type this into the console and press Enter:
//    stopAutoClicker()
