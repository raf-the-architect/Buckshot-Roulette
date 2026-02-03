/**
 * Firebase Cloud Functions for Buckshot Roulette
 * 
 * These functions handle:
 * - AFK player detection and turn skipping
 * - Stale room cleanup
 * - Game action logging for analytics
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

// =========================================================================
// CONSTANTS
// =========================================================================

const AFK_TIMEOUT_MS = 45000; // 45 seconds (15s buffer over client's 30s timer)
const ROOM_STALE_HOURS = 24; // Clean up rooms older than 24 hours
const TURN_TIME_LIMIT_MS = 30000; // 30 seconds

// =========================================================================
// AFK DETECTION FUNCTION
// =========================================================================

/**
 * Check for AFK players every 30 seconds
 * Runs on a schedule to detect players who haven't acted within the time limit
 */
exports.checkAfkPlayers = functions.pubsub
    .schedule('every 30 seconds')
    .onRun(async (context) => {
        const now = Date.now();
        
        try {
            // Get all active games
            const gamesSnapshot = await db.collection('games')
                .where('status', '==', 'playing')
                .get();
            
            if (gamesSnapshot.empty) {
                console.log('No active games found');
                return null;
            }

            const batch = db.batch();
            let batchCount = 0;

            for (const gameDoc of gamesSnapshot.docs) {
                const game = gameDoc.data();
                
                // Check if current player has exceeded turn time
                const turnStartTime = game.turnStartTime?.toMillis() || now;
                const turnDuration = now - turnStartTime;
                
                if (turnDuration > AFK_TIMEOUT_MS) {
                    const currentPlayer = game.players?.[game.currentTurnIndex];
                    
                    if (currentPlayer) {
                        console.log(`AFK detected: ${currentPlayer.displayName} in game ${gameDoc.id}`);
                        
                        // Force skip turn
                        const updatedGame = forceSkipTurn(game);
                        
                        // Add AFK action to game log
                        const actionRef = db.collection('games')
                            .doc(gameDoc.id)
                            .collection('actions')
                            .doc();
                        
                        batch.set(actionRef, {
                            type: 'AFK_TIMEOUT',
                            playerId: currentPlayer.userId,
                            playerName: currentPlayer.displayName,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            message: `${currentPlayer.displayName} was AFK - turn skipped`
                        });
                        
                        // Update game state
                        batch.update(gameDoc.ref, {
                            ...updatedGame,
                            turnStartTime: admin.firestore.FieldValue.serverTimestamp(),
                            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                        });
                        
                        batchCount++;
                    }
                }
            }

            if (batchCount > 0) {
                await batch.commit();
                console.log(`Processed ${batchCount} AFK players`);
            }

            return null;
        } catch (error) {
            console.error('Error checking AFK players:', error);
            return null;
        }
    });

/**
 * Force skip a turn for an AFK player
 * Applies a penalty shot if there are rounds in the chamber
 */
function forceSkipTurn(game) {
    const updatedGame = { ...game };
    const currentPlayer = updatedGame.players[updatedGame.currentTurnIndex];
    
    // Add timeout message to logs
    updatedGame.logs = updatedGame.logs || [];
    updatedGame.logs.push(`⏰ ${currentPlayer.displayName} timed out!`);
    
    // Apply penalty: shoot self with current round
    if (updatedGame.shotgun?.chamber?.length > 0) {
        const round = updatedGame.shotgun.chamber.pop();
        const isLive = !!round;
        
        if (isLive) {
            updatedGame.shotgun.liveRounds--;
            currentPlayer.health--;
            updatedGame.logs.push(`💥 Penalty shot! ${currentPlayer.displayName} took 1 damage.`);
            
            if (currentPlayer.health <= 0) {
                currentPlayer.isAlive = false;
                currentPlayer.health = 0;
                updatedGame.logs.push(`☠️ ${currentPlayer.displayName} has been eliminated!`);
                
                // Check for game over
                const alivePlayers = updatedGame.players.filter(p => p.isAlive);
                if (alivePlayers.length <= 1) {
                    updatedGame.status = 'ended';
                    if (alivePlayers.length === 1) {
                        updatedGame.winnerId = alivePlayers[0].userId;
                        updatedGame.logs.push(`🏆 ${alivePlayers[0].displayName} WINS!`);
                    }
                }
            }
        } else {
            updatedGame.shotgun.blankRounds--;
        }
    }
    
    // Move to next turn
    advanceToNextPlayer(updatedGame);
    
    return updatedGame;
}

/**
 * Advance to the next alive player
 */
function advanceToNextPlayer(game) {
    const playerCount = game.players.length;
    let attempts = 0;
    
    do {
        game.currentTurnIndex = (game.currentTurnIndex + 1) % playerCount;
        const player = game.players[game.currentTurnIndex];
        
        if (!player.isAlive) {
            attempts++;
            continue;
        }
        
        // Check for handcuffs
        if (player.turnsWaiting > 0) {
            player.turnsWaiting--;
            game.logs.push(`⛓️ ${player.displayName} is handcuffed! Turn skipped.`);
            attempts++;
            continue;
        }
        
        // Found valid player
        game.turnNumber = (game.turnNumber || 0) + 1;
        break;
        
    } while (attempts < playerCount * 2);
}

// =========================================================================
// ROOM CLEANUP FUNCTION
// =========================================================================

/**
 * Clean up stale rooms daily
 * Removes rooms that haven't been updated in 24+ hours
 */
