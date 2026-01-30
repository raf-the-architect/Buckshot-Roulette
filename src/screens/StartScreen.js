/**
 * StartScreen.js
 * Dedicated component for the initial welcome screen
 */
const { ref, computed } = Vue;

export const StartScreen = {
    name: 'StartScreen',
    props: {
        modelValue: {
            type: String, // playerName
            default: ''
        }
    },
    emits: ['update:modelValue', 'start-game'],
    setup(props, { emit }) {
        const isLoading = ref(false);
        const nameInput = ref(null);

        // Computed property for two-way binding with validation
        const playerNameProxy = computed({
            get: () => props.modelValue,
            set: (val) => emit('update:modelValue', val)
        });

        const canStart = computed(() => props.modelValue.trim().length > 0);

        function handleStart() {
            if (!canStart.value || isLoading.value) return;

            isLoading.value = true;

            // Emit start event - parent handles the transition and game creation
            emit('start-game', {
                onSuccess: () => {
                    isLoading.value = false;
                }
            });
        }

        // Expose focus method for parent to call if needed
        function focusInput() {
            nameInput.value?.focus();
        }

        return {
            isLoading,
            nameInput,
            playerNameProxy,
            canStart,
            handleStart,
            focusInput
        };
    },
    template: `
    <div id="start-screen">
        <div class="glass-card">
            <h1 class="game-title">Buckshot<br>Roulette</h1>
            <p class="game-subtitle">
                Take turns.<br>
                Choose wisely.<br>
                Survive the round!
            </p>

            <div class="input-group">
                <input 
                    type="text" 
                    class="name-input" 
                    placeholder="Enter Player Name" 
                    maxlength="12"
                    autocomplete="off" 
                    v-model="playerNameProxy" 
                    @keydown.enter="handleStart" 
                    :disabled="isLoading"
                    ref="nameInput" 
                />
            </div>

            <button class="start-btn" :disabled="!canStart || isLoading" @click="handleStart">
                {{ isLoading ? 'Loading...' : 'Start Game' }}
            </button>
        </div>
    </div>
    `
};
