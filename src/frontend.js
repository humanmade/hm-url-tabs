import './frontend.css';

/**
 * Handle view transitions for tab visibility blocks.
 */
document.addEventListener( 'DOMContentLoaded', () => {
	// Get all tab navigation links.
	const tabLinks = document.querySelectorAll( 'a.hm-url-tab-link' );

	if ( tabLinks.length === 0 ) {
		return;
	}

	// Handle tab link clicks.
	tabLinks.forEach( ( link ) => {
		link.addEventListener( 'click', ( e ) => {
			e.preventDefault();

			// Use View Transition API if available.
			if ( document.startViewTransition ) {
				document.startViewTransition( () => {
					window.location.href = link.href;
				} );
			} else {
				// Fallback: navigate without transition.
				window.location.href = link.href;
			}
		} );
	} );
} );