exports.cleanupOldRooms = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        const cutoffTime = new Date(Date.now() - ROOM_STALE_HOURS * 60 * 60 * 1000);
        
        try {
            // Find stale rooms
            const staleRoomsSnapshot = await db.collection('rooms')
                .where('lastUpdated', '<', cutoffTime)
                .get();
            
            if (staleRoomsSnapshot.empty) {
                console.log('No stale rooms found');
                return null;
            }

            const batch = db.batch();
            let deleteCount = 0;

            for (const roomDoc of staleRoomsSnapshot.docs) {
                const room = roomDoc.data();
                
                // Don't delete rooms with active games
                if (room.status === 'playing') {
                    // Check if the game is also stale
                    const gameSnapshot = await db.collection('games')
                        .where('roomId', '==', roomDoc.id)
                        .where('status', '==', 'playing')
                        .get();
                    
                    if (!gameSnapshot.empty) {
                        console.log(`Skipping room ${roomDoc.id} - has active game`);
                        continue;
                    }
                }
                
                console.log(`Deleting stale room: ${roomDoc.id} (last updated: ${room.lastUpdated?.toDate()})`);
                batch.delete(roomDoc.ref);
                deleteCount++;
            }

            if (deleteCount > 0) {
                await batch.commit();
                console.log(`Deleted ${deleteCount} stale rooms`);
            }

            return null;
        } catch (error) {
            console.error('Error cleaning up rooms:', error);
            return null;
        }
    });

/**
 * Clean up associated game data when a room is deleted
 */
exports.onRoomDeleted = functions.firestore
    .document('rooms/{roomId}')
    .onDelete(async (snapshot, context) => {
        const roomId = context.params.roomId;
        
        try {
            // Delete associated games
            const gamesSnapshot = await db.collection('games')
                .where('roomId', '==', roomId)
                .get();
            
            if (!gamesSnapshot.empty) {
                const batch = db.batch();
                
                for (const gameDoc of gamesSnapshot.docs) {
                    // Delete game actions first
                    const actionsSnapshot = await gameDoc.ref.collection('actions').get();
                    for (const actionDoc of actionsSnapshot.docs) {
                        batch.delete(actionDoc.ref);
                    }
                    batch.delete(gameDoc.ref);
                }
                
                await batch.commit();
                console.log(`Cleaned up ${gamesSnapshot.size} games for room ${roomId}`);
            }
            
            return null;
        } catch (error) {
            console.error('Error cleaning up room data:', error);
            return null;
        }
    });

// =========================================================================
// GAME ACTION LOGGING
// =========================================================================

/**
 * Log game actions for analytics
 * Triggered when a new action is added to a game
 */
exports.logGameAction = functions.firestore
    .document('games/{gameId}/actions/{actionId}')
    .onCreate(async (snapshot, context) => {
        const action = snapshot.data();
        const gameId = context.params.gameId;
        const actionId = context.params.actionId;
        
        try {
            // Get game info for context
            const gameDoc = await db.collection('games').doc(gameId).get();
            const game = gameDoc.data();
            
            // Log to analytics collection
            await db.collection('analytics').add({
                type: 'game_action',
                gameId: gameId,
                actionId: actionId,
                actionType: action.type,
                playerId: action.playerId,
                roomId: game?.roomId,
                playerCount: game?.players?.length || 0,
                roundNumber: game?.roundNumber || 0,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Update player stats if it's a significant action
            if (action.playerId && ['SHOOT_OTHER', 'SHOOT_SELF'].includes(action.type)) {
                const userRef = db.collection('users').doc(action.playerId);
                
                if (action.type === 'SHOOT_OTHER' && action.result?.isLive) {
                    // Increment kill count
                    await userRef.update({
                        'stats.totalKills': admin.firestore.FieldValue.increment(1)
                    });
                }
            }
            
            console.log(`Logged action: ${action.type} in game ${gameId}`);
            return null;
        } catch (error) {
            console.error('Error logging game action:', error);
            return null;
        }
    });

/**
 * Update player stats when a game ends
 */
exports.onGameEnded = functions.firestore
    .document('games/{gameId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        
        // Only process when game transitions to 'ended'
        if (before.status === 'ended' || after.status !== 'ended') {
            return null;
        }
        
        const gameId = context.params.gameId;
        
        try {
            const batch = db.batch();
            
            // Update stats for all players
            for (const player of after.players) {
                const userRef = db.collection('users').doc(player.userId);
                const isWinner = player.userId === after.winnerId;
                
                batch.update(userRef, {
                    'stats.gamesPlayed': admin.firestore.FieldValue.increment(1),
                    'stats.gamesWon': admin.firestore.FieldValue.increment(isWinner ? 1 : 0),
                    lastActive: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            
            await batch.commit();
            console.log(`Updated stats for game ${gameId}`);
            
            return null;
        } catch (error) {
            console.error('Error updating game stats:', error);
            return null;
        }
    });

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================

/**
 * HTTP function to get server status
 * Useful for health checks
 */
exports.healthCheck = functions.https.onRequest((req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

/**
 * Callable function to force end a stuck game (admin only)
 */
exports.forceEndGame = functions.https.onCall(async (data, context) => {
    // Verify admin (you can add more robust admin checking here)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    
    const { gameId } = data;
    
    if (!gameId) {
        throw new functions.https.HttpsError('invalid-argument', 'Game ID required');
    }
    
    try {
        const gameRef = db.collection('games').doc(gameId);
        const gameDoc = await gameRef.get();
        
        if (!gameDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Game not found');
        }
        
        await gameRef.update({
            status: 'ended',
            endedReason: 'forced',
            endedBy: context.auth.uid,
            endedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, message: 'Game ended successfully' };
    } catch (error) {
        console.error('Error forcing game end:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
