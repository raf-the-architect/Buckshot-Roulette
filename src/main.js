/**
 * main.js
 * Entry point for the Vue + Phaser application.
 */

import { GameScene } from "./game/GameScene.js";
import { StartScreen } from "./screens/StartScreen.js";
import { ReplayScreen } from "./screens/ReplayScreen.js";

const { createApp, ref, nextTick, onMounted, onBeforeUnmount } = Vue;

// Create Vue application
const app = createApp({
    components: {
        StartScreen,
        ReplayScreen
    },
    setup() {
        // =========================================================================
        // STATE
        // =========================================================================
        const currentScreen = ref('start'); // 'start' | 'game' | 'replay'
        const playerName = ref('');
        const phaserGame = ref(null);
        const gameResult = ref({
            isWin: false,
            playerName: 'PLAYER'
        });

        // Helper to track start screen visibility for transitions
        const isStartLeaving = ref(false);

        // =========================================================================
        // LIFECYCLE
        // =========================================================================
        onMounted(() => {
            // Load saved player name
            const savedName = localStorage.getItem('buckshot_player_name');
            if (savedName) {
                playerName.value = savedName;
            }

            // Listen for game-over event from Phaser
            window.addEventListener('game-over', onGameOver);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('game-over', onGameOver);
            destroyPhaser();
        });

        // =========================================================================
        // METHODS
        // =========================================================================

        /**
         * Called when StartScreen emits 'start-game'
         */
        function onStartGame({ onSuccess }) {
            const name = playerName.value.trim() || 'PLAYER';
            localStorage.setItem('buckshot_player_name', name);

            // Start exit transition
            isStartLeaving.value = true;

            // Wait for transition (matches CSS time)
            setTimeout(() => {
                currentScreen.value = 'game';
                isStartLeaving.value = false;
                onSuccess?.(); // Let child know loading is done
                createPhaser(name);
            }, 600);
        }

        /**
         * Called from ReplayScreen "Play Again"
         */
        function onReplay() {
            currentScreen.value = 'game';
            destroyPhaser();

            // Small delay to ensure cleanup
            setTimeout(() => {
                createPhaser(gameResult.value.playerName);
            }, 100);
        }

        /**
         * Called from ReplayScreen "Quit"
         */
        function onQuit() {
            destroyPhaser();
            currentScreen.value = 'start';
            // Start component will auto-focus input on mount
        }

        /**
         * Event handler for 'game-over' from Phaser
         */
        function onGameOver(event) {
            const { isWin, playerName } = event.detail;
            gameResult.value = { isWin, playerName };
            currentScreen.value = 'replay';
        }

        /**
         * Creates Phaser instance
         */
        function createPhaser(name) {
            // Detect if landscape orientation
            const isLandscape = window.innerWidth > window.innerHeight;

            const config = {
                type: Phaser.AUTO,
                scale: {
                    mode: isLandscape ? Phaser.Scale.HEIGHT_CONTROLS_WIDTH : Phaser.Scale.EXPAND,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                    width: 360,
                    height: 640
                },
                backgroundColor: 'transparent',
                transparent: true,
                parent: 'phaser-container',
                scene: [GameScene]
            };

            phaserGame.value = new Phaser.Game(config);
            phaserGame.value.registry.set('playerName', name);

            // Shim for GameScene communication
            const gameOverShim = {
                show: (isWin, playerName) => {
                    window.dispatchEvent(new CustomEvent('game-over', {
                        detail: { isWin, playerName }
                    }));
                },
                hide: () => { }
            };
            phaserGame.value.registry.set('gameOverScreen', gameOverShim);
        }

        function destroyPhaser() {
            if (phaserGame.value) {
                phaserGame.value.destroy(true);
                phaserGame.value = null;
            }
        }

        return {
            currentScreen,
            playerName,
            gameResult,
            isStartLeaving,
            onStartGame,
            onReplay,
            onQuit
        };
    }
});

app.mount('#app');
