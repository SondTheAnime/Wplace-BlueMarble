/**
 * TemplateGallery - Modal gallery interface for managing loaded templates
 * 
 * Provides a visual gallery interface that allows users to view, manage,
 * and interact with all loaded templates in the Blue Marble system.
 */
export default class TemplateGallery {
    /**
     * Creates a new TemplateGallery instance
     * @param {Object} templateManager - TemplateManager instance for accessing templates
     * @param {Object} overlay - Overlay instance for modal functionality
     */
    constructor(templateManager, overlay) {
        this.templateManager = templateManager;
        this.overlay = overlay;
        this.isVisible = false;
        this.galleryElement = null;
        this.templateCards = new Map(); // Cache for template cards

        // Bind methods to preserve context
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.refresh = this.refresh.bind(this);
        this.handleTemplateToggle = this.handleTemplateToggle.bind(this);
        this.handleTemplateRemove = this.handleTemplateRemove.bind(this);
        this.handleTemplateNavigate = this.handleTemplateNavigate.bind(this);
        this.createTemplateCard = this.createTemplateCard.bind(this);
    }

    /**
     * Shows the template gallery modal
     * Requirements: 1.1, 5.1, 5.2, 5.3
     */
    show() {
        if (this.isVisible) return;

        // Create gallery modal if it doesn't exist
        if (!this.galleryElement) {
            this.createGalleryModal();
        }

        // Refresh template list
        this.refresh();

        this.isVisible = true;
    }

    /**
     * Hides the template gallery modal
     * Requirements: 5.1, 5.2, 5.3
     */
    hide() {
        if (!this.isVisible || !this.galleryElement) return;

        // Use the Overlay class closeModal method for proper cleanup
        this.overlay.closeModal(this.galleryElement);

        this.isVisible = false;
        this.galleryElement = null; // Reset reference since modal is removed from DOM
    }

    /**
     * Refreshes the template gallery with current templates
     * Updates the display to reflect current state of templateManager
     */
    refresh() {
        if (!this.galleryElement) return;

        const contentArea = this.galleryElement.querySelector('#bm-gallery-content');
        const templateGrid = contentArea.querySelector('.bm-template-grid');
        const emptyState = contentArea.querySelector('#bm-gallery-empty');
        const countElement = this.galleryElement.querySelector('#bm-gallery-count');

        // Clear existing cards
        templateGrid.innerHTML = '';
        this.templateCards.clear();

        // Get templates from templateManager
        const templates = this.templateManager.templatesArray || [];

        // Update template count in header
        if (countElement) {
            const count = templates.length;
            countElement.textContent = count === 1 ? '1 template' : `${count} templates`;
        }

        if (templates.length === 0) {
            // Show empty state
            templateGrid.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            // Hide empty state and show templates
            emptyState.style.display = 'none';
            templateGrid.style.display = 'grid';

            // Create cards for each template
            templates.forEach(template => {
                const card = this.createTemplateCard(template);
                templateGrid.appendChild(card);
            });
        }
    }

