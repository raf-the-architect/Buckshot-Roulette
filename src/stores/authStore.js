/**
 * Auth Store
 * Manages Firebase anonymous authentication and user profiles
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { signInAnonymously, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { generateRandomName } from '@/utils/nameGenerator';

export const useAuthStore = defineStore('auth', () => {
    // =========================================================================
    // STATE
    // =========================================================================
    const user = ref(null);
    const userProfile = ref(null);
    const isLoading = ref(false);
    const error = ref(null);
    const isInitialized = ref(false);

    // =========================================================================
    // GETTERS
    // =========================================================================
    const isAuthenticated = computed(() => !!user.value);
    const userId = computed(() => user.value?.uid);
    const displayName = computed(() => userProfile.value?.displayName || 'Guest');
    const avatar = computed(() => userProfile.value?.avatar || 'avatar_1');

    // =========================================================================
    // ACTIONS
    // =========================================================================

    /**
     * Initialize auth state listener
     * @returns {Promise} Resolves when auth state is determined
     */
    const initAuth = () => {
        return new Promise((resolve, reject) => {
            // Add a timeout to prevent hanging when Firebase is offline
            const timeoutId = setTimeout(() => {
                console.warn('[AuthStore] Auth initialization timed out - Firebase may be offline');
                isInitialized.value = true;
                resolve(null);
            }, 5000); // 5 second timeout

            try {
                const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                    clearTimeout(timeoutId);
                    
                    if (firebaseUser) {
                        user.value = firebaseUser;
                        try {
                            await loadUserProfile(firebaseUser.uid);
                        } catch (err) {
                            console.warn('[AuthStore] Could not load profile:', err.message);
                        }
                    } else {
                        user.value = null;
                        userProfile.value = null;
                    }
                    isInitialized.value = true;
                    resolve(firebaseUser);
                }, (err) => {
                    // Handle auth state error
                    clearTimeout(timeoutId);
                    console.error('[AuthStore] Auth state error:', err);
                    isInitialized.value = true;
                    resolve(null);
                });

                // Return unsubscribe function for cleanup
                return unsubscribe;
            } catch (err) {
                clearTimeout(timeoutId);
                console.error('[AuthStore] Failed to initialize auth:', err);
                isInitialized.value = true;
                resolve(null);
            }
        });
    };

    /**
     * Sign in anonymously and create user profile
     * @returns {Promise<User>} Firebase user object
     */
    const signInAnonymous = async () => {
        isLoading.value = true;
        error.value = null;

        try {
            const result = await signInAnonymously(auth);
            user.value = result.user;

            // Check if user profile exists
            const existingProfile = await getDoc(doc(db, 'users', result.user.uid));

            if (existingProfile.exists()) {
                userProfile.value = existingProfile.data();
            } else {
                // Generate random display name for new user
                const randomName = generateRandomName();
                const avatarNum = Math.floor(Math.random() * 8) + 1;

                // Update Firebase Auth profile
                await updateProfile(result.user, { displayName: randomName });

                // Create user document in Firestore
                const profileData = {
                    userId: result.user.uid,
                    displayName: randomName,
                    avatar: `avatar_${avatarNum}`,
                    createdAt: serverTimestamp(),
                    lastActive: serverTimestamp(),
                    stats: {
                        gamesPlayed: 0,
                        gamesWon: 0,
                        totalKills: 0,
                        favoriteItem: null
                    }
                };

                await setDoc(doc(db, 'users', result.user.uid), profileData);
                userProfile.value = profileData;
            }

            return result.user;
        } catch (err) {
            error.value = err.message;
            console.error('Auth error:', err);
            throw err;
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Load user profile from Firestore
     * @param {string} uid - User ID
     */
    const loadUserProfile = async (uid) => {
        try {
            const docRef = doc(db, 'users', uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                userProfile.value = docSnap.data();
            }
        } catch (err) {
            console.error('Error loading profile:', err);
        }
    };

    /**
     * Update user's last active timestamp
     */
    const updateLastActive = async () => {
        if (user.value) {
            try {
                await updateDoc(doc(db, 'users', user.value.uid), {
                    lastActive: serverTimestamp()
                });
            } catch (err) {
                console.error('Error updating last active:', err);
            }
        }
    };

    /**
     * Update display name
     * @param {string} newName - New display name
     */
    const updateDisplayName = async (newName) => {
        if (!user.value) return;

        try {
            await updateProfile(user.value, { displayName: newName });
            await updateDoc(doc(db, 'users', user.value.uid), {
                displayName: newName
            });
            userProfile.value = { ...userProfile.value, displayName: newName };
        } catch (err) {
            error.value = err.message;
            throw err;
        }
    };

    return {
        // State
        user,
        userProfile,
        isLoading,
        error,
        isInitialized,

        // Getters
        isAuthenticated,
        userId,
        displayName,
        avatar,

        // Actions
        initAuth,
        signInAnonymous,
        loadUserProfile,
        updateLastActive,
        updateDisplayName
    };
});
