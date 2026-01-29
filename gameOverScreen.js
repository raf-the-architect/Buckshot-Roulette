export class GameOverScreen {
  constructor() {
    this.container = document.getElementById('game-over-screen');
    this.resultTitle = document.getElementById('result-title');
    this.resultMessage = document.getElementById('result-message');
    this.resultIcon = document.getElementById('result-icon');
    this.playerNameDisplay = document.getElementById('player-name-display');
    this.playAgainBtn = document.getElementById('play-again-btn');
    this.quitBtn = document.getElementById('quit-btn');
    
    this.setupListeners();
  }

  setupListeners() {
    this.playAgainBtn.addEventListener('click', () => {
      this.hide();
      if (this.onPlayAgain) {
        this.onPlayAgain();
      }
    });

    this.quitBtn.addEventListener('click', () => {
      this.hide();
      if (this.onQuit) {
        this.onQuit();
      }
    });
  }

  show(isWin, playerName, onPlayAgain, onQuit) {
    this.onPlayAgain = onPlayAgain;
    this.onQuit = onQuit;
    
    // Update content based on win/lose
    if (isWin) {
      this.resultTitle.textContent = 'Victory!';
      this.resultMessage.textContent = 'You defeated the Dealer!';
      this.resultIcon.className = 'icon-wrapper win-icon';
      
      // Change gradient to golden theme for wins
      this.container.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)';
    } else {
      this.resultTitle.textContent = 'Game Over';
      this.resultMessage.textContent = 'The Dealer got you...';
      this.resultIcon.className = 'icon-wrapper lose-icon';
      
      // Keep default blue-purple theme for losses
      this.container.style.background = 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e22ce 100%)';
    }
    
    this.playerNameDisplay.textContent = playerName.toUpperCase();
    
    // Show screen with animation
    this.container.classList.remove('hidden');
    
    // Trigger entrance animation
    const card = this.container.querySelector('.game-over-card');
    card.style.animation = 'none';
    setTimeout(() => {
      card.style.animation = 'slideUpBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    }, 10);
    
    // Add floating animation to shapes
    const shapes = this.container.querySelectorAll('.shape');
    shapes.forEach((shape, index) => {
      shape.style.animation = `float ${6 + index * 0.5}s ease-in-out infinite`;
      shape.style.animationDelay = `${index * 0.8}s`;
    });
  }

  hide() {
    this.container.classList.add('hidden');
  }
}