    /**
     * Creates the main gallery modal structure
     * Uses the Overlay class modal functionality for consistent styling and behavior
     * Requirements: 1.1, 1.4
     */
    createGalleryModal() {
        // Use the Overlay class to create a modal with proper backdrop and close functionality
        this.overlay.createModal(
            {
                'id': 'bm-gallery-overlay',
                'className': 'bm-modal-backdrop bm-gallery-backdrop'
            },
            {
                'id': 'bm-gallery-container',
                'className': 'bm-modal-content bm-gallery-content',
                'style': `
                    background-color: rgba(21, 48, 99, 0.95);
                    color: white;
                    border-radius: 8px;
                    padding: 0;
                    max-width: min(95vw, 1200px);
                    max-height: min(90vh, 800px);
                    width: 90vw;
                    height: 80vh;
                    overflow: hidden;
                    transform: scale(0.9);
                    transition: transform 0.3s ease;
                    font-family: 'Roboto Mono', 'Courier New', 'Monaco', 'DejaVu Sans Mono', monospace, 'Arial';
                    letter-spacing: 0.05em;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                `
            },
            () => {
                this.hide();
            }
        )
            // Add modal close button
            .addModalCloseButton().buildElement()

            // Add gallery header
            .addDiv({
                'id': 'bm-gallery-header',
                'className': 'bm-gallery-header',
                'style': `
                padding: 20px 20px 15px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
            `
            })
            .addHeader(2, {
                'textContent': 'Template Gallery',
                'style': `
                    margin: 0;
                    font-size: 1.5em;
                    font-weight: bold;
                    color: white;
                `
            }).buildElement()
            .addDiv({
                'className': 'bm-gallery-header-info',
                'style': `
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.9em;
                    color: rgba(255, 255, 255, 0.8);
                `
            })
            .addSmall({
                'id': 'bm-gallery-count',
                'textContent': '0 templates',
                'style': 'margin: 0;'
            }).buildElement()
            .buildElement()
            .buildElement()

            // Add gallery content area
            .addDiv({
                'id': 'bm-gallery-content',
                'className': 'bm-gallery-content-area',
                'style': `
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                position: relative;
            `
            })
            // Add template grid container
            .addDiv({
                'className': 'bm-template-grid',
                'style': `
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 20px;
                    min-height: 200px;
                `
            }).buildElement()

            // Add empty state placeholder
            .addDiv({
                'id': 'bm-gallery-empty',
                'className': 'bm-empty-state',
                'style': `
                    display: none;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 1.1em;
                `
            })
            .addDiv({
                'style': `
                        font-size: 3em;
                        margin-bottom: 15px;
                        opacity: 0.5;
                    `,
                'textContent': '📁'
            }).buildElement()
            .addP({
                'textContent': 'No templates loaded',
                'style': `
                        margin: 0 0 10px 0;
                        font-weight: bold;
                    `
            }).buildElement()
            .addSmall({
                'textContent': 'Load a template to start using the gallery',
                'style': `
                        margin: 0;
                        opacity: 0.8;
                    `
            }).buildElement()
            .buildElement()
            .buildElement()

            // Build the modal and append to document body
            .buildOverlay(document.body);

        // Store reference to the modal element for later use
        this.galleryElement = document.getElementById('bm-gallery-overlay');
    }

    /**
     * Creates a template card element for a given template
     * Placeholder implementation - will be expanded in task 3.1
     * @param {Object} template - Template object from templateManager
     * @returns {HTMLElement} Template card element
     */
    createTemplateCard(template) {
        // Placeholder - basic card structure
        const card = document.createElement('div');
        card.className = 'bm-template-card';
        card.dataset.templateId = template.id || '0';

        // Basic card content
        card.innerHTML = `
            <div class="bm-template-thumbnail">
                <div class="bm-thumbnail-placeholder">📷</div>
            </div>
            <div class="bm-template-info">
                <h3 class="bm-template-name">${template.name || 'Unnamed Template'}</h3>
                <p class="bm-template-stats">
                    <span class="bm-dimensions">Loading...</span>
                    <span class="bm-pixel-count">Loading...</span>
                </p>
            </div>
            <div class="bm-template-controls">
                <button class="bm-toggle-btn" title="Toggle template">👁</button>
                <button class="bm-navigate-btn" title="Navigate to template">🎯</button>
                <button class="bm-remove-btn" title="Remove template">🗑</button>
            </div>
        `;

        // Cache the card
        this.templateCards.set(template.id || '0', card);

        return card;
    }

    /**
     * Handles template toggle (enable/disable) action
     * Placeholder implementation - will be expanded in task 4.1
     * @param {string} templateId - ID of template to toggle
     */
    handleTemplateToggle(templateId) {
        // Placeholder - basic toggle logic
        console.log(`Toggle template: ${templateId}`);
        // TODO: Integrate with TemplateManager to enable/disable template
        // TODO: Update visual state of toggle button
    }

    /**
     * Handles template removal action
     * Placeholder implementation - will be expanded in task 4.2
     * @param {string} templateId - ID of template to remove
     */
    handleTemplateRemove(templateId) {
        // Placeholder - basic remove logic with confirmation
        console.log(`Remove template: ${templateId}`);
        // TODO: Show confirmation dialog
        // TODO: Integrate with TemplateManager to remove template
        // TODO: Update gallery display
    }

    /**
     * Handles template navigation action
     * Placeholder implementation - will be expanded in task 4.3
     * @param {string} templateId - ID of template to navigate to
     */
    handleTemplateNavigate(templateId) {
        // Placeholder - basic navigation logic
        console.log(`Navigate to template: ${templateId}`);
        // TODO: Validate template coordinates
        // TODO: Integrate with canvas navigation system
        // TODO: Close gallery after navigation
    }


}