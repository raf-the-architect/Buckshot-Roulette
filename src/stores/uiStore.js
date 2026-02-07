/**
 * UI Store
 * Manages global UI state such as modals, notifications, and visual settings
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUIStore = defineStore('ui', () => {
    // =========================================================================
    // STATE
    // =========================================================================
    
    // Modal states
    const activeModal = ref(null);
    const modalData = ref(null);
    
    // Toast notifications
    const toasts = ref([]);
    const toastIdCounter = ref(0);
    
    // Game log
    const gameLog = ref([]);
    const maxLogEntries = ref(50);
    const showGameLog = ref(true);
    
    // Target selector
    const showTargetSelector = ref(false);
    const targetSelectorMode = ref(null); // 'shoot' | 'item'
    const targetSelectorCallback = ref(null);
    
    // Loading states
    const globalLoading = ref(false);
    const loadingText = ref('');
    
    // Sound settings
    const soundEnabled = ref(true);
    const musicEnabled = ref(true);
    const sfxVolume = ref(0.7);
    const musicVolume = ref(0.3);
    
    // Animations
    const currentAnimation = ref(null);
    const animationQueue = ref([]);
    
    // Screen state
    const isMobile = ref(window.innerWidth < 768);
    const isFullscreen = ref(false);
    
    // =========================================================================
    // GETTERS
    // =========================================================================
    
    const hasActiveModal = computed(() => activeModal.value !== null);
    const latestLogEntry = computed(() => gameLog.value[gameLog.value.length - 1] || null);
    const isAnimating = computed(() => currentAnimation.value !== null);
    
    // =========================================================================
    // ACTIONS - Modals
    // =========================================================================
    
    /**
     * Open a modal
     * @param {string} modalName - Name of the modal to open
     * @param {Object} data - Optional data to pass to the modal
     */
    function openModal(modalName, data = null) {
        activeModal.value = modalName;
        modalData.value = data;
    }
    
    /**
     * Close the current modal
     */
    function closeModal() {
        activeModal.value = null;
        modalData.value = null;
    }
    
    // =========================================================================
    // ACTIONS - Toasts
    // =========================================================================
    
    /**
     * Show a toast notification
     * @param {Object} options - Toast options
     * @param {string} options.message - Toast message
     * @param {string} options.type - Toast type: 'success' | 'error' | 'warning' | 'info'
     * @param {number} options.duration - Duration in ms (default: 3000)
     */
    function showToast({ message, type = 'info', duration = 3000 }) {
        const id = ++toastIdCounter.value;
        const toast = {
            id,
            message,
            type,
            createdAt: Date.now()
        };
        
        toasts.value.push(toast);
        
        // Auto-remove after duration
        setTimeout(() => {
            removeToast(id);
        }, duration);
        
        return id;
    }
    
    /**
     * Remove a toast by ID
     * @param {number} id - Toast ID
     */
    function removeToast(id) {
        const index = toasts.value.findIndex(t => t.id === id);
        if (index !== -1) {
            toasts.value.splice(index, 1);
        }
    }
    
    // =========================================================================
    // ACTIONS - Game Log
    // =========================================================================
    
    /**
     * Add entry to game log
     * @param {Object} entry - Log entry
     * @param {string} entry.message - Log message
     * @param {string} entry.type - Entry type: 'action' | 'system' | 'damage' | 'item' | 'turn'
     * @param {string} entry.playerId - Associated player ID (optional)
     */
    function addLogEntry({ message, type = 'system', playerId = null, icon = null }) {
        const entry = {
            id: Date.now() + Math.random(),
            message,
            type,
            playerId,
            icon,
            timestamp: new Date().toLocaleTimeString()
        };
        
        gameLog.value.push(entry);
        
        // Trim log if over max entries
        if (gameLog.value.length > maxLogEntries.value) {
            gameLog.value = gameLog.value.slice(-maxLogEntries.value);
        }
    }
    
    /**
     * Clear the game log
     */
    function clearGameLog() {
        gameLog.value = [];
    }
    
    /**
     * Toggle game log visibility
     */
    function toggleGameLog() {
        showGameLog.value = !showGameLog.value;
    }
    
    // =========================================================================
    // ACTIONS - Target Selector
    // =========================================================================
    
    /**
     * Open target selector
     * @param {string} mode - 'shoot' or 'item'
     * @param {Function} callback - Callback when target is selected
     */
    function openTargetSelector(mode, callback) {
        showTargetSelector.value = true;
        targetSelectorMode.value = mode;
        targetSelectorCallback.value = callback;
    }
    
    /**
     * Close target selector
     */
    function closeTargetSelector() {
        showTargetSelector.value = false;
        targetSelectorMode.value = null;
        targetSelectorCallback.value = null;
    }
    
    /**
     * Select a target
     * @param {string} targetId - Selected player ID
     */
    function selectTarget(targetId) {
        if (targetSelectorCallback.value) {
            targetSelectorCallback.value(targetId);
        }
        closeTargetSelector();
    }
    
    // =========================================================================
    // ACTIONS - Loading
    // =========================================================================
    
    /**
     * Show loading overlay
     * @param {string} text - Loading text
     */
    function showLoading(text = 'Loading...') {
        globalLoading.value = true;
        loadingText.value = text;
    }
    
    /**
     * Hide loading overlay
     */
    function hideLoading() {
        globalLoading.value = false;
        loadingText.value = '';
    }
    
    // =========================================================================
    // ACTIONS - Animations
    // =========================================================================
    
    /**
     * Queue an animation
     * @param {Object} animation - Animation config
     */
    function queueAnimation(animation) {
        animationQueue.value.push(animation);
        if (!currentAnimation.value) {
            playNextAnimation();
        }
    }
    
    /**
     * Play next animation in queue
     */
    function playNextAnimation() {
        if (animationQueue.value.length === 0) {
            currentAnimation.value = null;
            return;
        }
        
        currentAnimation.value = animationQueue.value.shift();
    }
    
    /**
     * Complete current animation
     */
    function completeAnimation() {
        playNextAnimation();
    }
    
    // =========================================================================
    // ACTIONS - Sound Settings
    // =========================================================================
    
    function toggleSound() {
        soundEnabled.value = !soundEnabled.value;
    }
    
    function toggleMusic() {
        musicEnabled.value = !musicEnabled.value;
    }
    
    function setSfxVolume(volume) {
        sfxVolume.value = Math.max(0, Math.min(1, volume));
    }
    
    function setMusicVolume(volume) {
        musicVolume.value = Math.max(0, Math.min(1, volume));
    }
    
    // =========================================================================
    // ACTIONS - Screen
    // =========================================================================
    
    function updateScreenSize() {
        isMobile.value = window.innerWidth < 768;
    }
    
    function setFullscreen(value) {
        isFullscreen.value = value;
        if (value) {
            document.documentElement.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }
    
    // Initialize resize listener
    window.addEventListener('resize', updateScreenSize);
    
    // =========================================================================
    // RETURN
    // =========================================================================
    
    return {
        // State
        activeModal,
        modalData,
        toasts,
        gameLog,
        showGameLog,
        showTargetSelector,
        targetSelectorMode,
        globalLoading,
        loadingText,
        soundEnabled,
        musicEnabled,
        sfxVolume,
        musicVolume,
        currentAnimation,
        isMobile,
        isFullscreen,
        
        // Getters
        hasActiveModal,
        latestLogEntry,
        isAnimating,
        
        // Modal actions
        openModal,
        closeModal,
        
        // Toast actions
        showToast,
        removeToast,
        
        // Log actions
        addLogEntry,
        clearGameLog,
        toggleGameLog,
        
        // Target selector actions
        openTargetSelector,
        closeTargetSelector,
        selectTarget,
        
        // Loading actions
        showLoading,
        hideLoading,
        
        // Animation actions
        queueAnimation,
        completeAnimation,
        
        // Sound actions
        toggleSound,
        toggleMusic,
        setSfxVolume,
        setMusicVolume,
        
        // Screen actions
        updateScreenSize,
        setFullscreen
    };
});
