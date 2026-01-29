export class StartScreen {
    constructor(onStart) {
        this.onStart = onStart;
        this.container = document.getElementById('start-screen');
        this.input = document.getElementById('player-name');
        this.btn = document.getElementById('btn-start');

        // Load saved name
        const savedName = localStorage.getItem('buckshot_player_name');
        if (savedName) {
            this.input.value = savedName;
        }

        this.checkInput();
        this.setupListeners();
    }

    setupListeners() {
        // Input validation
        this.input.addEventListener('input', () => this.checkInput());

        // Enter key support
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.btn.disabled) {
                this.startGame();
            }
        });

        // Button click
        this.btn.addEventListener('click', () => {
            if (!this.btn.disabled) {
                this.startGame();
            }
        });

        // Sound effect on hover (optional enhancement if we had sound assets here)
    }

    checkInput() {
        const val = this.input.value.trim();
        if (val.length > 0) {
            this.btn.disabled = false;
        } else {
            this.btn.disabled = true;
        }
    }

    startGame() {
        const name = this.input.value.trim() || "PLAYER";

        // Save for next time
        localStorage.setItem('buckshot_player_name', name);

        // Disable UI
        this.input.disabled = true;
        this.btn.disabled = true;
        this.btn.textContent = "Loading...";

        // Animation out
        this.container.classList.add('hidden');

        // Wait for transition, then callback
        setTimeout(() => {
            this.container.style.display = 'none';
            if (this.onStart) {
                this.onStart(name);
            }
        }, 600); // Matches CSS transition duration
    }
}
