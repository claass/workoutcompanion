/**
 * Min-Max Companion - Main App Controller
 * Handles tab navigation and app initialization
 */

class MinMaxApp {
    constructor() {
        this.currentTab = this.loadActiveTab();
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.setupTabNavigation();
        this.activateTab(this.currentTab);
    }

    /**
     * Set up tab navigation event listeners
     */
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');

        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = button.getAttribute('data-tab');
                this.activateTab(tab);
            });
        });
    }

    /**
     * Activate a specific tab
     * @param {string} tabName - The name of the tab to activate
     */
    activateTab(tabName) {
        // Deactivate all tabs and screens
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });

        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Activate the selected tab and screen
        const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
        const selectedScreen = document.getElementById(`${tabName}-screen`);

        if (selectedButton && selectedScreen) {
            selectedButton.classList.add('active');
            selectedScreen.classList.add('active');
            this.currentTab = tabName;
            this.saveActiveTab(tabName);
        }
    }

    /**
     * Save the active tab to localStorage
     * @param {string} tabName - The name of the tab to save
     */
    saveActiveTab(tabName) {
        try {
            localStorage.setItem('minmax-active-tab', tabName);
        } catch (error) {
            console.error('Failed to save active tab:', error);
        }
    }

    /**
     * Load the active tab from localStorage
     * @returns {string} - The saved tab name or 'program' as default
     */
    loadActiveTab() {
        try {
            const savedTab = localStorage.getItem('minmax-active-tab');
            return savedTab || 'program';
        } catch (error) {
            console.error('Failed to load active tab:', error);
            return 'program';
        }
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MinMaxApp();
});
