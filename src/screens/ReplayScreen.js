/**
 * ReplayScreen.js
 * Dedicated component for displaying game results and options
 */
const { onMounted, ref, nextTick } = Vue;

export const ReplayScreen = {
    name: 'ReplayScreen',
    props: {
        result: {
            type: Object,
            required: true,
            default: () => ({ isWin: false, playerName: 'PLAYER' })
        }
    },
    emits: ['play-again', 'quit'],
    setup(props, { emit }) {
        const gameOverCard = ref(null);

        // Animate card on mount
        onMounted(() => {
            if (gameOverCard.value) {
                // Reset animation
                gameOverCard.value.style.animation = 'none';
                void gameOverCard.value.offsetHeight; // trigger reflow
                gameOverCard.value.style.animation = 'slideUpBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
            }
        });

        function onPlayAgain() {
            emit('play-again');
        }

        function onQuit() {
            emit('quit');
        }

        return {
            gameOverCard,
            onPlayAgain,
            onQuit
        };
    },
    template: `
    <div id="game-over-screen">
        <div class="game-over-container">
            <!-- Celebration Background -->
            <div class="celebration-bg">
                <div class="floating-shapes">
                    <div class="shape shape-1"></div>
                    <div class="shape shape-2"></div>
                    <div class="shape shape-3"></div>
                    <div class="shape shape-4"></div>
                    <div class="shape shape-5"></div>
                    <div class="shape shape-6"></div>
                </div>
            </div>

            <!-- Game Over Card -->
            <div class="game-over-card" ref="gameOverCard">
                <div class="result-icon">
                    <div :class="['icon-wrapper', result.isWin ? 'win-icon' : 'lose-icon']"></div>
                </div>

                <h1 class="result-title">{{ result.isWin ? 'Victory!' : 'Game Over' }}</h1>
                <p class="result-message">{{ result.isWin ? 'You defeated the Dealer!' : 'The Dealer got you...' }}</p>

                <div class="player-name-display">
                    <span class="player-label">Player</span>
                    <span class="player-name">{{ result.playerName.toUpperCase() }}</span>
                </div>

                <div class="action-buttons">
                    <button class="play-again-btn" @click="onPlayAgain">
                        <span class="btn-text">Play Again</span>
                        <div class="btn-glow"></div>
                    </button>

                    <button class="quit-btn" @click="onQuit">
                        <span class="btn-text">Quit to Menu</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
    `
};
